export type MetaFormat = "auto" | "civitai" | "custom" | "direct";

export type ParsedMeta =
  | { kind: "inner"; inner: Record<string, unknown> }
  | { kind: "direct_job"; job: Record<string, unknown> };

function extractCivitaiInner(raw: Record<string, unknown>): Record<string, unknown> {
  const block = raw.meta;
  if (!block || typeof block !== "object") return {};
  const inner = (block as Record<string, unknown>).meta;
  return inner && typeof inner === "object" ? (inner as Record<string, unknown>) : {};
}

export function looksLikeCivitaiExport(raw: Record<string, unknown>): boolean {
  const inner = extractCivitaiInner(raw);
  if (!inner || Object.keys(inner).length === 0) return false;
  return Boolean(
    inner.prompt != null || inner.civitaiResources || inner.resources,
  );
}

export function looksLikeDirectJob(raw: Record<string, unknown>): boolean {
  return typeof raw.model === "string" && typeof raw.params === "object" && raw.params !== null;
}

function stripNonGenerationKeys(d: Record<string, unknown>): Record<string, unknown> {
  const out = { ...d };
  for (const k of [
    "schema",
    "metaFormat",
    "format",
    "meta",
    "url",
    "hash",
    "stats",
    "username",
    "createdAt",
    "nsfw",
    "type",
    "postId",
  ]) {
    delete out[k];
  }
  return out;
}

export function extractCustomFlat(raw: Record<string, unknown>): Record<string, unknown> {
  const base = stripNonGenerationKeys(
    typeof raw.generation === "object" && raw.generation !== null
      ? { ...(raw.generation as Record<string, unknown>) }
      : { ...raw },
  );

  if ("negative_prompt" in base && base.negativePrompt === undefined) {
    base.negativePrompt = base.negative_prompt;
    delete base.negative_prompt;
  }
  if (base.sampler == null && base.scheduler != null) {
    base.sampler = base.scheduler;
  }
  if (!base.civitaiResources && Array.isArray(base.resources)) {
    base.civitaiResources = base.resources;
  }
  return base;
}

export function parseMeta(raw: Record<string, unknown>, fmt: MetaFormat = "auto"): ParsedMeta {
  if (fmt === "direct" || (fmt === "auto" && looksLikeDirectJob(raw))) {
    if (!looksLikeDirectJob(raw)) {
      throw new Error("direct format requires string 'model' (AIR URN) and object 'params'.");
    }
    const job: Record<string, unknown> = {
      model: raw.model,
      params: { ...(raw.params as Record<string, unknown>) },
    };
    if (typeof raw.baseModel === "string" && (raw.baseModel === "SDXL" || raw.baseModel === "SD_1_5")) {
      job.baseModel = raw.baseModel;
    }
    if (raw.additionalNetworks && typeof raw.additionalNetworks === "object") {
      job.additionalNetworks = { ...(raw.additionalNetworks as Record<string, unknown>) };
    }
    if (Array.isArray(raw.controlNets)) job.controlNets = [...raw.controlNets];
    if (typeof raw.callbackUrl === "string") job.callbackUrl = raw.callbackUrl;
    return { kind: "direct_job", job };
  }

  if (fmt === "civitai") {
    const inner = extractCivitaiInner(raw);
    if (
      !inner ||
      !(
        inner.prompt != null ||
        inner.civitaiResources ||
        inner.resources
      )
    ) {
      throw new Error(
        "civitai format: expected meta.meta with prompt and/or civitaiResources (Civitai image export).",
      );
    }
    return { kind: "inner", inner };
  }

  if (fmt === "custom") {
    const inner = extractCustomFlat(raw);
    if (!inner || Object.keys(inner).length === 0) {
      throw new Error("custom format: empty generation block.");
    }
    return { kind: "inner", inner };
  }

  if (looksLikeDirectJob(raw)) {
    return parseMeta(raw, "direct");
  }
  if (looksLikeCivitaiExport(raw)) {
    return { kind: "inner", inner: extractCivitaiInner(raw) };
  }

  const inner = extractCustomFlat(raw);
  if (!inner.prompt && !inner.civitaiResources && !inner.resources) {
    throw new Error(
      "Could not detect format (auto): use --format civitai|custom|direct, or provide " +
        "Civitai export with meta.meta, or custom JSON with prompt/civitaiResources, " +
        "or direct job with model + params.",
    );
  }
  return { kind: "inner", inner };
}
