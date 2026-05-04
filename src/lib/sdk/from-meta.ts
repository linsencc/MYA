import type { CivitaiClient } from "@/lib/sdk/client";
import { ecosystemForBaseModel, orchestrationBaseModelFromAirUrn, sdkNetworkType } from "@/lib/sdk/client";
import { parseMeta, type MetaFormat } from "@/lib/sdk/meta-job";

export function normalizeScheduler(sampler: string | null | undefined): string {
  if (!sampler) return "EulerA";
  const key = sampler.trim().toLowerCase();
  const keyCompact = key.replace(/\s+/g, "").replace(/_/g, "").replace(/\+/g, "");

  const aliases: Record<string, string> = {
    "euler a": "EulerA",
    eulera: "EulerA",
    euler: "Euler",
    eulerancestral: "EulerA",
    lms: "LMS",
    heun: "Heun",
    dpm2: "DPM2",
    dpm2a: "DPM2A",
    dpm2m: "DPM2M",
    dpm2mkarras: "DPM2MKarras",
    dpm2sde: "DPMSDE",
    dpm2sdekarras: "DPMSDEKarras",
    "dpm++2mkarras": "DPM2MKarras",
    "dpm++2sdekarras": "DPMSDEKarras",
    "dpm++2m": "DPM2M",
    ddim: "DDIM",
    plms: "PLMS",
    uni_pc: "UniPC",
    unipc: "UniPC",
    lcm: "LCM",
    ddpm: "DDPM",
  };
  if (aliases[key]) return aliases[key];
  if (aliases[keyCompact]) return aliases[keyCompact];
  if (key.includes("euler") && key.includes("a")) return "EulerA";
  if (key.includes("karras") && key.includes("2m")) return "DPM2MKarras";
  if (key.includes("karras") && key.includes("sde")) return "DPMSDEKarras";
  console.warn(`Unknown sampler ${JSON.stringify(sampler)}; using EulerA`);
  return "EulerA";
}

export function align64(n: number): number {
  return Math.max(64, Math.floor(n / 64) * 64);
}

export function clampDimensions(width: number, height: number, maxSide: number): [number, number] {
  let w = Math.max(64, Math.floor(width));
  let h = Math.max(64, Math.floor(height));
  if (maxSide <= 0 || (w <= maxSide && h <= maxSide)) {
    return [align64(w), align64(h)];
  }
  const scale = Math.min(maxSide / w, maxSide / h);
  w = Math.max(64, Math.floor(w * scale));
  h = Math.max(64, Math.floor(h * scale));
  return [align64(w), align64(h)];
}

export function normalizeSeed(seed: unknown): number | null {
  if (seed == null) return null;
  const v = typeof seed === "number" ? seed : parseInt(String(seed), 10);
  if (Number.isNaN(v)) return null;
  return v % (2 ** 32 - 1);
}

function finalizeDirectJob(
  job: Record<string, unknown>,
  opts: {
    promptAppend: string;
    negativeAppend: string;
    seedOverride: number | null | undefined;
    schedulerOverride: string | null | undefined;
    maxSide: number;
  },
): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(job)) as Record<string, unknown>;
  const params = out.params as Record<string, unknown>;
  if (!params || typeof params !== "object") {
    throw new Error("direct job: 'params' must be an object");
  }
  params.prompt = String(params.prompt ?? "") + opts.promptAppend;
  params.negativePrompt = String(params.negativePrompt ?? "") + opts.negativeAppend;
  if (opts.schedulerOverride) params.scheduler = opts.schedulerOverride;
  if (opts.seedOverride != null) params.seed = opts.seedOverride;
  const w = Number(params.width ?? 1024);
  const h = Number(params.height ?? 1024);
  const [w2, h2] = clampDimensions(w, h, opts.maxSide);
  if (w2 !== w || h2 !== h) {
    console.warn(`Clamped size ${w}x${h} -> ${w2}x${h2} (SDK / service limit)`);
  }
  params.width = w2;
  params.height = h2;
  out.params = params;
  return out;
}

/** 与 Python `civitai-py` 一致：优先 meta 内 baseModel / 基模名称，否则按 AIR URN 推断（修复 npm SDK 仅看 "sdxl" 子串的问题）。 */
function orchestrationBaseModelForInner(
  inner: Record<string, unknown>,
  modelUrn: string,
): "SDXL" | "SD_1_5" {
  const explicit = inner.baseModel;
  if (explicit === "SDXL" || explicit === "SD_1_5") return explicit;
  if (typeof explicit === "string" && explicit.trim()) {
    return ecosystemForBaseModel(explicit) === "sdxl" ? "SDXL" : "SD_1_5";
  }
  return orchestrationBaseModelFromAirUrn(modelUrn);
}

