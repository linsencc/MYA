import type { GameUiPayload } from "@/lib/game/contracts/game-ui";

const btnPrimary =
  "rounded-md bg-rose-600/90 px-2 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-40";
const btnGhost =
  "rounded-md border border-slate-600 bg-slate-900/80 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";
const btnDanger =
  "rounded-md border border-amber-800/60 px-2 py-1 text-xs text-amber-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40";

export function SavesTab({
  ui,
  onPostAction,
}: {
  ui: GameUiPayload;
  onPostAction: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      <p className="mb-4 text-sm text-slate-400">
        多槽存档位于{" "}
        <code className="text-rose-300">data/saves/save_{"{"}槽位{"}"}.json</code>
        （界面槽位 1–10 对应内部 0–9）。每一行可单独保存当前进度、读档或删除该槽文件；保存或读档后列表会随响应更新。
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[560px] text-left text-sm text-slate-300">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/50 text-slate-400">
              {["槽位", "关系", "好感", "保存时间", "摘要", "状态", "操作"].map((h) => (
                <th key={h} className="p-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ui.slots.map((row, i) => {
              const slotIdx = Math.max(0, Math.min(9, parseInt(String(row[0] ?? "1"), 10) - 1));
              const status = String(row[5] ?? "");
              const isEmpty = status === "空";

              return (
                <tr key={i} className="border-b border-slate-800/80 align-top">
                  {row.map((cell, j) => (
                    <td key={j} className="p-2">
                      {cell}
                    </td>
                  ))}
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className={btnPrimary}
                        onClick={() =>
                          void onPostAction({
                            action: "save",
                            slot: slotIdx,
                            saveNote: "",
                          })
                        }
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className={btnGhost}
                        disabled={isEmpty}
                        title={isEmpty ? "该槽暂无存档" : undefined}
                        onClick={() => void onPostAction({ action: "load", slot: slotIdx })}
                      >
                        读档
                      </button>
                      <button
                        type="button"
                        className={btnDanger}
                        disabled={isEmpty}
                        title={isEmpty ? "该槽暂无文件可删" : undefined}
                        onClick={() => void onPostAction({ action: "delete_slot", slot: slotIdx })}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        提示：在游戏页未聚焦输入框时，可按键盘 <kbd className="rounded border border-slate-600 bg-slate-800 px-1">1</kbd>–
        <kbd className="rounded border border-slate-600 bg-slate-800 px-1">4</kbd> 对应第 1–4 个有效选项。
      </p>
    </>
  );
}
