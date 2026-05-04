import fs from "fs";
import path from "path";
import { ApiError, Civitai, OpenAPI } from "civitai";
import { ensureApiToken, normalizeSecretValue } from "@/lib/sdk/token-file";

const CIVITAI_REST_BASE = "https://civitai.com/api/v1";

/** 单次编排 HTTP / SDK 失败记录（供日志与工单）。 */
export type CivitaiOrchestrationFailureAttempt = {
  phase: "submit" | "sdk" | "poll";
  host: string;
  /** 0 表示未拿到 HTTP 响应（连接失败等）。 */
  httpStatus: number;
  detail: string;
};

/**
 * 编排服务持续返回 5xx 等：本仓库已用尽等价于 Python 的提交路径，仍无法建任务。
 * 调用方可用 `instanceof CivitaiOrchestrationUnavailableError` 与 `err.code` 明确区分「须 Civitai / 网络环境处理」。
 */
export class CivitaiOrchestrationUnavailableError extends Error {
  readonly code = "CIVITAI_ORCHESTRATION_UNAVAILABLE" as const;

  constructor(
    readonly attempts: readonly CivitaiOrchestrationFailureAttempt[],
    message: string,
  ) {
    super(message);
    this.name = "CivitaiOrchestrationUnavailableError";
  }
}

class OrchestrationHttpError extends Error {
  constructor(
    readonly host: string,
    readonly httpStatus: number,
    readonly bodySnippet: string,
  ) {
    super(`HTTP ${httpStatus} @ ${host}: ${bodySnippet.slice(0, 280)}`);
    this.name = "OrchestrationHttpError";
  }
}

export function blobUrlFromJob(job: Record<string, unknown>): string | null {
  const res = job.result as unknown;
  if (res && typeof res === "object" && !Array.isArray(res)) {
    const d = res as Record<string, unknown>;
    const url = d.blobUrl ?? d.url ?? d.imageUrl;
    if (typeof url === "string" && url.trim()) return url.trim();
    const nested = d.image ?? d.output;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      const n = nested as Record<string, unknown>;
      const u = n.blobUrl ?? n.url;
      if (typeof u === "string" && u.trim()) return u.trim();
    }
  }
  if (Array.isArray(res)) {
    for (const item of res) {
      if (item && typeof item === "object") {
        const d = item as Record<string, unknown>;
        if (d.available && d.blobUrl) return String(d.blobUrl);
      }
    }
    for (const item of res) {
      if (item && typeof item === "object") {
        const d = item as Record<string, unknown>;
        if (d.blobUrl) return String(d.blobUrl);
      }
    }
  }
  return null;
}

function normalizeResourceType(kind: string): string {
  const k = kind.trim().toLowerCase();
  const mapping: Record<string, string> = {
    checkpoint: "checkpoint",
    lora: "lora",
    locon: "locon",
    lycoris: "lycoris",
    textualinversion: "textualinversion",
    embedding: "textualinversion",
    hypernetwork: "hypernetwork",
    vae: "vae",
  };
  return mapping[k] ?? k;
}

export function ecosystemForBaseModel(baseModel: string | null | undefined): string {
  if (!baseModel) return "sdxl";
  const b = baseModel.trim();
  const lower = b.toLowerCase();
  if (lower.includes("sdxl") || lower.endsWith("xl")) return "sdxl";
  if (lower.includes("sd 2") || lower.includes("sd2") || b.includes("2.1")) return "sd2";
  if (lower.includes("sd 1") || b.includes("1.5") || lower === "sd1" || lower === "sd 1.5") {
    return "sd1";
  }
  const sdxlFamily = ["pony", "illustrious", "animagine", "noobai", "dream", "flux"];
  if (sdxlFamily.some((x) => lower.includes(x))) return "sdxl";
  console.warn(`Unknown baseModel ${JSON.stringify(baseModel)}; defaulting ecosystem to sdxl`);
  return "sdxl";
}

