"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { AppLlmConfigResponse } from "@/lib/game/contracts/app-config";
import {
  OLLAMA_MODEL_PRESETS,
  OPENAI_MODEL_PRESETS,
  OPENROUTER_MODEL_PRESETS,
} from "@/components/game/settings/llm-model-presets";

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-slate-500">{children}</p>;
}

const CUSTOM_MODEL_OPTION = "__custom__";

function ModelIdPresetSelect({
  htmlId,
  hint,
  value,
  onChange,
  presets,
  placeholder,
}: {
  htmlId: string;
  hint: ReactNode;
  value: string;
  onChange: (next: string) => void;
  presets: { id: string; label: string }[];
  placeholder: string;
}) {
  const presetIds = presets.map((p) => p.id);
  const t = value.trim();
  const selectValue = !t ? "" : presetIds.includes(t) ? t : CUSTOM_MODEL_OPTION;

  return (
    <>
      <FieldHint>{hint}</FieldHint>
      <div className="mt-2 flex max-w-xl flex-col gap-2">
        <select
          id={`${htmlId}-preset`}
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200"
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") onChange("");
            else if (v === CUSTOM_MODEL_OPTION) {
              onChange(presetIds.includes(t) ? "" : t);
            } else onChange(v);
          }}
        >
          <option value="">（使用环境变量 / 仓库默认，不强制写入 app-config）</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label} — {p.id}
            </option>
          ))}
          <option value={CUSTOM_MODEL_OPTION}>自定义…（下方手动输入完整模型 ID）</option>
        </select>
        {selectValue === CUSTOM_MODEL_OPTION ? (
          <input
            id={`${htmlId}-custom`}
            type="text"
            className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
            placeholder={placeholder}
            value={t}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        ) : null}
      </div>
    </>
  );
}

type Draft = AppLlmConfigResponse;

