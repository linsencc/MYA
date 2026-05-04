import { OpenRouter } from "@openrouter/sdk";
import OpenAI from "openai";
import {
  approxMessageChars,
  pipelineLog,
  pipelineWarn,
  rawSuffixForLog,
  type PipelineAttempt,
} from "@/lib/game/adapters/llm-pipeline-log";
import type { AppLlmConfig } from "@/lib/game/application/app-config";
import { loadAppLlmConfig, resolvedMaxTokensBudget } from "@/lib/game/application/app-config";

export type ChatMessage = { role: string; content: string };

/** LLM.chat 可选参数（叙事引擎传入 pipelineAttempt 以区分首轮 / 紧凑重试） */
export type LlmChatOptions = { temperature?: number; pipelineAttempt?: PipelineAttempt };

export interface BaseLLM {
  readonly label: string;
  chat(messages: ChatMessage[], options?: LlmChatOptions): Promise<string>;
}

const MOCK_SCRIPT: Record<string, unknown>[] = [
  {
    text:
      "陈老师放下手中的试卷，走到你旁边坐下，" +
      "食指点着卷面上密密麻麻的解题步骤。\n\n" +
      "「这道题的关键在这里——」她的声音变得专注，" +
      "头微微侧过来，淡淡的香气混在粉笔气味里。",
    narration: "这道题确实难……他能来问，说明没放弃。还算用功。",
    choices: ["认真听讲", "「老师，这里我还是不懂……」", "悄悄看她的侧脸", "假装没听懂再问一遍"],
    cg_trigger: false,
    cg_explicit: false,
    cg_scene: "",
    affection_delta: 5,
    trust_delta: 2,
    intimacy_delta: 3,
    desire_delta: 1,
    mood: "专注",
  },
  {
    text:
      "她察觉到你的目光，微微顿了一下，随即若无其事地收回视线，" +
      "清了清嗓子。\n\n" +
      "「专心。」\n\n" +
      "但耳尖似乎有一点点红。",
    narration: "心跳怎么快了？不行，不能被他发现。快把视线移开。",
    choices: ["「对不起。」", "继续看她", "「老师，您今天很漂亮。」", "轻轻握住她放在桌上的手"],
    cg_trigger: true,
    cg_explicit: false,
    cg_scene:
      "sitting beside student at desk, pointing at paper, " +
      "head slightly turned, slight blush on ear, " +
      "close shot, warm afternoon light, bokeh",
    affection_delta: 10,
    trust_delta: 3,
    intimacy_delta: 5,
    desire_delta: 5,
    mood: "害羞",
  },
  {
    text:
      "「你……」她把笔盖拧上，站起来，" +
      "整了整衬衫的领口，恢复了那副一丝不苟的表情。\n\n" +
      "「下次这种题目自己先做三遍再来问我。」\n\n" +
      "说罢转身去拎包，但嘴角微微弯了一下。",
    narration: "嘴角是不是弯了？算了，他看不到背影。今天……还挺有趣的。",
    choices: ["「好，谢谢老师！」", "「老师明天还能找您吗？」", "默默收拾书包", "拉住她的衣角"],
    cg_trigger: false,
    cg_explicit: false,
    cg_scene: "",
    affection_delta: 8,
    trust_delta: 5,
    intimacy_delta: 2,
    desire_delta: 0,
    mood: "温柔",
  },
  {
    text:
      "她愣了一下，没想到你会这样大胆。\n\n" +
      "教室里只剩你们两个人，夕阳把她的影子拉得很长。\n" +
      "「……放开。」她的声音不如以往那般坚定。",
    narration: "我应该直接把手甩开的——可是为什么没有……心跳好快，这种感觉很危险。",
    choices: ["顺从地松开手", "「对不起老师。」", "反而握得更紧", "「老师，我能送您回家吗？」"],
    cg_trigger: true,
    cg_explicit: false,
    cg_scene:
      "standing in empty classroom at sunset, student holding skirt hem from behind, " +
      "she turned slightly, conflicted expression, soft blush, " +
      "long golden shadow on floor, cinematic wide shot",
    affection_delta: 3,
    trust_delta: -2,
    intimacy_delta: 8,
    desire_delta: 10,
    mood: "动摇",
  },
];

function mergeAppLlmCfg(override?: AppLlmConfig): AppLlmConfig {
  return { ...loadAppLlmConfig(), ...override };
}

