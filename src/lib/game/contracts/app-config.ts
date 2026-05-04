/** 持久化于 `data/game/app-config.json`；覆盖 `process.env` / defaults */
export type AppLlmConfig = {
  llmBackend?: string;
  openrouterModel?: string;
  /** OpenAI 兼容 API 的模型 id（如 gpt-4o-mini） */
  openaiModel?: string;
  /** 覆盖 `OPENAI_BASE_URL`（可选） */
  openaiBaseUrl?: string;
  /** Ollama 本地模型名 */
  ollamaModel?: string;
  /** Ollama 服务根地址，如 http://localhost:11434 */
  ollamaBaseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  repetitionPenalty?: number;
  /** JSON 解析失败后的紧凑重试温度，默认 0.65 */
  repairTemperature?: number;
  providerSort?: "price" | "throughput" | "latency";
  providerDataCollection?: "allow" | "deny";
  providerAllowFallbacks?: boolean;
};

export type AppLlmConfigResponse = AppLlmConfig & {
  hasOpenRouterToken: boolean;
  hasOpenAIApiKey: boolean;
};
