import { NextResponse } from "next/server";
import { applyKeysEnvToProcess } from "@/lib/sdk/token-file";
import {
  mergeAppLlmConfigPatch,
  resolvedAppLlmConfigForApi,
  saveAppLlmConfig,
} from "@/lib/game/application/app-config";

const PATCH_KEYS = new Set([
  "llmBackend",
  "openrouterModel",
  "openaiModel",
  "openaiBaseUrl",
  "ollamaModel",
  "ollamaBaseUrl",
  "temperature",
  "maxTokens",
  "repairTemperature",
  "topP",
  "topK",
  "frequencyPenalty",
  "presencePenalty",
  "repetitionPenalty",
  "providerSort",
  "providerDataCollection",
  "providerAllowFallbacks",
]);

function sanitizePatch(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!PATCH_KEYS.has(k)) continue;
    if (v === null) {
      out[k] = null;
      continue;
    }
    if (k === "llmBackend" && typeof v === "string") {
      const s = v.toLowerCase().trim();
      if (["mock", "openai", "openrouter", "open_router", "ollama"].includes(s)) {
        out[k] = s === "open_router" ? "openrouter" : s;
      }
      continue;
    }
    if (
      (k === "openrouterModel" || k === "openaiModel" || k === "ollamaModel" || k === "openaiBaseUrl" || k === "ollamaBaseUrl") &&
      typeof v === "string"
    ) {
      const s = v.trim();
      out[k] = s.length ? s : null;
      continue;
    }
    if (
      k === "temperature" ||
      k === "repairTemperature" ||
      k === "topP" ||
      k === "topK" ||
      k === "frequencyPenalty" ||
      k === "presencePenalty" ||
      k === "repetitionPenalty"
    ) {
      if (typeof v === "number" && !Number.isNaN(v)) out[k] = v;
      else if (typeof v === "string" && v.trim()) {
        const n = Number(v);
        if (!Number.isNaN(n)) out[k] = n;
      }
      continue;
    }
    if (k === "maxTokens") {
      if (typeof v === "number" && !Number.isNaN(v)) out[k] = Math.floor(v);
      else if (typeof v === "string" && v.trim()) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n)) out[k] = n;
      }
      continue;
    }
    if (k === "providerSort" && (v === "price" || v === "throughput" || v === "latency")) {
      out[k] = v;
      continue;
    }
    if (k === "providerDataCollection" && (v === "allow" || v === "deny")) {
      out[k] = v;
      continue;
    }
    if (k === "providerAllowFallbacks" && typeof v === "boolean") {
      out[k] = v;
      continue;
    }
  }
  return out;
}

export async function GET() {
  applyKeysEnvToProcess();
  return NextResponse.json(resolvedAppLlmConfigForApi());
}

export async function PATCH(req: Request) {
  applyKeysEnvToProcess();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const patch = sanitizePatch(body);
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields to patch" }, { status: 400 });
  }
  const merged = mergeAppLlmConfigPatch(patch);
  if (typeof merged.maxTokens === "number" && (merged.maxTokens < 1 || merged.maxTokens > 200_000)) {
    return NextResponse.json({ error: "maxTokens must be between 1 and 200000" }, { status: 400 });
  }
  if (typeof merged.temperature === "number" && (merged.temperature < 0 || merged.temperature > 2)) {
    return NextResponse.json({ error: "temperature must be between 0 and 2" }, { status: 400 });
  }
  if (
    typeof merged.repairTemperature === "number" &&
    (merged.repairTemperature < 0 || merged.repairTemperature > 2)
  ) {
    return NextResponse.json({ error: "repairTemperature must be between 0 and 2" }, { status: 400 });
  }
  if (typeof merged.topP === "number" && (merged.topP < 0 || merged.topP > 1)) {
    return NextResponse.json({ error: "topP must be between 0 and 1" }, { status: 400 });
  }
  if (typeof merged.topK === "number" && (merged.topK < 1 || merged.topK > 200)) {
    return NextResponse.json({ error: "topK must be between 1 and 200" }, { status: 400 });
  }
  if (
    typeof merged.frequencyPenalty === "number" &&
    (merged.frequencyPenalty < -2 || merged.frequencyPenalty > 2)
  ) {
    return NextResponse.json({ error: "frequencyPenalty must be between -2 and 2" }, { status: 400 });
  }
  if (
    typeof merged.presencePenalty === "number" &&
    (merged.presencePenalty < -2 || merged.presencePenalty > 2)
  ) {
    return NextResponse.json({ error: "presencePenalty must be between -2 and 2" }, { status: 400 });
  }
  if (
    typeof merged.repetitionPenalty === "number" &&
    (merged.repetitionPenalty < 0.5 || merged.repetitionPenalty > 2.5)
  ) {
    return NextResponse.json({ error: "repetitionPenalty must be between 0.5 and 2.5" }, { status: 400 });
  }
  saveAppLlmConfig(merged);
  return NextResponse.json(resolvedAppLlmConfigForApi());
}
