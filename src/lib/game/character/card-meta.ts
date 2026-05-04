import { clampDimensions, normalizeScheduler, normalizeSeed } from "@/lib/sdk/from-meta";

function buildPrompt(
  card: Record<string, unknown>,
  scene: string,
  promptAppend: string,
): string {
  const g = (card.固化 ?? {}) as Record<string, unknown>;
  const parts: string[] = [
    String(g["画风与质量"] ?? "").trim(),
    String(g["容貌与发型"] ?? "").trim(),
    String(g["身材与体态"] ?? "").trim(),
    String(g["气质与年龄感"] ?? "").trim(),
  ];
  const trig = (card["触发词与嵌入"] ?? {}) as Record<string, unknown>;
  const loraTw = String(trig["LoRA触发词"] ?? "").trim();
  if (loraTw) parts.push(loraTw);
  const ti = String(trig["Textual_Inversion"] ?? "").trim();
  if (ti) parts.push(ti);
  const sc = (scene ?? "").trim();
  if (sc) parts.push(sc);
  const extra = (promptAppend ?? "").trim();
  if (extra) parts.push(extra);
  return parts.filter(Boolean).join(", ");
}

function buildNegative(card: Record<string, unknown>, negativeAppend: string): string {
  const a = String(card["负面提示词_通用"] ?? "").trim();
  const b = String(card["负面提示词_外貌纠错"] ?? "").trim();
  const x = (negativeAppend ?? "").trim();
  return [a, b, x].filter(Boolean).join(", ");
}

function civitaiResources(card: Record<string, unknown>): Record<string, unknown>[] {
  const vid = card["模型版本ID"];
  if (vid == null) {
    throw new Error(
      "角色卡缺少「模型版本ID」。请在 JSON 根级添加整数，例如 " +
        '"模型版本ID": 1915059（对应 Civitai 某 checkpoint 的 model-versions id）。',
    );
  }
  const resources: Record<string, unknown>[] = [
    { type: "checkpoint", modelVersionId: Number(vid) },
  ];
  const tech = (card["技术辅助"] ?? {}) as Record<string, unknown>;
  const loras = tech["LoRA"];
  if (!Array.isArray(loras)) return resources;
  for (const item of loras) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const mid = o.modelVersionId;
    if (mid == null) continue;
    const t = String(o.type ?? "lora").toLowerCase();
    const entry: Record<string, unknown> = { type: t, modelVersionId: Number(mid) };
    if (o.strength != null) entry.strength = Number(o.strength);
    resources.push(entry);
  }
  return resources;
}

/** Build a flat custom meta dict for parse_meta(..., 'custom'). */
export function cardToCustomMeta(
  card: Record<string, unknown>,
  options: {
    scene: string;
    promptAppend?: string;
    negativeAppend?: string;
    maxSide?: number;
    /** 若设置则覆盖角色卡「常用_seed」，用于同地点 CG 连续性 */
    seedOverride?: number | null;
  },
): Record<string, unknown> {
  const {
    scene,
    promptAppend = "",
    negativeAppend = "",
    maxSide = 1024,
    seedOverride = null,
  } = options;
  const res = (card["分辨率"] ?? {}) as Record<string, unknown>;
  const w = Number(res.width ?? 1024);
  const h = Number(res.height ?? 1024);
  const [w2, h2] = clampDimensions(w, h, maxSide);

  const recipe = (card["出图配方_默认值"] ?? {}) as Record<string, unknown>;
  const tech = (card["技术辅助"] ?? {}) as Record<string, unknown>;
  const seedFromCard = normalizeSeed(tech["常用_seed"]);
  const seed = seedOverride != null ? normalizeSeed(seedOverride) : seedFromCard;

  const inner: Record<string, unknown> = {
    prompt: buildPrompt(card, scene, promptAppend),
    negativePrompt: buildNegative(card, negativeAppend),
    width: w2,
    height: h2,
    steps: Number(recipe.steps ?? 30),
    cfgScale: Number(recipe.cfg ?? 7),
    sampler: normalizeScheduler(String(recipe.sampler ?? "Euler a")),
    civitaiResources: civitaiResources(card),
  };
  if (seed != null) inner.seed = seed;
  const cs = card.clip_skip;
  if (cs != null) {
    const n = Number(cs);
    if (!Number.isNaN(n)) inner.clipSkip = n;
  }
  return inner;
}