export function sdkNetworkType(resourceLower: string): string {
  const m: Record<string, string> = {
    lora: "Lora",
    locon: "LoCon",
    lycoris: "Lycoris",
    textualinversion: "TextualInversion",
    embedding: "TextualInversion",
    hypernetwork: "Hypernetwork",
    vae: "Vae",
    checkpoint: "Checkpoint",
  };
  return m[resourceLower] ?? "Lora";
}

/** Orchestration 仅支持 SDXL / SD_1_5；按 AIR ecosystem 对齐（npm SDK 曾仅用 `includes("sdxl")` 误判）。 */
export function orchestrationBaseModelFromAirUrn(urn: string): "SDXL" | "SD_1_5" {
  const m = /^urn:air:([^:]+):/i.exec(urn.trim());
  const eco = (m?.[1] ?? "").toLowerCase();
  const xlFamily = new Set(["sdxl", "flux", "sd3", "hunyuan", "playground"]);
  if (xlFamily.has(eco)) return "SDXL";
  return "SD_1_5";
}

const ORCH_PROD = "https://orchestration.civitai.com";
const ORCH_DEV = "https://orchestration-dev.civitai.com";

/** 与 npm `fromText` 一致的最小 envelope + 完整 job 字段（含 additionalNetworks.type，不经 zod 剥离）。 */
export function buildRawTextToImagePayload(job: Record<string, unknown>): Record<string, unknown> {
  const model = job.model;
  if (typeof model !== "string" || !model.includes("urn:air:")) {
    throw new Error("buildRawTextToImagePayload: model must be an AIR URN string");
  }
  const params = job.params as Record<string, unknown>;
  if (!params || typeof params !== "object") {
    throw new Error("buildRawTextToImagePayload: params object required");
  }
  let baseModel = job.baseModel;
  if (baseModel !== "SDXL" && baseModel !== "SD_1_5") {
    baseModel = orchestrationBaseModelFromAirUrn(model);
  }
  const body: Record<string, unknown> = {
    $type: "textToImage",
    baseModel,
    model,
    params: {
      ...params,
      prompt: String(params.prompt ?? ""),
      negativePrompt: String(params.negativePrompt ?? ""),
    },
  };
  const add = job.additionalNetworks;
  if (add && typeof add === "object" && !Array.isArray(add) && Object.keys(add).length) {
    body.additionalNetworks = JSON.parse(JSON.stringify(add)) as Record<string, unknown>;
  }
  if (Array.isArray(job.controlNets) && job.controlNets.length) body.controlNets = job.controlNets;
  if (typeof job.callbackUrl === "string" && job.callbackUrl.trim()) body.callbackUrl = job.callbackUrl.trim();
  if (typeof job.quantity === "number") body.quantity = job.quantity;
  if (typeof job.batchSize === "number") body.batchSize = job.batchSize;
  return body;
}

export function buildAirUrn(parts: {
  ecosystem: string;
  resourceKind: string;
  modelId: number;
  versionId: number;
}): string {
  const kind = normalizeResourceType(parts.resourceKind);
  let airType: string = {
    checkpoint: "checkpoint",
    lora: "lora",
    locon: "lora",
    lycoris: "lora",
    textualinversion: "embedding",
    embedding: "embedding",
    hypernetwork: "hypernetwork",
    vae: "vae",
  }[kind] ?? "lora";
  if (kind === "locon" || kind === "lycoris") airType = "lora";
  let eco = parts.ecosystem.trim().toLowerCase();
  if (!["sd1", "sd2", "sdxl"].includes(eco)) eco = "sdxl";
  return `urn:air:${eco}:${airType}:civitai:${parts.modelId}@${parts.versionId}`;
}

