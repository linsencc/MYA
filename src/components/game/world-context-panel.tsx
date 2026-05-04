"use client";

import type { GameUiPayload } from "@/lib/game/contracts/game-ui";
import { SceneTimeStrip } from "@/components/game/scene-time-strip";
import { WearHighlightBlock } from "@/components/game/wear-highlight";

function ContextChips({ ui }: { ui: GameUiPayload }) {
  return (
    <div className="top-chips top-chips-dense">
      {[
        ["关系", ui.relationship],
        ["地点", ui.location],
        ["心情", ui.mood],
      ].map(([k, v]) => (
        <span key={k} className="chip min-w-0">
          <span className="chip-k shrink-0">{k}</span>
          <span className="min-w-0" title={v || undefined}>
            {v || "—"}
          </span>
        </span>
      ))}
      {ui.coldWarRemaining > 0 ? (
        <span className="chip shrink-0 border-amber-900/35 bg-amber-950/25 text-xs text-amber-100/90">
          冷战 ≈{ui.coldWarRemaining} 回合
        </span>
      ) : null}
    </div>
  );
}

export function WorldContextPanel({
  ui,
  loading,
  onAdvanceNextSlot,
  onAdvanceNextMorning,
}: {
  ui: GameUiPayload;
  loading: boolean;
  onAdvanceNextSlot: () => void;
  onAdvanceNextMorning: () => void;
}) {
  return (
    <div className="space-y-3 text-left">
      <SceneTimeStrip
        variant="aside"
        calendarDay={ui.calendarDay}
        weekdayLabel={ui.weekdayLabel}
        timeSlot={ui.timeSlot}
        timeSlotLabel={ui.timeSlotLabel}
        playerTurn={ui.playerTurn}
        coldWarRemaining={ui.coldWarRemaining}
      />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">当前情境</p>
      <ContextChips ui={ui} />
      <WearHighlightBlock ui={ui} />
      <div className="border-t border-slate-800/50 pt-3">
        <p className="mb-2 text-[11px] font-medium text-slate-500">推进日历（将请求一轮叙事并计入行动次数）</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={loading}
            title="进入当天下一时段（晚间之后则进入次日清晨）"
            className="rounded-lg border border-slate-600/90 bg-slate-800/90 px-3 py-2.5 text-xs font-semibold text-slate-100 shadow-sm transition hover:border-sky-500/50 hover:bg-slate-700/90 disabled:opacity-50 active:scale-[0.98]"
            onClick={onAdvanceNextSlot}
          >
            下一时段
          </button>
          <button
            type="button"
            disabled={loading}
            title="跳过到第二天早上"
            className="rounded-lg border border-slate-600/90 bg-slate-800/90 px-3 py-2.5 text-xs font-semibold text-slate-100 shadow-sm transition hover:border-emerald-500/50 hover:bg-slate-700/90 disabled:opacity-50 active:scale-[0.98]"
            onClick={onAdvanceNextMorning}
          >
            次日清晨
          </button>
        </div>
      </div>
    </div>
  );
}
