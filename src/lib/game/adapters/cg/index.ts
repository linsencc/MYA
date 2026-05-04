import fs from "fs";
import path from "path";
import { cardToCustomMeta } from "@/lib/game/character/card-meta";
import { buildJobInput, clampDimensions, normalizeScheduler, normalizeSeed } from "@/lib/sdk/from-meta";
import { CivitaiClient, CivitaiOrchestrationUnavailableError } from "@/lib/sdk/client";
import { ensureApiToken } from "@/lib/sdk/token-file";

const NSFW_STATE = "nude, naked, nsfw, explicit";
const NSFW_DETAIL = "uncensored, detailed skin, detailed nipples, realistic body, erotic, intimate";
const NSFW_NEG_STRIP = new Set([
  "censored",
  "bar censor",
  "mosaic censor",
  "nsfw",
  "nude",
  "naked",
  "topless",
  "exposed",
  "explicit",
  "erotic",
]);

const BG_WORDS = new Set([
  "classroom", "office", "library", "hallway", "corridor", "room",
  "indoor", "outdoor", "background", "environment", "setting",
  "school", "building", "desk", "chair", "blackboard", "window", "windows",
  "bookshelf", "bookcase", "shelf", "table", "floor", "wall", "ceiling",
  "podium", "chalkboard",
  "sunlight", "daylight", "lamplight", "fluorescent", "ambient light",
  "morning", "afternoon", "evening", "night", "dusk", "dawn",
  "golden hour", "sunset", "sunrise", "overcast", "cloudy",
  "light through", "light streaming", "light rays",
]);

const APPEARANCE_PG = new Set([
  "shirt", "blouse", "top", "jacket", "coat", "blazer", "cardigan",
  "sweater", "hoodie", "vest", "uniform", "collar", "sleeve", "sleeves",
  "button-up", "button up", "tucked",
  "skirt", "dress", "pants", "trousers", "jeans", "shorts", "leggings",
  "pencil skirt", "mini skirt", "maxi skirt",
  "stockings", "pantyhose", "tights", "socks", "shoes", "heels", "pumps",
  "boots", "sandals", "loafers", "footwear", "legwear",
  "necklace", "bracelet", "ring", "earrings", "wristwatch", "watch",
  "jewelry", "accessories", "ribbon", "hairpin",
  "hair color", "hairstyle", "haircut", "bob cut",
  "black hair", "blonde", "brown hair", "silver hair",
  "bangs", "fringe", "twintails", "ponytail", "braid",
  "glasses", "eyewear", "spectacles", "eyeglasses",
  "makeup", "lipstick",
  "asian", "japanese", "korean", "chinese", "fair skin", "skin tone",
  "teacher", "office lady", "mature female", "adult woman",
  "1girl", "solo", "female", "woman", "girl",
  "medium breasts", "slim waist", "hourglass",
  "outfit", "costume", "attire", "clothing", "clothes",
  "wearing", "dressed in", "dressed as",
  "fully clothed", "consistent outfit", "same clothes",
]);

const POSE_WORDS = new Set([
  "standing", "sitting", "kneeling", "lying", "leaning", "crouching",
  "reaching", "holding", "grabbing", "touching", "pointing",
  "looking", "gazing", "staring", "glancing",
  "smiling", "laughing", "crying", "blushing", "frowning", "pouting",
  "surprised", "shocked", "nervous", "shy", "embarrassed", "conflicted",
  "close-up", "portrait", "medium shot", "wide shot", "from above",
  "from below", "from behind", "over-the-shoulder", "profile view",
  "front view", "back view", "pov",
  "hands clasped", "arms crossed", "chin resting",
  "eye contact", "averted gaze",
  "turned", "tilted", "lowered", "raised", "extended",
]);

const OUTFIT_FIELD_ORDER = ["上衣", "下装", "腿部", "鞋履", "配饰", "锁定约束"] as const;

/** LLM 偶发带上的裸露词：日常出图前剔除，避免误生成 */
const EXPLICIT_SCENE_SUBSTRINGS = [
  "nude",
  "naked",
  "topless",
  "bottomless",
  "nsfw",
  "explicit",
  "uncensored",
  "nipple",
  "areola",
  "bare chest",
  "bare breast",
  "bare skin",
  "fully exposed",
  "spread leg",
  "penis",
  "vagina",
  "pussy",
  "clitoris",
  "scrotum",
  "testicle",
  "masturbat",
  "orgasm",
  "ejacul",
  "creampie",
  "fellatio",
  "cunnilingus",
  "intercourse",
  "cum on",
  "cum dripping",
  "no panties",
  "panties off",
  "shirt off",
  "skirt lifted exposing",
  "unbuttoned shirt exposing",
  "groping",
  "fondling breast",
  "sexual act",
  "having sex",
  "doggy style",
  "cowgirl position",
  "missionary position",
];