/** Strip keys disallowed by civitai npm zod schema (strict additionalNetworks). */
export function jobInputForJsSdk(job: Record<string, unknown>): Record<string, unknown> {
  const params = job.params as Record<string, unknown>;
  const out: Record<string, unknown> = {
    model: job.model,
    params: { ...params },
  };
  if (typeof job.baseModel === "string" && (job.baseModel === "SDXL" || job.baseModel === "SD_1_5")) {
    out.baseModel = job.baseModel;
  }
  const add = job.additionalNetworks as Record<string, Record<string, unknown>> | undefined;
  if (add && typeof add === "object") {
    const nets: Record<string, { strength?: number; triggerWord?: string }> = {};
    for (const [k, v] of Object.entries(add)) {
      if (!v || typeof v !== "object") continue;
      const e: { strength?: number; triggerWord?: string } = {};
      if (typeof v.strength === "number") e.strength = v.strength;
      if (typeof v.triggerWord === "string") e.triggerWord = v.triggerWord;
      nets[k] = e;
    }
    if (Object.keys(nets).length) out.additionalNetworks = nets;
  }
  if (Array.isArray(job.controlNets)) out.controlNets = job.controlNets;
  if (typeof job.callbackUrl === "string") out.callbackUrl = job.callbackUrl;
  return out;
}

export class CivitaiClient {
  readonly token: string;
  readonly restBase: string;
  readonly modelVersionCacheDir: string | null;
  private _civ: InstanceType<typeof Civitai> | null = null;
  /** 成功提交 consumer jobs 的编排 origin（轮询必须与之一致）。 */
  private activeOrchBase: string | null = null;

  constructor(options: {
    token?: string | null;
    keyPath?: string | null;
    restBase?: string;
    modelVersionCacheDir?: string | null;
  } = {}) {
    ensureApiToken();
    if (options.keyPath) {
      this.token = normalizeSecretValue(fs.readFileSync(options.keyPath, "utf-8"));
    } else {
      this.token = (options.token ?? process.env.CIVITAI_API_TOKEN ?? "").trim();
    }
    if (!this.token) {
      throw new Error(`Missing API token: set CIVITAI_API_TOKEN or add .keys at repo root.`);
    }
    this.restBase = (options.restBase ?? CIVITAI_REST_BASE).replace(/\/$/, "");
    this.modelVersionCacheDir = options.modelVersionCacheDir ?? null;
  }

  /**
   * 编排 API origin 列表。
   * - CIVITAI_ORCHESTRATION_BASE：只使用该地址
   * - CIVITAI_ORCHESTRATION_ENV=dev：仅 dev
   * - 默认：生产 → dev 自动回退（CIVITAI_ORCHESTRATION_AUTO_FALLBACK=0|false|off 可关闭）
   */
  private orchestrationBaseCandidates(): string[] {
    const b = process.env.CIVITAI_ORCHESTRATION_BASE?.trim();
    if (b) return [b.replace(/\/$/, "")];
    if (process.env.CIVITAI_ORCHESTRATION_ENV?.trim().toLowerCase() === "dev") {
      return [ORCH_DEV];
    }
    const nofb = process.env.CIVITAI_ORCHESTRATION_AUTO_FALLBACK?.trim().toLowerCase();
    if (nofb === "0" || nofb === "false" || nofb === "off") {
      return [ORCH_PROD];
    }
    return [ORCH_PROD, ORCH_DEV];
  }

