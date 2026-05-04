import fs from "fs";
import path from "path";
import { dataRoot } from "@/lib/paths";
import type { AppLlmConfig, AppLlmConfigResponse } from "@/lib/game/contracts/app-config";

export type { AppLlmConfig, AppLlmConfigResponse } from "@/lib/game/contracts/app-config";

const DEFAULT_LLM_MAX_TOKENS = 32768;

function appConfigPath(): string {
  return path.join(dataRoot(), "game", "app-config.json");
}

export function loadAppLlmConfig(): AppLlmConfig {
  const p = appConfigPath();
  if (!fs.existsSync(p)) return {};
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object" || Array.isArray(j)) return {};
    return j as AppLlmConfig;
  } catch {
    return {};
  }
}

function ensureGameDir(): void {
  fs.mkdirSync(path.join(dataRoot(), "game"), { recursive: true });
}

/** Replace entire stored LLM config (caller should merge first). */
export function saveAppLlmConfig(cfg: AppLlmConfig): void {
  ensureGameDir();
  const p = appConfigPath();
  const tmp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(cfg, null, 2)}\n`, "utf-8");
  fs.renameSync(tmp, p);
}

/**
 * Shallow-merge patch into stored config. Use `null` in patch to remove a key.
 */
export function mergeAppLlmConfigPatch(patch: Record<string, unknown>): AppLlmConfig {
  const cur = loadAppLlmConfig();
  const out: Record<string, unknown> = { ...cur };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else if (v !== undefined) out[k] = v;
  }
  return out as AppLlmConfig;
}

/** Env-only max completion tokens (no app-config override). */
export function maxTokensFromEnv(): number {
  const v = parseInt(process.env.LLM_MAX_TOKENS ?? String(DEFAULT_LLM_MAX_TOKENS), 10);
  if (Number.isNaN(v) || v < 1) return DEFAULT_LLM_MAX_TOKENS;
  return v;
}

/** App-config `maxTokens` if valid, else env default. */
export function resolvedMaxTokensBudget(): number {
  const app = loadAppLlmConfig();
  const n = app.maxTokens;
  if (typeof n === "number" && !Number.isNaN(n) && n >= 1) return Math.floor(n);
  return maxTokensFromEnv();
}

/** Primary narrative temperature: app-config or default 0.9. */
export function resolvedPrimaryTemperature(): number {
  const app = loadAppLlmConfig();
  const t = app.temperature;
  if (typeof t === "number" && !Number.isNaN(t)) return Math.min(2, Math.max(0, t));
  return 0.9;
}

/** JSON 修复重试温度：app-config 或默认 0.65 */
export function resolvedRepairTemperature(): number {
  const app = loadAppLlmConfig();
  const t = app.repairTemperature;
  if (typeof t === "number" && !Number.isNaN(t)) return Math.min(2, Math.max(0, t));
  return 0.65;
}

/** GET /api/game/app-config — merged defaults for UI (no secrets). */
export function resolvedAppLlmConfigForApi(): AppLlmConfigResponse {
  const app = loadAppLlmConfig();
  const token = (process.env.OPEN_ROUTER_TOKEN ?? "").trim();
  const openaiKey = (process.env.OPENAI_API_KEY ?? "").trim();
  return {
    ...app,
    llmBackend: (app.llmBackend ?? process.env.LLM_BACKEND ?? "mock").toLowerCase().trim(),
    openrouterModel: (app.openrouterModel ?? process.env.OPENROUTER_MODEL ?? "x-ai/grok-4-fast").trim(),
    openaiModel: (app.openaiModel ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini").trim(),
    openaiBaseUrl: (app.openaiBaseUrl ?? process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").trim(),
    ollamaModel: (app.ollamaModel ?? process.env.OLLAMA_MODEL ?? "qwen2:7b").trim(),
    ollamaBaseUrl: (app.ollamaBaseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://localhost:11434").trim(),
    temperature: app.temperature ?? 0.9,
    repairTemperature: app.repairTemperature ?? 0.65,
    maxTokens: app.maxTokens ?? maxTokensFromEnv(),
    topP: app.topP,
    topK: app.topK,
    frequencyPenalty: app.frequencyPenalty,
    presencePenalty: app.presencePenalty,
    repetitionPenalty: app.repetitionPenalty,
    providerSort: app.providerSort,
    providerDataCollection: app.providerDataCollection ?? "allow",
    providerAllowFallbacks: app.providerAllowFallbacks ?? true,
    hasOpenRouterToken: Boolean(token),
    hasOpenAIApiKey: Boolean(openaiKey),
  };
}
