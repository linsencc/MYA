import fs from "fs";
import path from "path";
import { buildJobInput, clampDimensions, normalizeScheduler, normalizeSeed } from "@/lib/sdk/from-meta";
import { CivitaiClient, CivitaiOrchestrationUnavailableError } from "@/lib/sdk/client";
import { ensureApiToken } from "@/lib/sdk/token-file";

/** 净化后的场景 id（`public/scenes/<safe>/` 子文件夹名，与 `bg_<safe>.png` 共用） */
export function sceneBgSafeId(sceneId: string): string {
  return sceneId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "default";
}

/** 与 {@link sceneBgDiskPath} 一致的 basename：`bg_<id>.png` */
export function sceneBgFilename(sceneId: string): string {
  return `bg_${sceneBgSafeId(sceneId)}.png`;
}

/** 磁盘路径：`outputDir/<safeId>/bg_<safeId>.png`（与 `world_cg_src` `/scenes/<id>/bg_<id>.png` 对齐） */
export function sceneBgDiskPath(outputDir: string, sceneId: string): string {
  const safe = sceneBgSafeId(sceneId);
  return path.join(outputDir, safe, sceneBgFilename(sceneId));
}

function seedFromSceneId(sceneId: string): number {
  let h = 2166136261;
  for (let i = 0; i < sceneId.length; i++) {
    h ^= sceneId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return normalizeSeed(h) ?? 774411223;
}

/**
 * 纯背景出图（无角色卡）：单 checkpoint + 英文 prompt。
 */
export async function runSceneBgJob(options: {
  sceneId: string;
  bgPrompt: string;
  bgNegative: string;
  checkpointVersionId: number;
  width: number;
  height: number;
  outPath: string;
  modelVersionCache: string | null;
  log?: (line: string) => void;
}): Promise<void> {
  const {
    bgPrompt,
    bgNegative,
    checkpointVersionId,
    width,
    height,
    outPath,
    modelVersionCache,
    log,
  } = options;
  const [w, h] = clampDimensions(width, height, 1536);
  const pos = [
    bgPrompt.trim(),
    "masterpiece, best quality, ultra detailed",
    "empty scene, no people, no characters, no humans, scenery only, background art",
  ]
    .filter(Boolean)
    .join(", ");
  const neg = [
    bgNegative.trim(),
    "1girl",
    "1boy",
    "person",
    "people",
    "human",
    "face",
    "portrait",
    "anime girl",
    "text",
    "watermark",
  ]
    .filter(Boolean)
    .join(", ");
  const meta: Record<string, unknown> = {
    prompt: pos,
    negativePrompt: neg,
    width: w,
    height: h,
    steps: 28,
    cfgScale: 6,
    sampler: normalizeScheduler("Euler a"),
    civitaiResources: [{ type: "checkpoint", modelVersionId: Number(checkpointVersionId) }],
    seed: seedFromSceneId(options.sceneId),
  };

  try {
    log?.("场景背景 · 连接 Civitai 并提交出图…");
    ensureApiToken();
    const client = new CivitaiClient({
      modelVersionCacheDir: modelVersionCache ?? undefined,
    });
    const jobInput = await buildJobInput(meta, client, { metaFormat: "custom", maxSide: 1536 });
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const [, blob] = await client.generateImageAndWait(jobInput, {
          timeoutSec: 300,
          intervalSec: 2,
        });
        log?.("场景背景 · 下载到本地…");
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        await CivitaiClient.downloadUrl(blob, outPath);
        const bytes = fs.statSync(outPath).size;
        log?.(`场景背景 · 完成 · ${path.basename(outPath)} · ${Math.round(bytes / 1024)} KB`);
        lastErr = undefined;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) {
          const delay = attempt === 0 ? 1500 : 3000;
          log?.(`场景背景 · 失败 ${delay / 1000}s 后重试（${attempt + 2}/3）…`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    if (lastErr != null) throw lastErr;
  } catch (e) {
    console.warn("scene bg failed:", e);
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof CivitaiOrchestrationUnavailableError) {
      log?.(`场景背景 · 失败 · ${e.code}`);
    }
    log?.(`场景背景 · 失败 · ${msg}`);
  }
}

export function requestSceneBg(options: Parameters<typeof runSceneBgJob>[0]): void {
  if (!options.bgPrompt?.trim()) return;
  void runSceneBgJob(options).catch((e) => {
    console.warn("scene bg background error:", e);
    options.log?.(`场景背景 · 失败 · ${e instanceof Error ? e.message : String(e)}`);
  });
}