export function sanitizeSceneForSafeVisual(scene: string): string {
  const parts = scene.split(",").map((t) => t.trim()).filter(Boolean);
  return parts
    .filter((tok) => {
      const tl = tok.toLowerCase();
      return !EXPLICIT_SCENE_SUBSTRINGS.some((frag) => tl.includes(frag));
    })
    .join(", ");
}

function stripScene(scene: string, allowExplicitVisual: boolean): string {
  const out: string[] = [];
  for (const tok of scene.split(",").map((t) => t.trim())) {
    if (!tok) continue;
    const tl = tok.toLowerCase();
    if (!allowExplicitVisual && [...APPEARANCE_PG].some((kw) => tl.includes(kw))) continue;
    const hasBg = [...BG_WORDS].some((kw) => tl.includes(kw));
    const hasPose = [...POSE_WORDS].some((pw) => tl.includes(pw));
    if (hasBg && !hasPose) continue;
    out.push(tok);
  }
  return out.join(", ");
}

function nsfwPositive(card: Record<string, unknown>, fullScene: string): string {
  const g = (card.固化 ?? {}) as Record<string, unknown>;
  const quality = String(g["画风与质量"] ?? "").trim();
  const rawFace = String(g["容貌与发型"] ?? "");
  const faceTokens = rawFace
    .split(",")
    .map((t) => t.trim())
    .filter(
      (t) =>
        t &&
        !["glass", "eyewear", "spectacle", "eyeglass", "office lady", "teacher", "professional", "elegant"].some(
          (kw) => t.toLowerCase().includes(kw),
        ),
    );
  const face = faceTokens.join(", ");
  const body = String(g["身材与体态"] ?? "").trim();
  const trig = (card["触发词与嵌入"] ?? {}) as Record<string, unknown>;
  const loraTw = String(trig["LoRA触发词"] ?? "").trim();
  const ti = String(trig["Textual_Inversion"] ?? "").trim();
  return [quality, NSFW_STATE, face, body, loraTw, ti, fullScene, NSFW_DETAIL].filter(Boolean).join(", ");
}

function nsfwNegative(card: Record<string, unknown>): string {
  const raw = ["负面提示词_通用", "负面提示词_外貌纠错"]
    .map((k) => String(card[k] ?? "").trim())
    .filter(Boolean)
    .join(", ");
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t && !NSFW_NEG_STRIP.has(t.toLowerCase()))
    .join(", ");
}

function nsfwResources(card: Record<string, unknown>): Record<string, unknown>[] {
  const vid = card["模型版本ID"];
  if (vid == null) throw new Error("角色卡缺少「模型版本ID」");
  const res: Record<string, unknown>[] = [{ type: "checkpoint", modelVersionId: Number(vid) }];
  const tech = (card["技术辅助"] ?? {}) as Record<string, unknown>;
  const loras = tech["LoRA"];
  if (!Array.isArray(loras)) return res;
  for (const item of loras) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.modelVersionId == null) continue;
    const entry: Record<string, unknown> = {
      type: String(o.type ?? "lora").toLowerCase(),
      modelVersionId: Number(o.modelVersionId),
    };
    if (o.strength != null) entry.strength = Number(o.strength);
    res.push(entry);
  }
  return res;
}

function buildNsfwMeta(
  card: Record<string, unknown>,
  fullScene: string,
  continuitySeed: number | null | undefined,
): Record<string, unknown> {
  const res = (card["分辨率"] ?? {}) as Record<string, unknown>;
  const [w, h] = clampDimensions(Number(res.width ?? 1024), Number(res.height ?? 1024), 1024);
  const recipe = (card["出图配方_默认值"] ?? {}) as Record<string, unknown>;
  const tech = (card["技术辅助"] ?? {}) as Record<string, unknown>;
  const seedFromCard = normalizeSeed(tech["常用_seed"]);
  const seed = continuitySeed != null ? normalizeSeed(continuitySeed) : seedFromCard;
  const meta: Record<string, unknown> = {
    prompt: nsfwPositive(card, fullScene),
    negativePrompt: nsfwNegative(card),
    width: w,
    height: h,
    steps: Number(recipe.steps ?? 30),
    cfgScale: Number(recipe.cfg ?? 7),
    sampler: normalizeScheduler(String(recipe.sampler ?? "Euler a")),
    civitaiResources: nsfwResources(card),
  };
  if (seed != null) meta.seed = seed;
  const cs = card.clip_skip;
  if (cs != null) {
    const n = Number(cs);
    if (!Number.isNaN(n)) meta.clipSkip = n;
  }
  return meta;
}