/** OpenAI Chat Completions：top_p / penalties，未配置则不传 */
function openAiSamplingFromDisk(): {
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
} {
  const app = loadAppLlmConfig();
  const o: {
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
  } = {};
  if (typeof app.topP === "number" && !Number.isNaN(app.topP) && app.topP >= 0 && app.topP <= 1) {
    o.top_p = app.topP;
  }
  if (typeof app.frequencyPenalty === "number" && !Number.isNaN(app.frequencyPenalty)) {
    const v = app.frequencyPenalty;
    if (v >= -2 && v <= 2) o.frequency_penalty = v;
  }
  if (typeof app.presencePenalty === "number" && !Number.isNaN(app.presencePenalty)) {
    const v = app.presencePenalty;
    if (v >= -2 && v <= 2) o.presence_penalty = v;
  }
  return o;
}

/** OpenRouter ChatRequest 驼峰字段 */
function openRouterSamplingFromDisk(): {
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
} {
  const app = loadAppLlmConfig();
  const o: { topP?: number; frequencyPenalty?: number; presencePenalty?: number } = {};
  if (typeof app.topP === "number" && !Number.isNaN(app.topP) && app.topP >= 0 && app.topP <= 1) {
    o.topP = app.topP;
  }
  if (typeof app.frequencyPenalty === "number" && !Number.isNaN(app.frequencyPenalty)) {
    const v = app.frequencyPenalty;
    if (v >= -2 && v <= 2) o.frequencyPenalty = v;
  }
  if (typeof app.presencePenalty === "number" && !Number.isNaN(app.presencePenalty)) {
    const v = app.presencePenalty;
    if (v >= -2 && v <= 2) o.presencePenalty = v;
  }
  return o;
}

/** Ollama /api/chat options 扩展字段 */
function ollamaExtraOptionsFromDisk(): Record<string, number> {
  const app = loadAppLlmConfig();
  const ex: Record<string, number> = {};
  if (typeof app.topP === "number" && !Number.isNaN(app.topP) && app.topP >= 0 && app.topP <= 1) {
    ex.top_p = app.topP;
  }
  if (typeof app.topK === "number" && !Number.isNaN(app.topK) && app.topK >= 1 && app.topK <= 200) {
    ex.top_k = Math.floor(app.topK);
  }
  if (typeof app.repetitionPenalty === "number" && !Number.isNaN(app.repetitionPenalty)) {
    const v = app.repetitionPenalty;
    if (v >= 0.5 && v <= 2.5) ex.repeat_penalty = v;
  }
  if (typeof app.frequencyPenalty === "number" && !Number.isNaN(app.frequencyPenalty)) {
    const v = app.frequencyPenalty;
    if (v >= -2 && v <= 2) ex.frequency_penalty = v;
  }
  if (typeof app.presencePenalty === "number" && !Number.isNaN(app.presencePenalty)) {
    const v = app.presencePenalty;
    if (v >= -2 && v <= 2) ex.presence_penalty = v;
  }
  return ex;
}

/** 当前单轮 completion token 上限（读 `app-config.json` 与 `LLM_MAX_TOKENS`） */
export function getLlmMaxTokensBudget(): number {
  return resolvedMaxTokensBudget();
}

export class MockLLM implements BaseLLM {
  label = "MockLLM";
  private idx = 0;

  async chat(messages: ChatMessage[], options?: LlmChatOptions): Promise<string> {
    void messages;
    const attempt = options?.pipelineAttempt ?? "mock";
    const budget = getLlmMaxTokensBudget();
    const sampling = openAiSamplingFromDisk();
    pipelineLog("03_llm_request", {
      backend: "mock",
      attempt,
      model: "mock-script",
      max_tokens_requested: budget,
      messages_count: messages.length,
      approx_context_chars: approxMessageChars(messages),
      temperature: options?.temperature ?? 0.9,
      ...(Object.keys(sampling).length ? { sampling_json: JSON.stringify(sampling) } : {}),
    });
    const entry = MOCK_SCRIPT[this.idx % MOCK_SCRIPT.length];
    this.idx += 1;
    const raw = JSON.stringify(entry);
    pipelineLog("04_llm_response", {
      backend: "mock",
      attempt,
      finish_reason: "stop",
      max_tokens_requested: budget,
      response_chars: raw.length,
      truncated: false,
      tail: rawSuffixForLog(raw),
    });
    return raw;
  }
}

export class OpenAILLM implements BaseLLM {
  label = "OpenAILLM";
  private client: OpenAI;
  private model: string;

