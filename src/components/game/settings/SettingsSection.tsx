import { useState, type Dispatch, type SetStateAction } from "react";
import type { GameUiPayload } from "@/lib/game/contracts/game-ui";
import type { AppLlmConfigResponse } from "@/lib/game/contracts/app-config";
import { CgTab } from "@/components/game/settings/cg-tab";
import { GodTab } from "@/components/game/settings/god-tab";
import { LlmTab } from "@/components/game/settings/llm-tab";
import { SavesTab } from "@/components/game/settings/saves-tab";
import type { GodForm, GalleryItem } from "@/components/game/settings/types";

const tabBtn = (active: boolean) =>
  `flex min-h-[2.25rem] w-full items-center justify-center gap-1 rounded-md px-2 py-1.5 text-center text-xs font-medium leading-snug transition-colors ${
    active
      ? "bg-rose-600/90 text-white shadow"
      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
  }`;

export type SettingsTabId = "saves" | "god" | "cg" | "llm";

export interface SettingsSectionProps {
  ui: GameUiPayload;
  loading: boolean;
  onPostAction: (body: Record<string, unknown>) => void;
  godKey: string;
  setGodKey: (v: string) => void;
  godForm: GodForm;
  setGodForm: Dispatch<SetStateAction<GodForm>>;
  godFlagsText: string;
  setGodFlagsText: (v: string) => void;
  onSubmitGodPatch: () => void;
  gallery: GalleryItem[];
  llmConfig: AppLlmConfigResponse | null;
  onLlmConfigUpdated: (next: AppLlmConfigResponse) => void;
  onStatusMessage?: (msg: string) => void;
}

export function SettingsSection({
  ui,
  loading,
  onPostAction,
  godKey,
  setGodKey,
  godForm,
  setGodForm,
  godFlagsText,
  setGodFlagsText,
  onSubmitGodPatch,
  gallery,
  llmConfig,
  onLlmConfigUpdated,
  onStatusMessage,
}: SettingsSectionProps) {
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>("saves");

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-5 shadow-lg">
      <div className="mb-5 flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div
          className="grid min-h-[42px] w-full min-w-0 max-w-4xl shrink-0 grid-cols-2 gap-1 rounded-lg border border-slate-800 bg-slate-950/40 p-1 sm:grid-cols-4 sm:max-w-3xl"
          role="tablist"
          aria-label="设置分类"
        >
          <button type="button" className={tabBtn(settingsTab === "saves")} onClick={() => setSettingsTab("saves")}>
            存档
          </button>
          <button type="button" className={tabBtn(settingsTab === "god")} onClick={() => setSettingsTab("god")}>
            上帝
          </button>
          <button type="button" className={tabBtn(settingsTab === "cg")} onClick={() => setSettingsTab("cg")}>
            <span className="sm:hidden">CG</span>
            <span className="hidden sm:inline">CG 与图鉴</span>
          </button>
          <button type="button" className={tabBtn(settingsTab === "llm")} onClick={() => setSettingsTab("llm")}>
            LLM
          </button>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-end" aria-label="游戏会话">
          <button
            type="button"
            disabled={loading}
            className="rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2 text-sm font-medium text-white shadow-md transition hover:from-rose-500 hover:to-rose-400 disabled:opacity-50"
            onClick={() => void onPostAction({ action: "start" })}
          >
            ▶ 开始游戏
          </button>
          <button
            type="button"
            disabled={loading}
            className="rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            onClick={() => void onPostAction({ action: "reset" })}
          >
            ↺ 重开
          </button>
        </div>
      </div>

      {settingsTab === "saves" ? (
        <SavesTab ui={ui} onPostAction={onPostAction} />
      ) : null}
      {settingsTab === "god" ? (
        <GodTab
          godKey={godKey}
          setGodKey={setGodKey}
          godForm={godForm}
          setGodForm={setGodForm}
          godFlagsText={godFlagsText}
          setGodFlagsText={setGodFlagsText}
          onSubmitGodPatch={onSubmitGodPatch}
        />
      ) : null}
      {settingsTab === "cg" ? <CgTab ui={ui} gallery={gallery} onPostAction={onPostAction} /> : null}
      {settingsTab === "llm" ? (
        <LlmTab cfg={llmConfig} onUpdated={onLlmConfigUpdated} onStatusMessage={onStatusMessage} />
      ) : null}
    </div>
  );
}
