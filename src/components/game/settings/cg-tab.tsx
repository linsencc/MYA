import type { GameUiPayload } from "@/lib/game/contracts/game-ui";
import type { GalleryItem } from "@/components/game/settings/types";

export function CgTab({
  ui,
  gallery,
  onPostAction,
}: {
  ui: GameUiPayload;
  gallery: GalleryItem[];
  onPostAction: (body: Record<string, unknown>) => void;
}) {
  return (
    <>
      {/* CG 出图主开关 */}
      <div className="mb-6 flex flex-col gap-2 rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-200">CG 出图</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">
            开启：Civitai 管线实时生成；关闭：本地立绘占位
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ui.enableCg}
          className={
            "relative isolate h-7 w-12 shrink-0 self-end rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60 sm:self-auto " +
            (ui.enableCg
              ? "border-sky-500/40 bg-sky-600/90"
              : "border-slate-600/80 bg-slate-700/90")
          }
          onClick={() =>
            void onPostAction({
              action: "set_cg_options",
              cgForceInterval: ui.cgForceInterval,
              enableCg: !ui.enableCg,
            })
          }
        >
          <span
            className={
              "pointer-events-none absolute left-0.5 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 ease-out " +
              (ui.enableCg ? "translate-x-5" : "translate-x-0")
            }
            aria-hidden
          />
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-slate-700/80 bg-slate-900/50 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">CG 与性能</p>
        <label className="mb-2 flex flex-wrap items-center gap-3 text-sm text-slate-300">
          <span className="text-slate-400">间隔强制出图（0=关闭）</span>
          <input
            type="range"
            min={0}
            max={10}
            value={ui.cgForceInterval}
            onChange={(e) =>
              void onPostAction({
                action: "set_cg_options",
                cgForceInterval: parseInt(e.target.value, 10),
                enableCg: ui.enableCg,
              })
            }
            className="w-40"
          />
          <span className="font-mono text-rose-300">{ui.cgForceInterval}</span>
        </label>
        <p className="mt-2 text-xs text-slate-500">
          本局已生成 CG 计数（周目累计）：{" "}
          <span className="font-mono text-slate-300">{ui.metaCgSeenCount}</span>
        </p>
      </div>
      <div className="mb-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">图鉴（已生成 PNG）</p>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/50 p-2">
          {gallery.length === 0 ? (
            <span className="text-sm text-slate-500">暂无或输出目录为空</span>
          ) : (
            gallery.map((g) => (
              <a
                key={g.name}
                href={g.url}
                target="_blank"
                rel="noreferrer"
                className="block h-16 w-16 overflow-hidden rounded border border-slate-700 bg-black/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.url} alt={g.name} className="h-full w-full object-cover" />
              </a>
            ))
          )}
        </div>
      </div>
    </>
  );
}