async function buildJobFromInner(
  inner: Record<string, unknown>,
  raw: Record<string, unknown>,
  client: CivitaiClient,
  opts: {
    promptAppend: string;
    negativeAppend: string;
    seedOverride: number | null | undefined;
    schedulerOverride: string | null | undefined;
    maxSide: number;
    loraStrengthDefault: number;
  },
): Promise<Record<string, unknown>> {
  let resources = (inner.civitaiResources ?? inner.resources) as unknown;
  if (!Array.isArray(resources)) resources = [];

  const checkpoints: Record<string, unknown>[] = [];
  const extras: Record<string, unknown>[] = [];
  for (const r of resources as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const t = String(r.type ?? "").toLowerCase();
    if (t === "checkpoint") checkpoints.push(r);
    else if (t) extras.push(r);
  }

  if (checkpoints.length === 0) {
    throw new Error(
      "No checkpoint in civitaiResources. Add " +
        '{"type": "checkpoint", "modelVersionId": <id>} (Civitai model version id), ' +
        "or use --format direct with a full AIR URN in 'model'.",
    );
  }

  const main = checkpoints[0];
  const mainVid = main.modelVersionId;
  if (typeof mainVid !== "number") {
    throw new Error(`Invalid checkpoint modelVersionId: ${JSON.stringify(main)}`);
  }
  const modelUrn = await client.resolveResourceUrn("checkpoint", mainVid);

  const additional: Record<string, Record<string, unknown>> = {};

  for (const r of checkpoints.slice(1)) {
    const vid = r.modelVersionId;
    if (typeof vid === "number") {
      const urn = await client.resolveResourceUrn("checkpoint", vid);
      additional[urn] = { type: "Checkpoint", strength: Number(r.strength ?? 1.0) };
    }
  }

  for (const r of extras) {
    const vid = r.modelVersionId;
    if (typeof vid !== "number") continue;
    const t = String(r.type ?? "").toLowerCase();
    const urn = await client.resolveResourceUrn(t || "lora", vid);
    const stype = sdkNetworkType(t);
    const entry: Record<string, unknown> = { type: stype };
    if (["Lora", "LoCon", "Lycoris", "Checkpoint", "Hypernetwork", "Vae"].includes(stype)) {
      entry.strength = Number(r.strength ?? opts.loraStrengthDefault);
    }
    if (stype === "TextualInversion") {
      const tw = r.triggerWord ?? r.trigger;
      if (tw) entry.triggerWord = String(tw);
    }
    additional[urn] = entry;
  }

  const prompt = String(inner.prompt ?? "") + opts.promptAppend;
  const neg = String(inner.negativePrompt ?? "") + opts.negativeAppend;

  const w = Number(inner.width ?? raw.width ?? 1024);
  const h = Number(inner.height ?? raw.height ?? 1024);
  const [w2, h2] = clampDimensions(w, h, opts.maxSide);
  if (w2 !== w || h2 !== h) {
    console.warn(`Clamped size ${w}x${h} -> ${w2}x${h2} (SDK / service limit)`);
  }

  const steps = Number(inner.steps ?? 30);
  const cfg = Number(inner.cfgScale ?? 7);
  const clipSkip = inner.clipSkip;
  const sched =
    opts.schedulerOverride ||
    normalizeScheduler((inner.sampler ?? inner.scheduler) as string | undefined);
  const seed = opts.seedOverride != null ? opts.seedOverride : normalizeSeed(inner.seed);

  const params: Record<string, unknown> = {
    prompt,
    negativePrompt: neg,
    scheduler: sched,
    steps,
    cfgScale: cfg,
    width: w2,
    height: h2,
  };
  if (seed != null) params.seed = seed;
  if (clipSkip != null) {
    const cs = Number(clipSkip);
    if (!Number.isNaN(cs)) params.clipSkip = cs;
  }

  const job: Record<string, unknown> = {
    model: modelUrn,
    baseModel: orchestrationBaseModelForInner(inner, modelUrn),
    params,
  };
  if (Object.keys(additional).length) job.additionalNetworks = additional;
  return job;
}

export async function buildJobInput(
  raw: Record<string, unknown>,
  client: CivitaiClient,
  options: {
    metaFormat?: MetaFormat;
    promptAppend?: string;
    negativeAppend?: string;
    seedOverride?: number | null;
    schedulerOverride?: string | null;
    maxSide?: number;
    loraStrengthDefault?: number;
  } = {},
): Promise<Record<string, unknown>> {
  const {
    metaFormat = "auto",
    promptAppend = "",
    negativeAppend = "",
    seedOverride = null,
    schedulerOverride = null,
    maxSide = 1024,
    loraStrengthDefault = 1.0,
  } = options;

  const parsed = parseMeta(raw, metaFormat);
  if (parsed.kind === "direct_job") {
    return finalizeDirectJob(parsed.job, {
      promptAppend,
      negativeAppend,
      seedOverride,
      schedulerOverride,
      maxSide,
    });
  }
  return buildJobFromInner(parsed.inner, raw, client, {
    promptAppend,
    negativeAppend,
    seedOverride,
    schedulerOverride,
    maxSide,
    loraStrengthDefault,
  });
}