  constructor(app: AppLlmConfig = {}) {
    const baseUrl = (app.openaiBaseUrl ?? "").trim() || (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1");
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? "",
      baseURL: baseUrl,
    });
    this.model = (app.openaiModel ?? "").trim() || (process.env.OPENAI_MODEL ?? "gpt-4o-mini");
  }

  async chat(messages: ChatMessage[], options?: LlmChatOptions): Promise<string> {
    const budget = getLlmMaxTokensBudget();
    const attempt = options?.pipelineAttempt ?? "primary";
    const sampling = openAiSamplingFromDisk();
    pipelineLog("03_llm_request", {
      backend: "openai",
      attempt,
      model: this.model,
      max_tokens_requested: budget,
      messages_count: messages.length,
      approx_context_chars: approxMessageChars(messages),
      temperature: options?.temperature ?? 0.9,
      response_format: "json_object",
      ...(Object.keys(sampling).length ? { sampling_json: JSON.stringify(sampling) } : {}),
    });
    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      temperature: options?.temperature ?? 0.9,
      response_format: { type: "json_object" },
      max_tokens: budget,
      ...sampling,
    });
    const ch = resp.choices[0];
    const raw = ch?.message?.content ?? "{}";
    const fr = ch?.finish_reason ?? "unknown";
    const usage = resp.usage;
    const fields = {
      backend: "openai",
      attempt,
      model: this.model,
      finish_reason: fr,
      max_tokens_requested: budget,
      response_chars: raw.length,
      prompt_tokens: usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
      total_tokens: usage?.total_tokens,
      truncated: fr === "length",
      tail: rawSuffixForLog(raw),
    };
    pipelineLog("04_llm_response", fields);
    if (fr === "length") {
      pipelineWarn("04_llm_TRUNCATED_by_provider", {
        ...fields,
        hint: "completion hit max_tokens or provider cap — check completion_tokens vs max_tokens_requested",
      });
    } else if (fr === "content_filter") {
      pipelineWarn("04_llm_CONTENT_FILTER", fields);
    } else if (fr !== "stop") {
      pipelineWarn("04_llm_UNEXPECTED_FINISH", fields);
    }
    return raw;
  }
}

export class OpenRouterLLM implements BaseLLM {
  private client: OpenRouter;
  private model: string;
  private readonly app: AppLlmConfig;

  constructor(app: AppLlmConfig = {}) {
    this.app = app;
    const apiKey = (process.env.OPEN_ROUTER_TOKEN ?? "").trim();
    if (!apiKey) {
      throw new Error("OPEN_ROUTER_TOKEN is not set in .keys");
    }
    this.client = new OpenRouter({ apiKey });
    this.model =
      (app.openrouterModel ?? "").trim() || (process.env.OPENROUTER_MODEL ?? "x-ai/grok-4-fast");
  }

  get label(): string {
    const short = this.model.includes("/") ? this.model.split("/").pop()! : this.model;
    return `OpenRouterLLM(${short})`;
  }

  async chat(messages: ChatMessage[], options?: LlmChatOptions): Promise<string> {
    const chatMessages = messages.map((m) => {
      if (m.role === "system") return { role: "system" as const, content: m.content };
      if (m.role === "user") return { role: "user" as const, content: m.content };
      return { role: "assistant" as const, content: m.content };
    });

    const budget = getLlmMaxTokensBudget();
    const attempt = options?.pipelineAttempt ?? "primary";
    const sampling = openRouterSamplingFromDisk();
    pipelineLog("03_llm_request", {
      backend: "openrouter",
      attempt,
      model: this.model,
      max_tokens_requested: budget,
      messages_count: messages.length,
      approx_context_chars: approxMessageChars(messages),
      temperature: options?.temperature ?? 0.9,
      response_format: "json_object",
      reasoning_effort: "none",
      ...(Object.keys(sampling).length ? { sampling_json: JSON.stringify(sampling) } : {}),
    });
    const temp = options?.temperature ?? 0.9;
    const chatRequest: Record<string, unknown> = {
      model: this.model,
      messages: chatMessages,
      temperature: temp,
      maxTokens: budget,
      responseFormat: { type: "json_object" },
      reasoning: { effort: "none" },
      ...sampling,
    };
    const sort = this.app.providerSort;
    const dc = this.app.providerDataCollection;
    const fb = this.app.providerAllowFallbacks;
    if (sort !== undefined || dc !== undefined || typeof fb === "boolean") {
      chatRequest.provider = {
        ...(sort ? { sort } : {}),
        ...(dc ? { data_collection: dc } : {}),
        ...(typeof fb === "boolean" ? { allow_fallbacks: fb } : {}),
      };
    }
    const result = await this.client.chat.send({
      chatRequest: chatRequest as never,
    });

    const choice0 = result.choices[0];
    const content = choice0?.message?.content;
    const fr = choice0?.finishReason ?? "unknown";
    const chars = typeof content === "string" ? content.length : 0;
    const raw = typeof content === "string" ? content : "{}";
    const ru = result as Record<string, unknown>;
    const usage = ru.usage as
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      | undefined;
    const fields = {
      backend: "openrouter",
      attempt,
      model: this.model,
      finish_reason: fr,
      max_tokens_requested: budget,
      response_chars: chars,
      content_type: typeof content,
      prompt_tokens: usage?.prompt_tokens,
      completion_tokens: usage?.completion_tokens,
      total_tokens: usage?.total_tokens,
      truncated: fr === "length",
      tail: rawSuffixForLog(raw),
    };
    pipelineLog("04_llm_response", fields);
    if (fr === "length") {
      pipelineWarn("04_llm_TRUNCATED_by_provider", {
        ...fields,
        hint: "OpenRouter/model may cap output below request — compare completion_tokens to model max output",
      });
    } else if (fr === "content_filter") {
      pipelineWarn("04_llm_CONTENT_FILTER", fields);
    } else if (fr !== "stop") {
      pipelineWarn("04_llm_UNEXPECTED_FINISH", fields);
    }
    if (typeof content === "string") return content;
    pipelineWarn("04_llm_EMPTY_CONTENT", { backend: "openrouter", attempt, finish_reason: fr });
    return "{}";
  }
}

