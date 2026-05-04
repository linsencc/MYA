import type { Dispatch, SetStateAction } from "react";
import { TIME_SLOT_LABELS } from "@/lib/game/domain/calendar";
import type { GodForm } from "@/components/game/settings/types";

const sectionClass =
  "rounded-lg border border-amber-900/30 bg-slate-950/30 p-3 shadow-sm sm:p-4";
const sectionTitleClass =
  "mb-3 border-b border-amber-900/25 pb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-500/90";

export function GodTab({
  godKey,
  setGodKey,
  godForm,
  setGodForm,
  godFlagsText,
  setGodFlagsText,
  onSubmitGodPatch,
}: {
  godKey: string;
  setGodKey: (v: string) => void;
  godForm: GodForm;
  setGodForm: Dispatch<SetStateAction<GodForm>>;
  godFlagsText: string;
  setGodFlagsText: (v: string) => void;
  onSubmitGodPatch: () => void;
}) {
  return (
    <div className="flex max-h-[min(72vh,calc(100vh-11.5rem))] flex-col overflow-hidden rounded-xl border border-amber-900/40 bg-amber-950/20 shadow-[inset_0_1px_0_rgba(251,191,36,0.06)]">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pb-2 pt-4 sm:px-5 sm:pt-5">
        <header className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-600/90">上帝指令</p>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
              开发环境（<code className="text-slate-400">npm run dev</code>）可直接提交。生产模式（
              <code className="text-slate-400">npm run start</code>）须在服务端设置{" "}
              <code className="text-slate-400">GAME_GOD_KEY</code>，并在下方填写相同密钥。
            </p>
          </div>
        </header>

        <div className="space-y-4 sm:space-y-5">
          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>授权与密钥</h3>
            <label className="flex flex-col text-xs text-slate-400">
              密钥（生产用，可选保存于本机）
              <input
                type="password"
                autoComplete="off"
                className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 font-mono text-sm text-slate-200"
                value={godKey}
                onChange={(e) => setGodKey(e.target.value)}
                placeholder="开发环境可留空"
              />
            </label>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>四维数值</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["好感", "affection"],
                  ["信任", "trust"],
                  ["亲密", "intimacy"],
                  ["欲望", "desire"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="flex flex-col text-xs text-slate-400">
                  {label}（0–100）
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                    value={godForm[key]}
                    onChange={(e) => setGodForm((g) => ({ ...g, [key]: Number(e.target.value) || 0 }))}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>进度与时间</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col text-xs text-slate-400">
                章节（1–7）
                <input
                  type="number"
                  min={1}
                  max={7}
                  className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={godForm.chapter}
                  onChange={(e) => setGodForm((g) => ({ ...g, chapter: Number(e.target.value) || 1 }))}
                />
              </label>
              <label className="flex flex-col text-xs text-slate-400">
                冷战剩余（0–20）
                <input
                  type="number"
                  min={0}
                  max={20}
                  className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={godForm.coldWar}
                  onChange={(e) => setGodForm((g) => ({ ...g, coldWar: Number(e.target.value) || 0 }))}
                />
              </label>
              <label className="flex flex-col text-xs text-slate-400">
                游戏内第几天（≥1）
                <input
                  type="number"
                  min={1}
                  className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={godForm.calendarDay}
                  onChange={(e) => setGodForm((g) => ({ ...g, calendarDay: Number(e.target.value) || 1 }))}
                />
              </label>
              <label className="flex flex-col text-xs text-slate-400">
                时段索引（0–5）
                <select
                  className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={godForm.timeSlot}
                  onChange={(e) => setGodForm((g) => ({ ...g, timeSlot: Number(e.target.value) }))}
                >
                  {TIME_SLOT_LABELS.map((lab, i) => (
                    <option key={lab} value={i}>
                      {i} · {lab}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>场景与关系</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["心情", "mood"],
                  ["地点", "location"],
                  ["时段文案", "timeOfDay"],
                  ["关系", "relationship"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="flex flex-col text-xs text-slate-400">
                  {label}
                  <input
                    className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                    value={godForm[key]}
                    onChange={(e) => setGodForm((g) => ({ ...g, [key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>穿着（分项）</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["上衣", "top"],
                  ["下装", "bottom"],
                  ["腿部/袜", "legwear"],
                  ["鞋履", "shoes"],
                  ["配饰", "accessories"],
                  ["外衣状态", "state"],
                ] as const
              ).map(([label, key]) => (
                <label key={key} className="flex flex-col text-xs text-slate-400">
                  {label}
                  <input
                    className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                    value={godForm.wear[key]}
                    onChange={(e) =>
                      setGodForm((g) => ({
                        ...g,
                        wear: { ...g.wear, [key]: e.target.value },
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>成人向身体状态</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col text-xs text-slate-400">
                阴道
                <input
                  className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={godForm.wearNsfw.vagina}
                  onChange={(e) =>
                    setGodForm((g) => ({
                      ...g,
                      wearNsfw: { ...g.wearNsfw, vagina: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="flex flex-col text-xs text-slate-400">
                肛门
                <input
                  className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={godForm.wearNsfw.anus}
                  onChange={(e) =>
                    setGodForm((g) => ({
                      ...g,
                      wearNsfw: { ...g.wearNsfw, anus: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="flex flex-col text-xs text-slate-400">
                胸部（乳头与可见度等）
                <input
                  className="mt-1 rounded-lg border border-slate-600 bg-slate-900 px-2 py-2 text-sm text-slate-200"
                  value={godForm.wearNsfw.nipples}
                  onChange={(e) =>
                    setGodForm((g) => ({
                      ...g,
                      wearNsfw: { ...g.wearNsfw, nipples: e.target.value },
                    }))
                  }
                />
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <h3 className={sectionTitleClass}>flags</h3>
            <label className="flex flex-col text-xs text-slate-400">
              JSON 对象，浅合并；仅 string/number/boolean 会写入
              <textarea
                rows={5}
                className="mt-1 rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 font-mono text-xs text-slate-200"
                value={godFlagsText}
                onChange={(e) => setGodFlagsText(e.target.value)}
                spellCheck={false}
              />
            </label>
          </section>
        </div>
      </div>

      <div className="shrink-0 border-t border-amber-900/45 bg-amber-950/75 px-4 py-3 backdrop-blur-sm sm:px-5">
        <button
          type="button"
          className="w-full rounded-lg border border-amber-700/60 bg-amber-900/35 px-4 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-900/55 sm:w-auto"
          onClick={() => void onSubmitGodPatch()}
        >
          应用上帝补丁
        </button>
      </div>
    </div>
  );
}
