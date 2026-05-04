/**
 * Civitai 单次出图（固化角色卡 + 场景英文）。
 * 组合游戏侧 `runCgJob`（与叙事 CG 同源）；仓库根：`npx tsx scripts/civitai-generate-scene.ts`
 *
 * 可选 CLI 参数：
 *   --bare-legs | --no-hosiery          无丝袜
 *   --no-skirt | --bottomless | --nsfw  无裙子 + 下体裸露（自动开启 allowExplicitVisual）
 *   其余参数为自定义 scene 英文片段（逗号分隔短语）。
 */
import fs from "fs";
import path from "path";
import { runCgJob } from "@/lib/game/adapters/cg";
import { defaultConfig } from "@/lib/game/config";

const defaultLocation =
  "classroom interior, school, large windows with daylight, rows of empty student desks in soft focus background, blackboard on wall, wooden floor, chalk tray";
const defaultScene =
  "standing at front of class, holding chalk, pointing at blackboard with lesson diagram, teaching gesture, professional demeanor, gentle smile, eye contact, medium wide shot";

const BARE_LEG_TAGS =
  "bare legs, smooth skin, natural legs, knees visible, no pantyhose, no stockings, no tights, no hosiery, no legwear";

const NO_SKIRT_TAGS =
  "no skirt, bottomless, pussy, bare pussy, exposed pussy, detailed pussy, no panties, naked lower body, pubic hair, nsfw, explicit";

export function parseCivitaiGenerateSceneArgs(argv: string[]): {
  bareLegs: boolean;
  noSkirt: boolean;
  sceneTail: string;
} {
  const bareFlags = new Set(["--bare-legs", "--no-hosiery"]);
  const skirtFlags = new Set(["--no-skirt", "--bottomless", "--nsfw"]);
  const rest: string[] = [];
  let bareLegs = false;
  let noSkirt = false;
  for (const a of argv) {
    if (bareFlags.has(a)) bareLegs = true;
    else if (skirtFlags.has(a)) noSkirt = true;
    else rest.push(a);
  }
  return { bareLegs, noSkirt, sceneTail: rest.join(", ").trim() };
}

/** 临时角色卡：覆盖服装固化（腿部 / 下装）。 */
function writeTempCharacterCard(
  cardPath: string,
  outDir: string,
  overrides: Record<string, string>,
): string {
  const raw = JSON.parse(fs.readFileSync(cardPath, "utf-8")) as Record<string, unknown>;
  const outfit = { ...((raw["服装固化"] as Record<string, unknown>) ?? {}) };
  for (const [k, v] of Object.entries(overrides)) {
    outfit[k] = v;
  }
  raw["服装固化"] = outfit;
  const ts = Date.now();
  const tmp = path.join(outDir, `_temp_character_${ts}.json`);
  fs.writeFileSync(tmp, JSON.stringify(raw, null, 2), "utf-8");
  return tmp;
}

export async function runCivitaiGenerateSceneCli(argv: string[] = process.argv.slice(2)): Promise<void> {
  const cfg = defaultConfig();
  const defaultCharacterCardPath = cfg.characterJson;

  const { bareLegs, noSkirt, sceneTail } = parseCivitaiGenerateSceneArgs(argv);
  const scene = sceneTail || defaultScene;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

  let baseName = "cg_teacher_class";
  if (noSkirt) baseName += "_bottomless";
  else if (bareLegs) baseName += "_no_hosiery";
  const out = path.join(cfg.outputDir, `${baseName}_${stamp}.png`);

  let characterJson = defaultCharacterCardPath;
  let tmpCard: string | null = null;
  let continuitySeed: number | null | undefined = undefined;
  let allowExplicitVisual = false;
  let wearOverlay: string | undefined = undefined;

  if (bareLegs || noSkirt) {
    const card0 = JSON.parse(fs.readFileSync(defaultCharacterCardPath, "utf-8")) as Record<string, unknown>;
    const tech = (card0["技术辅助"] ?? {}) as Record<string, unknown>;
    const s = tech["常用_seed"];
    if (typeof s === "number" && Number.isFinite(s)) continuitySeed = s;
    else if (s != null) {
      const n = Number(s);
      if (Number.isFinite(n)) continuitySeed = n;
    }

    const overrides: Record<string, string> = {};
    if (bareLegs) overrides["腿部"] = BARE_LEG_TAGS;
    if (noSkirt) {
      overrides["下装"] = NO_SKIRT_TAGS;
      overrides["锁定约束"] = "bottomless, explicit lower body";
      allowExplicitVisual = true;
      wearOverlay = "bottomless, exposed pussy, no skirt";
    }

    tmpCard = writeTempCharacterCard(defaultCharacterCardPath, cfg.outputDir, overrides);
    characterJson = tmpCard;
    console.log("Using temp card:", tmpCard);
    if (continuitySeed != null) console.log("continuitySeed:", continuitySeed);
    if (allowExplicitVisual) console.log("NSFW mode enabled (allowExplicitVisual = true)");
  }

  console.log("Character:", characterJson);
  console.log("Output:", out);

  await runCgJob({
    characterJson,
    scene,
    outPath: out,
    modelVersionCache: cfg.modelVersionCache,
    allowExplicitVisual,
    locationEn: defaultLocation,
    continuitySeed,
    wearOverlay,
    log: (line) => console.log(line),
  });

  if (tmpCard && fs.existsSync(tmpCard)) {
    try {
      fs.unlinkSync(tmpCard);
    } catch {
      /* ignore */
    }
  }

  if (!fs.existsSync(out)) {
    console.error("Expected output missing:", out);
    process.exit(1);
  }
  console.log("Done:", out);
}

void runCivitaiGenerateSceneCli().catch((e) => {
  console.error(e);
  process.exit(1);
});
