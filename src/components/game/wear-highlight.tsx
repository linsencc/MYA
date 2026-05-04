import type { GameUiPayload } from "@/lib/game/contracts/game-ui";
import { wearNsfwToSummary } from "@/lib/game/domain/teacher-wear";

/** 左上情境卡：装束与成人状态 */
export function WearHighlightBlock({ ui }: { ui: GameUiPayload }) {
  const slots: [string, string][] = [
    ["上衣", ui.wear.top],
    ["下装", ui.wear.bottom],
    ["腿部", ui.wear.legwear],
    ["鞋履", ui.wear.shoes],
    ["配饰", ui.wear.accessories],
    ["外衣", ui.wear.state],
  ];
  const nsfwLine = ui.nsfwMode ? wearNsfwToSummary(ui.wearNsfw) : "";
  return (
    <div
      className="mt-2.5 rounded-lg border border-slate-700/75 bg-slate-900/30 px-2.5 py-2 sm:px-3 sm:py-2.5"
      aria-label="人物装束"
    >
      <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-500">人物装束</h3>
      <p className="mt-1 text-[13px] font-medium leading-snug text-slate-100/95">{ui.outfit?.trim() || "—"}</p>
      <details className="mt-2 border-t border-slate-800/50 pt-2">
        <summary className="cursor-pointer select-none text-[11px] text-slate-400 hover:text-slate-300">
          分项明细
        </summary>
        <dl className="mt-2 grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1">
          {slots.map(([label, val]) => (
            <div
              key={label}
              className="grid min-w-0 grid-cols-[2.75rem_1fr] items-baseline gap-2 text-[11px] leading-snug"
            >
              <dt className="text-slate-500">{label}</dt>
              <dd className="min-w-0 text-slate-300">{val?.trim() || "—"}</dd>
            </div>
          ))}
        </dl>
      </details>
      {ui.nsfwMode ? (
        <details className="mt-2 border-t border-slate-800/50 pt-2">
          <summary className="cursor-pointer select-none text-[11px] text-slate-400 hover:text-slate-300">
            成人状态
          </summary>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {nsfwLine?.trim() ? nsfwLine : "（无记录）"}
          </p>
        </details>
      ) : null}
    </div>
  );
}
