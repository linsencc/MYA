"use client";

import { useMemo } from "react";
import type { CharacterRosterEntry } from "@/lib/game/contracts/game-ui";
import {
  CharacterStatsContent,
  CharacterTitlesContent,
} from "@/components/game/character-stats-titles-content";

/** 情境标签行：关系 / 地点 / 心情 / 冷战 */
function ContextRow({ entry }: { entry: CharacterRosterEntry }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(
        [
          ["关系", entry.relationship, "text-sky-200/90"],
          ["地点", entry.location, "text-slate-200/90"],
          ["心情", entry.mood, "text-violet-200/90"],
        ] as [string, string, string][]
      ).map(([k, v, cls]) => (
        <span
          key={k}
          className="inline-flex items-baseline gap-1 rounded-md border border-slate-700/60 bg-slate-800/50 px-2 py-0.5 text-[11px]"
        >
          <span className="text-slate-500">{k}</span>
          <span className={`min-w-0 truncate font-medium ${cls}`} title={v || undefined}>
            {v || "—"}
          </span>
        </span>
      ))}
      {entry.coldWarRemaining > 0 ? (
        <span className="inline-flex items-baseline gap-1 rounded-md border border-amber-800/40 bg-amber-950/30 px-2 py-0.5 text-[11px] font-medium text-amber-200/90">
          冷战 ≈{entry.coldWarRemaining} 回合
        </span>
      ) : null}
    </div>
  );
}

/** 装束分项卡：单一 dl 含着装与 NSFW；标题「装饰」由外层提供 */
function OutfitBlock({ entry }: { entry: CharacterRosterEntry }) {
  const slots: [string, string][] = [
    ["上衣", entry.wear.top],
    ["下装", entry.wear.bottom],
    ["腿部", entry.wear.legwear],
    ["鞋履", entry.wear.shoes],
    ["配饰", entry.wear.accessories],
    ["外衣", entry.wear.state],
  ];
  const nsfwRows: [string, string][] = entry.nsfwMode
    ? [
        ["阴道", entry.wearNsfw.vagina],
        ["肛门", entry.wearNsfw.anus],
        ["胸部", entry.wearNsfw.nipples],
      ]
    : [];
  const allRows: [string, string][] = [...slots, ...nsfwRows];
  const rowClass = "grid grid-cols-[2.5rem_1fr] items-baseline gap-1";
  const gridClass = "grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] leading-snug";
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2.5">
      <dl className={gridClass}>
        {allRows.map(([label, val], i) => {
          const firstNsfwRowCell =
            entry.nsfwMode && i >= slots.length && i <= slots.length + 1;
          return (
            <div
              key={`${label}-${i}`}
              className={`${rowClass}${firstNsfwRowCell ? " border-t border-slate-800/50" : ""}`}
            >
              <dt className="shrink-0 text-slate-500">{label}</dt>
              <dd className="min-w-0 truncate text-slate-300" title={val?.trim() || undefined}>
                {val?.trim() || "—"}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** 当前情境 + 装饰（人物详情上半） */
export function CharacterProfileContextBlock({ entry }: { entry: CharacterRosterEntry }) {
  return (
    <section className="space-y-2" aria-label="当前情境">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">当前情境</p>
      <ContextRow entry={entry} />
      <p className="shrink-0 border-t border-slate-800/55 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        装饰
      </p>
      <OutfitBlock entry={entry} />
    </section>
  );
}

/** 称号图鉴块 */
function CharacterProfileTitlesBlock({ entry }: { entry: CharacterRosterEntry }) {
  const titleProgress = useMemo(() => {
    const unlocked = entry.titleRows.filter((r) => r.unlocked).length;
    return { unlocked, total: entry.titleRows.length };
  }, [entry.titleRows]);

  return (
    <section className="border-t border-slate-800/55 pt-3" aria-label="称号图鉴">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">称号</p>
        <span className="rounded-full border border-slate-700/60 bg-slate-900/70 px-2 py-px font-mono text-[10px] tabular-nums text-amber-200/80">
          {titleProgress.unlocked} / {titleProgress.total}
        </span>
      </div>
      <CharacterTitlesContent ui={entry} compactMaxHeight="max-h-[min(32vh,360px)]" />
    </section>
  );
}

/** 四维与称号（无「人物状态」小标题，供侧栏标题置于滚动区外时拼接） */
export function CharacterProfileStatsAndTitlesBlock({ entry }: { entry: CharacterRosterEntry }) {
  return (
    <>
      <section className="space-y-2" aria-label="人物状态">
        <CharacterStatsContent ui={entry} />
      </section>
      <CharacterProfileTitlesBlock entry={entry} />
    </>
  );
}

/** 单角色资料：情境、装束、四维、称号（人物 Tab 详情，单滚动栈） */
export function CharacterProfilePanel({ entry }: { entry: CharacterRosterEntry }) {
  return (
    <div className="space-y-3">
      <CharacterProfileContextBlock entry={entry} />

      <section className="border-t border-slate-800/55 pt-3 space-y-2" aria-label="人物状态">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">人物状态</p>
        <CharacterStatsContent ui={entry} />
      </section>

      <CharacterProfileTitlesBlock entry={entry} />
    </div>
  );
}
