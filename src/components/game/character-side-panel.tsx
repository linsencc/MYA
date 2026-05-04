"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import type { GameUiPayload } from "@/lib/game/contracts/game-ui";
import { CharacterProfileContextBlock, CharacterProfileStatsAndTitlesBlock } from "@/components/game/character-profile-panel";

function PersonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ShopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

/** 可独立渲染的地点图鉴（全宽面板或侧栏共用） */
export function LocationMapContent({
  ui,
  travelLoading,
  onTravelTo,
}: {
  ui: GameUiPayload;
  travelLoading?: boolean;
  onTravelTo?: (locationId: string) => void;
}) {
  const panelBusy = Boolean(travelLoading);
  const travelExhausted =
    ui.world.travelMovesMax != null &&
    ui.world.travelMovesRemaining != null &&
    ui.world.travelMovesMax > 0 &&
    ui.world.travelMovesRemaining <= 0;

  return (
    <div className="space-y-2" aria-label="地点图鉴">
      {ui.world.travelMovesMax != null && ui.world.travelMovesRemaining != null ? (
        <>
          <p className="text-[11px] leading-snug text-sky-300/90">
            本时段可移动{" "}
            <span className="font-mono font-semibold text-sky-100">{ui.world.travelMovesRemaining}</span> /{" "}
            <span className="font-mono text-sky-200/80">{ui.world.travelMovesMax}</span> 次
          </p>
          {travelExhausted ? (
            <p className="text-[11px] leading-snug text-amber-200/90">
              次数已用尽：请先在标题栏时间旁点「下一时段」或「次日清晨」，再换场景。
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-[11px] leading-snug text-slate-500">在同一时段内切换场景，不推进钟表。</p>
      )}
      <ul className="space-y-2">
        {ui.world.locations.map((loc) => (
          <li
            key={loc.id}
            className={`rounded-lg border px-2.5 py-2 text-left text-[11px] leading-snug ${
              loc.current
                ? "border-sky-600/50 bg-sky-950/35 text-sky-100/95"
                : loc.locked
                  ? "border-slate-700/80 bg-slate-950/40 text-slate-500"
                  : "border-slate-600/70 bg-slate-900/55 text-slate-200"
            }`}
          >
            <div className="flex gap-2.5">
              {loc.cgImageSrc ? (
                <div
                  className={`relative h-[4.25rem] w-[6.75rem] shrink-0 overflow-hidden rounded-md border bg-slate-950 ${
                    loc.current ? "border-sky-600/45" : "border-slate-600/55"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 动态站点根 SVG/PNG 地点卡 */}
                  <img
                    src={loc.cgImageSrc}
                    alt=""
                    className="h-full w-full object-contain object-center"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 font-medium">{loc.label}</span>
                  {loc.current ? (
                    <span className="shrink-0 rounded bg-sky-900/60 px-1.5 py-px text-[10px] text-sky-200">当前</span>
                  ) : null}
                </div>
                {loc.cardSummary.trim() ? (
                  <p className={`mt-1 text-[10px] leading-snug ${loc.locked ? "text-slate-600" : "text-slate-400"}`}>
                    {loc.cardSummary}
                  </p>
                ) : null}
              </div>
            </div>
            {loc.locked && loc.lockReason ? (
              <p className="mt-1.5 text-[10px] text-slate-500">{loc.lockReason}</p>
            ) : null}
            {!loc.current && !loc.locked && onTravelTo ? (
              <button
                type="button"
                disabled={panelBusy || travelExhausted}
                title={travelExhausted ? "本时段移动次数已用尽，请先推进时段。" : undefined}
                className="mt-2 w-full rounded-md border border-slate-600 bg-slate-800/90 py-1 text-[11px] font-medium text-slate-100 hover:border-sky-500/45 hover:bg-slate-700/90 disabled:opacity-50"
                onClick={() => onTravelTo(loc.id)}
              >
                {travelExhausted ? "前往（次数用尽）" : "前往"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export type CharacterPanelTab = "characters" | "map" | "bag" | "shop" | "phone";

function CharacterRosterPanel({ ui }: { ui: GameUiPayload }) {
  const metEntries = useMemo(
    () => (ui.characterRoster ?? []).filter((e) => e.met),
    [ui.characterRoster],
  );
  const [preferList, setPreferList] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeDetailId = useMemo(() => {
    if (preferList) return null;
    if (detailId !== null) return detailId;
    if (metEntries.length === 1) return metEntries[0]!.id;
    return null;
  }, [preferList, detailId, metEntries]);

  const selectedEntry = useMemo(
    () => (activeDetailId ? metEntries.find((e) => e.id === activeDetailId) : undefined),
    [activeDetailId, metEntries],
  );

  if (metEntries.length === 0) {
    return (
      <p className="min-h-0 flex-1 text-[11px] leading-relaxed text-slate-500">暂无可查看的人物。</p>
    );
  }

  if (selectedEntry) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md text-[11px] font-medium text-sky-400/90 transition hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/50"
          onClick={() => {
            setDetailId(null);
            setPreferList(true);
          }}
        >
          ← 返回列表
        </button>
        <div className="min-h-0 max-h-[min(40vh,300px)] shrink overflow-y-auto pr-1">
          <CharacterProfileContextBlock entry={selectedEntry} />
        </div>
        <p className="shrink-0 border-t border-slate-800/55 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          人物状态
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="space-y-3 pt-1">
            <CharacterProfileStatsAndTitlesBlock entry={selectedEntry} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="已遇见人物">
      {metEntries.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2.5 text-left text-[11px] transition hover:border-slate-600/70 hover:bg-slate-900/60"
            onClick={() => {
              setDetailId(e.id);
              setPreferList(false);
            }}
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-600/50 bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element -- 动态立绘 URL */}
              <img src={e.portraitSrc} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-200">{e.displayName}</p>
              <p className="mt-0.5 font-mono text-[10px] tabular-nums text-slate-500">
                好感 {e.affection} · 信任 {e.trust} · 亲密 {e.intimacy} · 欲望 {e.desire}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

/** 角色面板：人物 · 背包 · 商店 · 手机（地点图鉴在标题栏） */
export function CharacterSidePanel({
  ui,
  panel,
  onPanel,
  onTravelTo,
  travelLoading,
  onUseItem,
  onShopBuy,
  onPhoneRead,
}: {
  ui: GameUiPayload;
  panel: CharacterPanelTab;
  onPanel: (p: CharacterPanelTab) => void;
  onTravelTo?: (locationId: string) => void;
  travelLoading?: boolean;
  onUseItem?: (itemId: string) => void;
  onShopBuy?: (listingId: string) => void;
  onPhoneRead?: (threadId: string) => void;
}) {
  const unreadPhone = ui.world.phoneThreads.filter((t) => t.unread).length;
  const panelBusy = Boolean(travelLoading);
  const travelExhausted =
    ui.world.travelMovesMax != null &&
    ui.world.travelMovesRemaining != null &&
    ui.world.travelMovesMax > 0 &&
    ui.world.travelMovesRemaining <= 0;

  const [collapsed, setCollapsed] = useState(false);
  const bodyId = useId();

  const tabs: {
    id: CharacterPanelTab;
    label: string;
    icon: ReactNode;
    badge: ReactNode;
  }[] = [
    {
      id: "characters",
      label: "人物",
      icon: <PersonIcon className="shrink-0" />,
      badge: null,
    },
    {
      id: "bag",
      label: "背包",
      icon: <BagIcon className="shrink-0" />,
      badge:
        ui.world.inventory.length > 0 ? (
          <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sky-500/20 px-1 text-[9px] font-semibold tabular-nums text-sky-200 ring-1 ring-sky-500/30">
            {ui.world.inventory.reduce((n, x) => n + x.qty, 0)}
          </span>
        ) : null,
    },
    {
      id: "shop",
      label: "商店",
      icon: <ShopIcon className="shrink-0" />,
      badge:
        ui.world.pocketMoney > 0 ? (
          <span className="ml-auto flex h-4 items-center justify-center rounded-full bg-emerald-500/15 px-1.5 text-[9px] font-semibold tabular-nums text-emerald-300 ring-1 ring-emerald-500/25">
            ¥{ui.world.pocketMoney}
          </span>
        ) : null,
    },
    {
      id: "phone",
      label: "手机",
      icon: <PhoneIcon className="shrink-0" />,
      badge:
        unreadPhone > 0 ? (
          <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500/20 px-1 text-[9px] font-semibold tabular-nums text-rose-300 ring-1 ring-rose-500/30">
            {unreadPhone}
          </span>
        ) : null,
    },
  ];

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-700/90 bg-slate-900/85 shadow-inner ${
        collapsed ? "h-auto" : "h-full min-h-0"
      }`}
    >
      {/* Tab bar */}
      <div className="flex shrink-0 items-stretch border-b border-slate-700/60" role="tablist" aria-label="角色面板">
        {tabs.map((tab) => {
          const active = panel === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={bodyId}
              onClick={() => { onPanel(tab.id); if (collapsed) setCollapsed(false); }}
              className={`group relative flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-[11px] font-medium transition-all duration-150 sm:text-xs ${
                active
                  ? "text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <span className={`transition-colors duration-150 ${active ? "text-sky-400" : "text-slate-600 group-hover:text-slate-400"}`}>
                {tab.icon}
              </span>
              <span className="truncate">{tab.label}</span>
              {tab.badge}
              {active && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-sky-400" />
              )}
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          title={collapsed ? "展开面板" : "收起面板"}
          aria-label={collapsed ? "展开面板" : "收起面板"}
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center justify-center border-l border-slate-700/60 px-2.5 text-slate-600 transition-colors hover:bg-slate-800/40 hover:text-slate-300"
        >
          <ChevronDownIcon className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
        </button>
      </div>

      <div
        id={bodyId}
        aria-hidden={collapsed}
        className={collapsed ? "hidden" : "flex min-h-0 flex-1 flex-col p-3 sm:p-4"}
      >
        {panel === "characters" ? (
          <CharacterRosterPanel ui={ui} />
        ) : panel === "map" ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <LocationMapContent ui={ui} travelLoading={travelLoading} onTravelTo={onTravelTo} />
          </div>
        ) : panel === "bag" ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="背包">
            {ui.world.inventory.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-slate-500">暂无物品。剧情推进后可能会获得道具。</p>
            ) : (
              <ul className="space-y-2">
                {ui.world.inventory.map((it) => (
                  <li
                    key={it.id}
                    className="group flex flex-col gap-1.5 rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2.5 text-[11px] text-slate-200 transition-colors hover:border-slate-600/70 hover:bg-slate-900/60"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold tracking-wide">{it.name}</span>
                      <span className="shrink-0 rounded bg-slate-800/80 px-1.5 py-px font-mono text-[10px] text-slate-400">
                        ×{it.qty}
                      </span>
                    </div>
                    {it.description ? (
                      <p className="text-[10px] leading-relaxed text-slate-500">{it.description}</p>
                    ) : null}
                    {it.usable && onUseItem ? (
                      <button
                        type="button"
                        disabled={panelBusy}
                        className="mt-0.5 rounded-lg border border-emerald-700/40 bg-emerald-950/40 py-1.5 text-[10px] font-semibold text-emerald-300 transition-all hover:border-emerald-600/60 hover:bg-emerald-900/40 hover:text-emerald-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                        onClick={() => onUseItem(it.id)}
                      >
                        使用
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : panel === "shop" ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="商店">
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-800/30 bg-emerald-950/20 px-2.5 py-2">
              <ShopIcon className="text-emerald-500/70" />
              <span className="text-[11px] text-slate-400">零花钱</span>
              <span className="ml-auto font-mono text-sm font-semibold text-emerald-300">¥{ui.world.pocketMoney}</span>
            </div>
            {ui.world.shopListings.length === 0 ? (
              <p className="text-[11px] text-slate-500">暂无商品。</p>
            ) : (
              <ul className="space-y-2">
                {ui.world.shopListings.map((row) => (
                  <li
                    key={row.listingId}
                    className="flex flex-col gap-1.5 rounded-xl border border-slate-700/60 bg-slate-950/50 px-3 py-2.5 text-[11px] text-slate-200 transition-colors hover:border-slate-600/70 hover:bg-slate-900/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 font-semibold leading-snug">{row.label}</span>
                      <span className="shrink-0 rounded bg-amber-950/60 px-1.5 py-px font-mono text-[10px] font-semibold text-amber-300 ring-1 ring-amber-800/40">
                        ¥{row.price}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">
                      到账：{row.itemId} ×{row.qtyPerPurchase}
                    </p>
                    {onShopBuy ? (
                      <button
                        type="button"
                        disabled={panelBusy || !row.affordable}
                        className={`mt-0.5 rounded-lg py-1.5 text-[10px] font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 ${
                          row.affordable
                            ? "border border-amber-700/40 bg-amber-950/40 text-amber-300 hover:border-amber-600/60 hover:bg-amber-900/40 hover:text-amber-200"
                            : "border border-slate-700/50 bg-slate-800/30 text-slate-500"
                        }`}
                        onClick={() => onShopBuy(row.listingId)}
                      >
                        {row.affordable ? "购买" : "余额不足"}
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="手机">
            <p className="text-[11px] leading-relaxed text-slate-500">
              主角手机：与他人的联系、消息与各类入口均从此处开始。
            </p>
            {ui.world.phoneThreads.length === 0 ? (
              <p className="text-[11px] leading-relaxed text-slate-500">暂无消息。</p>
            ) : (
              <ul className="space-y-2">
                {ui.world.phoneThreads.map((th) => (
                  <li
                    key={th.id}
                    className={`rounded-xl border px-3 py-2.5 text-left text-[11px] leading-snug transition-colors ${
                      th.unread
                        ? "border-rose-700/40 bg-rose-950/25 text-rose-50/95 hover:border-rose-600/50 hover:bg-rose-950/35"
                        : "border-slate-700/60 bg-slate-950/50 text-slate-300 hover:border-slate-600/70 hover:bg-slate-900/60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        {th.unread && (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                        )}
                        <span className="min-w-0 truncate font-semibold">{th.title}</span>
                      </div>
                      {th.unread && onPhoneRead ? (
                        <button
                          type="button"
                          disabled={panelBusy}
                          className="shrink-0 rounded-md border border-slate-600/60 bg-slate-800/50 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition-all hover:border-slate-500/70 hover:bg-slate-700/60 hover:text-slate-100 active:scale-[0.97] disabled:opacity-40"
                          onClick={() => onPhoneRead(th.id)}
                        >
                          已读
                        </button>
                      ) : null}
                    </div>
                    {th.lastSnippet ? (
                      <p className="mt-1 text-[10px] text-slate-500 line-clamp-2">{th.lastSnippet}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