function outfitTags(card: Record<string, unknown>): string {
  const raw = card["服装固化"];
  if (typeof raw === "string") return raw.trim();
  if (raw && typeof raw === "object") {
    const d = raw as Record<string, unknown>;
    const parts: string[] = [];
    const seen = new Set<string>();
    for (const key of OUTFIT_FIELD_ORDER) {
      const v = d[key];
      if (v && !String(key).startsWith("_")) {
        parts.push(String(v).trim());
        seen.add(key);
      }
    }
    for (const [key, v] of Object.entries(d)) {
      if (!seen.has(key) && !key.startsWith("_") && v) parts.push(String(v).trim());
    }
    return parts.filter(Boolean).join(", ");
  }
  return "";
}

function sceneSuffix(card: Record<string, unknown>): string {
  const sf = card["场景固化"];
  if (sf && typeof sf === "object") {
    return String((sf as Record<string, unknown>).通用 ?? "").trim();
  }
  return "";
}

export async function runCgJob(options: {
  characterJson: string;
  scene: string;
  outPath: string;
  modelVersionCache: string | null;
  /** true：注入成人向 prompt（含裸露词）；false：PG 管线 + 固化服装 */
  allowExplicitVisual: boolean;
  locationEn: string;
  /** PG：与当前存档 wear 对齐的中文着装短语，追加在固化服装与 scene 之间 */
  wearOverlay?: string;
  /** 同章节同地点复用，减轻布景随机漂移 */
  continuitySeed?: number | null;
  /** 写入游戏内控制台（与叙事引擎 CG 行同源） */
  log?: (line: string) => void;
}): Promise<void> {
  const {
    characterJson,
    scene,
    outPath,
    modelVersionCache,
    allowExplicitVisual,
    locationEn,
    wearOverlay,
    continuitySeed,
    log,
  } = options;

  let card: Record<string, unknown>;
  try {
    card = JSON.parse(fs.readFileSync(characterJson, "utf-8")) as Record<string, unknown>;
  } catch (e) {
    console.warn("CG failed to load card:", e);
    return;
  }

  const sceneIn = allowExplicitVisual ? scene : sanitizeSceneForSafeVisual(scene);
  const cleanScene = stripScene(sceneIn, allowExplicitVisual);
  const suffix = sceneSuffix(card);
  let meta: Record<string, unknown>;

  if (allowExplicitVisual) {
    const fullScene = [locationEn, wearOverlay?.trim(), cleanScene, suffix].filter(Boolean).join(", ");
    meta = buildNsfwMeta(card, fullScene, continuitySeed);
  } else {
    const fullScene = [locationEn, outfitTags(card), wearOverlay?.trim(), cleanScene, suffix]
      .filter(Boolean)
      .join(", ");
    try {
      meta = cardToCustomMeta(card, {
        scene: fullScene,
        promptAppend: "",
        negativeAppend: "",
        maxSide: 1024,
        seedOverride: continuitySeed,
      });
    } catch (e) {
      console.warn("CG meta build failed:", e);
      return;
    }
    const neg = ["负面提示词_通用", "负面提示词_外貌纠错", "负面提示词_服装纠错"]
      .map((k) => String(card[k] ?? "").trim())
      .filter(Boolean)
      .join(", ");
    meta.negativePrompt = neg;
  }

  try {
    log?.("正在连接 Civitai（orchestration）并提交出图…");
    ensureApiToken();
    const client = new CivitaiClient({
      modelVersionCacheDir: modelVersionCache ?? undefined,
    });
    const jobInput = await buildJobInput(meta, client, { metaFormat: "custom", maxSide: 1024 });
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [, blob] = await client.generateImageAndWait(jobInput, {
          timeoutSec: 300,
          intervalSec: 2,
        });
        log?.("云端已返回图片地址，正在下载到本地…");
        await CivitaiClient.downloadUrl(blob, outPath);
        const bytes = fs.statSync(outPath).size;
        log?.(`完成 · ${path.basename(outPath)} · ${Math.round(bytes / 1024)} KB`);
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) {
          const delay = attempt === 0 ? 1500 : 3000;
          log?.(`出图链路失败，${delay / 1000}s 后重试（第 ${attempt + 2}/3 次）…`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    if (lastErr != null) throw lastErr;
  } catch (e) {
    console.warn("CG failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const cause = e instanceof Error && e.cause != null ? ` | ${String(e.cause)}` : "";
    if (e instanceof CivitaiOrchestrationUnavailableError) {
      log?.(`失败 · ${e.code}（编排服务端持续 5xx，须 Civitai 或网络环境处理）`);
    }
    log?.(`失败 · ${msg}${cause}`);
  }
}

/** Fire-and-forget background generation (like Python daemon thread). */
export function requestCg(options: Parameters<typeof runCgJob>[0]): void {
  if (!options.scene?.trim()) return;
  void runCgJob(options).catch((e) => {
    console.warn("CG background error:", e);
    options.log?.(`失败 · ${e instanceof Error ? e.message : String(e)}`);
  });
}

export function placeholderPublicPath(): string {
  return "/api/game/placeholder";
}