export class OllamaLLM implements BaseLLM {
  label = "OllamaLLM";
  private model: string;
  private baseUrl: string;

  constructor(app: AppLlmConfig = {}) {
    this.model = (app.ollamaModel ?? "").trim() || (process.env.OLLAMA_MODEL ?? "qwen2:7b");
    const url =
      (app.ollamaBaseUrl ?? "").trim() || (process.env.OLLAMA_BASE_URL ?? "http://localhost:11434");
    this.baseUrl = url.replace(/\/$/, "");
  }

  async chat(messages: ChatMessage[], options?: LlmChatOptions): Promise<string> {
    const budget = getLlmMaxTokensBudget();
    const attempt = options?.pipelineAttempt ?? "primary";
    const ollamaExtra = ollamaExtraOptionsFromDisk();
    pipelineLog("03_llm_request", {
      backend: "ollama",
      attempt,
      model: this.model,
      max_tokens_requested: budget,
      messages_count: messages.length,
      approx_context_chars: approxMessageChars(messages),
      temperature: options?.temperature ?? 0.9,
      num_predict: budget,
      format: "json",
      ...(Object.keys(ollamaExtra).length ? { sampling_json: JSON.stringify(ollamaExtra) } : {}),
    });
    const resp = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.9,
          num_predict: budget,
          ...ollamaExtra,
        },
        format: "json",
      }),
    });
    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
    const data = (await resp.json()) as {
      message?: { content?: string };
      eval_count?: number;
      prompt_eval_count?: number;
      done?: boolean;
    };
    const raw = data.message?.content ?? "{}";
    pipelineLog("04_llm_response", {
      backend: "ollama",
      attempt,
      model: this.model,
      finish_reason: data.done === false ? "unknown" : "done",
      max_tokens_requested: budget,
      response_chars: raw.length,
      eval_count: data.eval_count,
      prompt_eval_count: data.prompt_eval_count,
      tail: rawSuffixForLog(raw),
    });
    return raw;
  }
}

export function makeLlm(override?: AppLlmConfig): BaseLLM {
  const app = mergeAppLlmCfg(override);
  const name = (app.llmBackend ?? process.env.LLM_BACKEND ?? "mock").toLowerCase().trim();
  if (name === "mock") return new MockLLM();
  if (name === "openai") return new OpenAILLM(app);
  if (name === "openrouter" || name === "open_router") {
    const apiKey = (process.env.OPEN_ROUTER_TOKEN ?? "").trim();
    if (!apiKey) {
      console.warn(
        "[makeLlm] LLM_BACKEND=openrouter but OPEN_ROUTER_TOKEN is empty — using MockLLM so the game can start offline.",
      );
      return new MockLLM();
    }
    return new OpenRouterLLM(app);
  }
  if (name === "ollama") return new OllamaLLM(app);
  throw new Error(`Unknown LLM_BACKEND=${name}. Choose: mock, openai, openrouter, ollama`);
}