export function LlmTab({
  cfg,
  onUpdated,
  onStatusMessage,
}: {
  cfg: Draft | null;
  onUpdated: (next: Draft) => void;
  onStatusMessage?: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(cfg);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(cfg);
  }, [cfg]);

  const patchBodyFromDraft = useCallback((d: Draft): Record<string, unknown> => {
    const optNum = (v: number | undefined): number | null =>
      typeof v === "number" && !Number.isNaN(v) ? v : null;
    const body: Record<string, unknown> = {
      llmBackend: d.llmBackend,
      temperature: d.temperature,
      maxTokens: d.maxTokens,
      repairTemperature: optNum(d.repairTemperature),
      topP: optNum(d.topP),
      topK: optNum(d.topK),
      frequencyPenalty: optNum(d.frequencyPenalty),
      presencePenalty: optNum(d.presencePenalty),
      repetitionPenalty: optNum(d.repetitionPenalty),
      openrouterModel: d.openrouterModel?.trim() ? d.openrouterModel.trim() : null,
      openaiModel: d.openaiModel?.trim() ? d.openaiModel.trim() : null,
      openaiBaseUrl: d.openaiBaseUrl?.trim() ? d.openaiBaseUrl.trim() : null,
      ollamaModel: d.ollamaModel?.trim() ? d.ollamaModel.trim() : null,
      ollamaBaseUrl: d.ollamaBaseUrl?.trim() ? d.ollamaBaseUrl.trim() : null,
      providerSort: d.providerSort ?? null,
      providerDataCollection: d.providerDataCollection ?? null,
      providerAllowFallbacks: d.providerAllowFallbacks,
    };
    return body;
  }, []);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const r = await fetch("/api/game/app-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBodyFromDraft(draft)),
      });
      const data = (await r.json()) as Draft & { error?: string };
      if (!r.ok) {
        onStatusMessage?.(typeof data.error === "string" ? data.error : `保存失败 HTTP ${r.status}`);
        return;
      }
      onUpdated(data as Draft);
      onStatusMessage?.("LLM 设置已保存。");
    } catch (e) {
      onStatusMessage?.(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [draft, onUpdated, onStatusMessage, patchBodyFromDraft]);

  if (!draft) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4 text-sm text-slate-400">
        正在加载 LLM 配置…
      </div>
    );
  }

  const backend = (draft.llmBackend ?? "mock").toLowerCase();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100/90">
        <strong className="text-amber-200">生效说明：</strong>
        叙事温度、最大输出 token 会在<strong>下一轮 LLM 请求</strong>起生效。若更改了
        <strong>后端或模型</strong>，请在本页保存后点击上方「重开」或重新开始游戏，以使用新的模型实例。API
        密钥请写在仓库根目录的 <code className="rounded bg-slate-900/80 px-1">.keys</code> 中，不在此界面填写。
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">通用</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300">LLM 后端</label>
          <FieldHint>
            选择驱动叙事的模型服务：<strong>mock</strong> 为离线演示脚本；<strong>openrouter</strong> 需配置
            OPEN_ROUTER_TOKEN；<strong>openai</strong> 需 OPENAI_API_KEY；<strong>ollama</strong> 为本地服务。
          </FieldHint>
          <select
            className="mt-2 w-full max-w-md rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={backend}
            onChange={(e) => setDraft((d) => (d ? { ...d, llmBackend: e.target.value } : d))}
          >
            <option value="mock">mock（离线演示）</option>
            <option value="openrouter">openrouter</option>
            <option value="openai">openai</option>
            <option value="ollama">ollama</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300">
            最大输出 Token：<span className="font-mono text-rose-300">{draft.maxTokens ?? 32768}</span>
          </label>
          <FieldHint>
            单次叙事允许生成的最大 token 数；越大越不易截断 JSON，但更慢、更贵。多数模型有实际上限，超过会被服务商截断。
          </FieldHint>
          <input
            type="number"
            min={256}
            max={200000}
            step={256}
            className="mt-2 w-full max-w-xs rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            value={draft.maxTokens ?? 32768}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setDraft((d) => (d ? { ...d, maxTokens: Number.isNaN(n) ? d.maxTokens : n } : d));
            }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300">
            叙事温度：<span className="font-mono text-rose-300">{(draft.temperature ?? 0.9).toFixed(2)}</span>
          </label>
          <FieldHint>
            控制随机性：0 更稳定、重复感强；越高越有变化，但可能更飘。JSON 解析失败后的「紧凑重试」温度在下方「补充采样」中单独设置。
          </FieldHint>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            className="mt-2 w-full max-w-md"
            value={draft.temperature ?? 0.9}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, temperature: parseFloat(e.target.value) } : d))
            }
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
        <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">补充采样（高级）</p>
        <p className="mb-4 text-xs text-slate-500">
          以下参数保存后与主叙事温度、max tokens 一样，在<strong>下一轮 LLM 请求</strong>起生效（一般无需重开）。留空并保存可清除该项在
          app-config 中的覆盖。
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-300">
            紧凑重试温度（JSON 修复）：{" "}
            <span className="font-mono text-rose-300">{(draft.repairTemperature ?? 0.65).toFixed(2)}</span>
          </label>
          <FieldHint>
            主叙事解析失败时，引擎会多打一轮紧凑重试；默认 0.65，略低于主温度有利于输出合法 JSON。
          </FieldHint>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            className="mt-2 w-full max-w-md"
            value={draft.repairTemperature ?? 0.65}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, repairTemperature: parseFloat(e.target.value) } : d))
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-300">top_p（0–1）</label>
            <FieldHint>
              核采样；与温度二选一调节即可。OpenAI / OpenRouter / Ollama 均会在支持时传入。
            </FieldHint>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.topP === undefined || draft.topP === null ? "" : draft.topP}
              placeholder="留空=不传"
              onChange={(e) => {
                const raw = e.target.value;
                setDraft((d) => {
                  if (!d) return d;
                  if (raw === "") return { ...d, topP: undefined };
                  const n = parseFloat(raw);
                  return { ...d, topP: Number.isNaN(n) ? undefined : n };
                });
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">frequency_penalty（-2～2）</label>
            <FieldHint>抑制重复用词；对 OpenAI、OpenRouter、Ollama 均尝试传入。</FieldHint>
            <input
              type="number"
              min={-2}
              max={2}
              step={0.1}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.frequencyPenalty === undefined || draft.frequencyPenalty === null ? "" : draft.frequencyPenalty}
              placeholder="留空=不传"
              onChange={(e) => {
                const raw = e.target.value;
                setDraft((d) => {
                  if (!d) return d;
                  if (raw === "") return { ...d, frequencyPenalty: undefined };
                  const n = parseFloat(raw);
                  return { ...d, frequencyPenalty: Number.isNaN(n) ? undefined : n };
                });
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">presence_penalty（-2～2）</label>
            <FieldHint>鼓励谈新话题、减少车轱辘话。</FieldHint>
            <input
              type="number"
              min={-2}
              max={2}
              step={0.1}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.presencePenalty === undefined || draft.presencePenalty === null ? "" : draft.presencePenalty}
              placeholder="留空=不传"
              onChange={(e) => {
                const raw = e.target.value;
                setDraft((d) => {
                  if (!d) return d;
                  if (raw === "") return { ...d, presencePenalty: undefined };
                  const n = parseFloat(raw);
                  return { ...d, presencePenalty: Number.isNaN(n) ? undefined : n };
                });
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300">top_k（1～200，偏 Ollama）</label>
            <FieldHint>仅从每步 top-k 个 token 里采样；主要影响本地 Ollama，其它后端若忽略也无害。</FieldHint>
            <input
              type="number"
              min={1}
              max={200}
              step={1}
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.topK === undefined || draft.topK === null ? "" : draft.topK}
              placeholder="留空=不传"
              onChange={(e) => {
                const raw = e.target.value;
                setDraft((d) => {
                  if (!d) return d;
                  if (raw === "") return { ...d, topK: undefined };
                  const n = parseInt(raw, 10);
                  return { ...d, topK: Number.isNaN(n) ? undefined : n };
                });
              }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-300">repeat_penalty / repetition_penalty（0.5～2.5）</label>
            <FieldHint>Ollama 的 <code className="rounded bg-slate-900/80 px-1">repeat_penalty</code>；调高可减轻复读式 JSON。</FieldHint>
            <input
              type="number"
              min={0.5}
              max={2.5}
              step={0.05}
              className="mt-2 w-full max-w-xs rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={
                draft.repetitionPenalty === undefined || draft.repetitionPenalty === null ? "" : draft.repetitionPenalty
              }
              placeholder="留空=不传"
              onChange={(e) => {
                const raw = e.target.value;
                setDraft((d) => {
                  if (!d) return d;
                  if (raw === "") return { ...d, repetitionPenalty: undefined };
                  const n = parseFloat(raw);
                  return { ...d, repetitionPenalty: Number.isNaN(n) ? undefined : n };
                });
              }}
            />
          </div>
        </div>
      </div>

      {backend === "openrouter" ? (
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">OpenRouter</p>

          <div className="mb-4">
            <label htmlFor="llm-openrouter-preset" className="block text-sm font-medium text-slate-300">
              模型 ID
            </label>
            <ModelIdPresetSelect
              htmlId="llm-openrouter"
              hint={
                <>
                  从常用 OpenRouter 路由中选一项，或选「自定义」输入任意{" "}
                  <code className="rounded bg-slate-900/80 px-1">provider/model</code>。选第一项则不在配置里锁定模型，沿用{" "}
                  <code className="rounded bg-slate-900/80 px-1">.keys</code> 中的 OPENROUTER_MODEL。
                </>
              }
              value={draft.openrouterModel ?? ""}
              onChange={(next) => setDraft((d) => (d ? { ...d, openrouterModel: next } : d))}
              presets={OPENROUTER_MODEL_PRESETS}
              placeholder="例如 x-ai/grok-4-fast"
            />
          </div>

          <div className="mb-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
            <span className="text-slate-400">OPEN_ROUTER_TOKEN：</span>
            <span className={draft.hasOpenRouterToken ? "text-emerald-400" : "text-rose-400"}>
              {draft.hasOpenRouterToken ? "已在 .keys / 环境中配置" : "未配置（将回退为 mock）"}
            </span>
            <FieldHint>不在网页中存储密钥；请到仓库根目录 `.keys` 添加一行 OPEN_ROUTER_TOKEN=…</FieldHint>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300">Provider 排序</label>
            <FieldHint>
              多 provider 时的偏好：<strong>price</strong> 最便宜；<strong>throughput</strong> 吞吐优先；{" "}
              <strong>latency</strong> 延迟优先。
            </FieldHint>
            <select
              className="mt-2 w-full max-w-md rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={draft.providerSort ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        providerSort: v === "" ? undefined : (v as Draft["providerSort"]),
                      }
                    : d,
                );
              }}
            >
              <option value="">（不指定，由 OpenRouter 默认）</option>
              <option value="price">price</option>
              <option value="throughput">throughput</option>
              <option value="latency">latency</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300">数据收集</label>
            <FieldHint>
              <strong>allow</strong>：允许上游按政策记录；<strong>deny</strong>：请求拒绝被用于训练/日志的数据收集（依
              OpenRouter 与模型支持为准）。
            </FieldHint>
            <select
              className="mt-2 w-full max-w-md rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              value={draft.providerDataCollection ?? "allow"}
              onChange={(e) =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        providerDataCollection: e.target.value as Draft["providerDataCollection"],
                      }
                    : d,
                )
              }
            >
              <option value="allow">allow</option>
              <option value="deny">deny</option>
            </select>
          </div>

          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.providerAllowFallbacks !== false}
              onChange={(e) =>
                setDraft((d) => (d ? { ...d, providerAllowFallbacks: e.target.checked } : d))
              }
            />
            <span>
              <span className="font-medium">允许降级路由</span>
              <FieldHint>首选 provider 不可用时，是否允许 OpenRouter 自动切换到其他可用 provider。</FieldHint>
            </span>
          </label>
        </div>
      ) : null}

      {backend === "openai" ? (
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">OpenAI 兼容</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300">模型 ID</label>
            <FieldHint>例如 gpt-4o-mini、gpt-4o。留空则使用环境变量 OPENAI_MODEL 的默认值。</FieldHint>
            <input
              type="text"
              className="mt-2 w-full max-w-xl rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.openaiModel ?? ""}
              placeholder="gpt-4o-mini"
              onChange={(e) => setDraft((d) => (d ? { ...d, openaiModel: e.target.value } : d))}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300">Base URL（可选）</label>
            <FieldHint>覆盖 OPENAI_BASE_URL，用于 Azure/OpenAI 兼容代理等；留空则用默认 https://api.openai.com/v1。</FieldHint>
            <input
              type="text"
              className="mt-2 w-full max-w-xl rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.openaiBaseUrl ?? ""}
              placeholder="https://api.openai.com/v1"
              onChange={(e) => setDraft((d) => (d ? { ...d, openaiBaseUrl: e.target.value } : d))}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
            <span className="text-slate-400">OPENAI_API_KEY：</span>
            <span className={draft.hasOpenAIApiKey ? "text-emerald-400" : "text-rose-400"}>
              {draft.hasOpenAIApiKey ? "已配置" : "未配置"}
            </span>
          </div>
        </div>
      ) : null}

      {backend === "ollama" ? (
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-500">Ollama 本地</p>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-300">模型名</label>
            <FieldHint>本机已通过 ollama pull 的模型名，例如 qwen2:7b。</FieldHint>
            <input
              type="text"
              className="mt-2 w-full max-w-xl rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.ollamaModel ?? ""}
              placeholder="qwen2:7b"
              onChange={(e) => setDraft((d) => (d ? { ...d, ollamaModel: e.target.value } : d))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">服务地址</label>
            <FieldHint>Ollama HTTP API 根地址，默认 http://localhost:11434。</FieldHint>
            <input
              type="text"
              className="mt-2 w-full max-w-xl rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
              value={draft.ollamaBaseUrl ?? ""}
              placeholder="http://localhost:11434"
              onChange={(e) => setDraft((d) => (d ? { ...d, ollamaBaseUrl: e.target.value } : d))}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:from-rose-500 hover:to-rose-400 disabled:opacity-50"
          onClick={() => void save()}
        >
          {saving ? "保存中…" : "保存 LLM 设置"}
        </button>
      </div>
    </div>
  );
}