  private syncOpenApiForOrchestration(base: string): void {
    const root = base.replace(/\/$/, "");
    OpenAPI.BASE = root;
    const ua =
      process.env.CIVITAI_HTTP_USER_AGENT?.trim() ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MyA/1.0";
    OpenAPI.HEADERS = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/json",
      "User-Agent": ua,
    };
  }

  private lazyCiv(): InstanceType<typeof Civitai> {
    if (!this._civ) {
      this._civ = new Civitai({ auth: this.token, env: "production" });
      this.syncOpenApiForOrchestration(this.orchestrationBaseCandidates()[0]);
    }
    return this._civ;
  }

  /** 4xx：本机配置/权限/参数问题，不是「服务端全挂」。 */
  private static throwIfOrchestrationClientHttp(host: string, status: number, detail: string): never {
    const snip = detail.slice(0, 480);
    if (status === 401) {
      throw new Error(
        `Civitai 编排返回 HTTP 401：当前 CIVITAI_API_TOKEN 对该环境无效或未授权云端出图。请核对仓库根目录 .keys，并在 https://civitai.com/user/account 确认 API Key。主机 ${host}。响应：${snip}`,
      );
    }
    if (status === 403) {
      throw new Error(
        `Civitai 编排返回 HTTP 403（拒绝访问）。主机 ${host}。响应：${snip}`,
      );
    }
    if (status === 400 || status === 422) {
      throw new Error(
        `Civitai 编排拒绝请求体（HTTP ${status}）。主机 ${host}。响应：${snip}`,
      );
    }
    if (status === 402 || status === 429) {
      throw new Error(
        `Civitai 编排返回 HTTP ${status}（额度、计费或限流）。主机 ${host}。响应：${snip}`,
      );
    }
    throw new Error(`Civitai 编排返回 HTTP ${status}（客户端错误类）。主机 ${host}。响应：${snip}`);
  }

  private static throwForOrchestrationFailures(attempts: CivitaiOrchestrationFailureAttempt[]): never {
    const coded = attempts.filter((a) => a.httpStatus > 0);
    const allServer = coded.length > 0 && coded.every((a) => a.httpStatus >= 500);
    const allNetwork = attempts.length > 0 && attempts.every((a) => a.httpStatus === 0);

    if (allNetwork) {
      throw new Error(
        [
          "无法与 Civitai 编排服务建立 HTTP 连接（未收到有效 HTTP 状态，多见于 DNS、代理或防火墙）。",
          "这不是本仓库再改业务逻辑能解决的问题。",
          "记录：" + attempts.map((a) => `${a.host}: ${a.detail.slice(0, 160)}`).join(" | "),
        ].join("\n"),
      );
    }

    if (allServer) {
      const lines = attempts.map(
        (a) => `  · ${a.phase} ${a.host} HTTP ${a.httpStatus}: ${a.detail.slice(0, 220)}`,
      );
      throw new CivitaiOrchestrationUnavailableError(
        attempts,
        [
          "Civitai 编排 API 持续返回 HTTP 5xx。",
          "本应用已依次尝试：原始 HTTP（完整 additionalNetworks）、全部配置的编排域名、npm SDK；仍无法创建出图任务。",
          "结论：须由 Civitai 服务端或账号侧处理，本仓库无法继续修复。向官方工单提供 CF-RAY、UTC 时间、用户 id。",
          "",
          ...lines,
        ].join("\n"),
      );
    }

    throw new Error(
      [
        "Civitai 出图提交失败。",
        ...attempts.map(
          (a) => `${a.phase} ${a.host} HTTP ${a.httpStatus}: ${a.detail.slice(0, 260)}`,
        ),
      ].join("\n"),
    );
  }

  private async postJobsRaw(
    base: string,
    body: Record<string, unknown>,
    wait: boolean,
  ): Promise<Record<string, unknown>> {
    const root = base.replace(/\/$/, "");
    const qs = new URLSearchParams({ wait: String(wait), detailed: "false" });
    const url = `${root}/v1/consumer/jobs?${qs}`;
    const ua =
      process.env.CIVITAI_HTTP_USER_AGENT?.trim() ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MyA/1.0";
    let r: Response;
    try {
      r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": ua,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new OrchestrationHttpError(root, 0, `连接失败: ${msg}`);
    }
    const text = await r.text();
    if (!r.ok) {
      throw new OrchestrationHttpError(root, r.status, text);
    }
    try {
      return text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`提交响应非 JSON: ${text.slice(0, 240)}`);
    }
  }

  private normalizeSubmitResponse(raw: Record<string, unknown>): Record<string, unknown> {
    const token = raw.token;
    const jobs = raw.jobs;
    if (typeof token !== "string" || !token) {
      throw new Error(`响应缺少 token: ${JSON.stringify(raw).slice(0, 400)}`);
    }
    if (!Array.isArray(jobs)) {
      throw new Error(`响应缺少 jobs 数组: ${JSON.stringify(raw).slice(0, 400)}`);
    }
    return {
      token,
      jobs: jobs.map((j) => {
        const job = j as Record<string, unknown>;
        return {
          jobId: job.jobId,
          cost: job.cost,
          result: job.result,
          scheduled: job.scheduled,
        };
      }),
    };
  }

  private mapJobsForPoll(raw: Record<string, unknown>, submitToken: string): Record<string, unknown> {
    const jobs = raw.jobs;
    if (!Array.isArray(jobs)) return { token: submitToken, jobs: [] };
    return {
      token: submitToken,
      jobs: jobs.map((j) => {
        const job = j as Record<string, unknown>;
        return {
          jobId: job.jobId,
          cost: job.cost,
          result: job.result,
          scheduled: job.scheduled,
        };
      }),
    };
  }

  private async fetchJobsByToken(base: string, submitToken: string): Promise<Record<string, unknown>> {
    const root = base.replace(/\/$/, "");
    const qs = new URLSearchParams({ token: submitToken, wait: "false", detailed: "false" });
    const url = `${root}/v1/consumer/jobs?${qs}`;
    const ua =
      process.env.CIVITAI_HTTP_USER_AGENT?.trim() ||
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 MyA/1.0";
    let r: Response;
    try {
      r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "User-Agent": ua,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `轮询任务时无法连接 Civitai 编排（${root}）：${msg}。请检查网络或代理，本问题不能靠改游戏逻辑解决。`,
      );
    }
    const text = await r.text();
    if (!r.ok) {
      if (r.status >= 500) {
        throw new CivitaiOrchestrationUnavailableError(
          [
            {
              phase: "poll",
              host: root,
              httpStatus: r.status,
              detail: text.slice(0, 800),
            },
          ],
          [
            `轮询出图任务时 Civitai 编排返回 HTTP ${r.status}（服务端错误）。`,
            "任务可能已入队，但本应用无法继续查询状态；须 Civitai 修复编排服务或稍后重试。",
            `响应片段：${text.slice(0, 400)}`,
          ].join("\n"),
        );
      }
      if (r.status >= 400 && r.status < 500) {
        CivitaiClient.throwIfOrchestrationClientHttp(root, r.status, text);
      }
      throw new Error(`Civitai orchestration GET jobs HTTP ${r.status}: ${text.slice(0, 600)}`);
    }
    let data: Record<string, unknown>;
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error("Civitai poll: invalid JSON");
    }
    return this.mapJobsForPoll(data, submitToken);
  }

  async restGetJson(apiPath: string, params?: Record<string, string>): Promise<unknown> {
    const q = params ? new URLSearchParams(params).toString() : "";
    const url = `${this.restBase}${apiPath}${q ? `?${q}` : ""}`;
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    });
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`REST HTTP ${resp.status}: ${body.slice(0, 2000)}`);
    }
    return resp.json();
  }

  async getModelVersion(modelVersionId: number): Promise<Record<string, unknown>> {
    const vid = Math.floor(modelVersionId);
    if (this.modelVersionCacheDir) {
      const cachePath = path.join(this.modelVersionCacheDir, `${vid}.json`);
      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
        if (typeof data === "object" && data !== null) {
          return data as Record<string, unknown>;
        }
        throw new Error(`Cache file must contain a JSON object: ${cachePath}`);
      }
    }
    const data = await this.restGetJson(`/model-versions/${vid}`);
    if (typeof data !== "object" || data === null) {
      throw new Error(`Expected dict from model-versions, got ${typeof data}`);
    }
    return data as Record<string, unknown>;
  }

  async resolveResourceUrn(resourceType: string, modelVersionId: number): Promise<string> {
    const ver = await this.getModelVersion(modelVersionId);
    for (const key of ["air", "airUrn", "urn"]) {
      const val = ver[key];
      if (typeof val === "string" && val.startsWith("urn:air:")) return val;
    }
    const modelId = ver.modelId;
    const vid = ver.id;
    const baseModel = ver.baseModel;
    if (typeof modelId !== "number" || typeof vid !== "number") {
      throw new Error(`Cannot resolve URN from version payload: ${Object.keys(ver).join(",")}`);
    }
    const eco = ecosystemForBaseModel(typeof baseModel === "string" ? baseModel : null);
    return buildAirUrn({
      ecosystem: eco,
      resourceKind: resourceType,
      modelId,
      versionId: vid,
    });
  }

  async pollJobsUntilBlob(
    submitToken: string,
    opts: { timeoutSec?: number; intervalSec?: number } = {},
  ): Promise<Record<string, unknown>> {
    const timeoutSec = opts.timeoutSec ?? 600;
    const intervalSec = opts.intervalSec ?? 2;
    const base = (this.activeOrchBase ?? this.orchestrationBaseCandidates()[0]).replace(/\/$/, "");
    const deadline = Date.now() + timeoutSec * 1000;
    let last: Record<string, unknown> = {};
    while (Date.now() < deadline) {
      last = await this.fetchJobsByToken(base, submitToken);
      const jobs = last.jobs as unknown[] | undefined;
      if (Array.isArray(jobs)) {
        for (const j of jobs) {
          if (j && typeof j === "object" && blobUrlFromJob(j as Record<string, unknown>)) {
            return last;
          }
        }
        for (const j of jobs) {
          if (!j || typeof j !== "object") continue;
          const job = j as Record<string, unknown>;
          if (job.scheduled === false && !blobUrlFromJob(job)) {
            const detail = JSON.stringify(job.result ?? job).slice(0, 1200);
            throw new Error(
              `Civitai job finished without an image (jobId=${String(job.jobId)}). ${detail}`,
            );
          }
        }
      }
      await new Promise((r) => setTimeout(r, intervalSec * 1000));
    }
    return last;
  }

  async createImageJob(jobInput: Record<string, unknown>, wait = false): Promise<Record<string, unknown>> {
    const model = jobInput.model;
    const bases = this.orchestrationBaseCandidates();
    const civ = this.lazyCiv();

    if (wait) {
      this.syncOpenApiForOrchestration(bases[0]);
      this.activeOrchBase = bases[0].replace(/\/$/, "");
      if (typeof model === "string" && model.includes("urn:air:")) {
        try {
          await civ.models.get([model]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`Civitai 模型可用性检查失败：${msg}`);
        }
      }
      const jsInput = jobInputForJsSdk(jobInput);
      if (typeof jsInput.model === "string" && (!jsInput.baseModel || jsInput.baseModel === "")) {
        jsInput.baseModel = orchestrationBaseModelFromAirUrn(jsInput.model);
      }
      return (await civ.image.fromText(jsInput as never, true)) as Record<string, unknown>;
    }

    const jobForSubmit = { ...jobInput } as Record<string, unknown>;
    const isAir = typeof model === "string" && model.includes("urn:air:");
    if (isAir) {
      if (jobForSubmit.baseModel !== "SDXL" && jobForSubmit.baseModel !== "SD_1_5") {
        jobForSubmit.baseModel = orchestrationBaseModelFromAirUrn(model);
      }
    }

    this.syncOpenApiForOrchestration(bases[0]);
    if (isAir) {
      try {
        await civ.models.get([model as string]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Civitai 模型可用性检查失败：${msg}`);
      }
    }

    if (isAir) {
      const rawBody = buildRawTextToImagePayload(jobForSubmit);
      const attempts: CivitaiOrchestrationFailureAttempt[] = [];
      for (const base of bases) {
        const host = base.replace(/\/$/, "");
        try {
          const raw = await this.postJobsRaw(base, rawBody, false);
          const norm = this.normalizeSubmitResponse(raw);
          this.activeOrchBase = host;
          this.syncOpenApiForOrchestration(this.activeOrchBase);
          return norm;
        } catch (e) {
          if (e instanceof OrchestrationHttpError) {
            if (e.httpStatus >= 400 && e.httpStatus < 500) {
              CivitaiClient.throwIfOrchestrationClientHttp(e.host, e.httpStatus, e.bodySnippet);
            }
            attempts.push({
              phase: "submit",
              host: e.host,
              httpStatus: e.httpStatus,
              detail: e.bodySnippet.slice(0, 1200),
            });
            continue;
          }
          throw e instanceof Error ? e : new Error(String(e));
        }
      }

      this.syncOpenApiForOrchestration(bases[0]);
      this.activeOrchBase = bases[0].replace(/\/$/, "");
      const jsInput = jobInputForJsSdk(jobInput);
      if (typeof jsInput.model === "string" && (!jsInput.baseModel || jsInput.baseModel === "")) {
        jsInput.baseModel = orchestrationBaseModelFromAirUrn(jsInput.model);
      }
      try {
        return (await civ.image.fromText(jsInput as never, false)) as Record<string, unknown>;
      } catch (e) {
        const host = bases[0].replace(/\/$/, "");
        if (e instanceof ApiError) {
          if (e.status >= 400 && e.status < 500) {
            const bodyStr =
              typeof e.body === "string" ? e.body : JSON.stringify(e.body ?? "").slice(0, 600);
            CivitaiClient.throwIfOrchestrationClientHttp(host, e.status, bodyStr);
          }
          attempts.push({
            phase: "sdk",
            host,
            httpStatus: e.status,
            detail:
              typeof e.body === "string"
                ? e.body.slice(0, 1200)
                : JSON.stringify(e.body ?? "").slice(0, 1200),
          });
        } else {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("Validation error")) {
            throw e instanceof Error ? e : new Error(msg);
          }
          attempts.push({ phase: "sdk", host, httpStatus: 0, detail: msg.slice(0, 1200) });
        }
        CivitaiClient.throwForOrchestrationFailures(attempts);
      }
    }

    this.syncOpenApiForOrchestration(bases[0]);
    this.activeOrchBase = bases[0].replace(/\/$/, "");
    const jsInput = jobInputForJsSdk(jobInput);
    if (typeof jsInput.model === "string" && (!jsInput.baseModel || jsInput.baseModel === "")) {
      jsInput.baseModel = orchestrationBaseModelFromAirUrn(String(jsInput.model));
    }
    return (await civ.image.fromText(jsInput as never, false)) as Record<string, unknown>;
  }

  async generateImageAndWait(
    jobInput: Record<string, unknown>,
    opts: { timeoutSec?: number; intervalSec?: number } = {},
  ): Promise<[Record<string, unknown>, string]> {
    const submitted = await this.createImageJob(jobInput, false);
    const token = submitted.token;
    if (typeof token !== "string" || !token) {
      throw new Error(`No token in submit response: ${JSON.stringify(submitted).slice(0, 500)}`);
    }
    const response = await this.pollJobsUntilBlob(token, opts);
    const jobs = response.jobs as unknown[] | undefined;
    if (!Array.isArray(jobs) || jobs.length === 0) {
      throw new Error(`No jobs in response after poll: ${JSON.stringify(response).slice(0, 2000)}`);
    }
    for (const job of jobs) {
      if (job && typeof job === "object") {
        const blob = blobUrlFromJob(job as Record<string, unknown>);
        if (blob) return [response, blob];
      }
    }
    throw new Error(
      `No blobUrl in jobs yet. Last response keys: ${Object.keys(response).join(",")}`,
    );
  }

  static async downloadUrl(url: string, outPath: string): Promise<void> {
    ensureApiToken();
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const token = process.env.CIVITAI_API_TOKEN?.trim();
    let resp = await fetch(url, { redirect: "follow" });
    if (!resp.ok && token && (resp.status === 401 || resp.status === 403)) {
      resp = await fetch(url, {
        redirect: "follow",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    if (!resp.ok) throw new Error(`download failed HTTP ${resp.status} for ${url.slice(0, 120)}`);
    const buf = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(outPath, buf);
  }
}
