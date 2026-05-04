"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { TitleRowUi } from "@/lib/game/domain/titles";
import type { GameUiPayload } from "@/lib/game/contracts/game-ui";

/** 与 `GameUiPayload` 及 `CharacterRosterEntry` 共用的统计/称号片段（面板专用） */
export type CharacterStatsSlice = Pick<
  GameUiPayload,
  "affection" | "trust" | "intimacy" | "desire" | "lastStatDeltas" | "flagSummaryLines"
>;
export type CharacterTitlesSlice = Pick<GameUiPayload, "titleRows">;
import { formatDeltaLine } from "@/components/game/game-reading-utils";

function bar(val: number, label: string, gradient: string, accentColor: string) {
  const pct = Math.max(0, Math.min(100, val));
  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span className="w-8 shrink-0 text-[11px] text-slate-400">{label}</span>
      <div className="relative flex-1 h-1.5 overflow-hidden rounded-full bg-slate-800/80" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: gradient }}
        />
      </div>
      <span className={`w-7 shrink-0 text-right font-mono text-[12px] tabular-nums font-semibold ${accentColor}`}>
        {val}
      </span>
    </div>
  );
}

function tierPillClass(tier: number): string {
  if (tier >= 4) return "border-violet-700/55 bg-violet-950/40 text-violet-100";
  if (tier === 3) return "border-rose-800/45 bg-rose-950/35 text-rose-50";
  if (tier === 2) return "border-sky-800/40 bg-slate-800/80 text-sky-100";
  return "border-slate-600/70 bg-slate-800/60 text-slate-200";
}

function TitleTooltipBody({ row }: { row: TitleRowUi }) {
  return (
    <>
      <span className="font-medium text-rose-100">{row.name}</span>
      <p className="mt-1.5 leading-relaxed text-slate-300">{row.description}</p>
      <p className="mt-2 border-t border-slate-700/90 pt-2 leading-snug text-slate-400">
        <span className="font-medium text-slate-500">解锁条件：</span>
        {row.conditionText}
      </p>
    </>
  );
}

/** 紧凑称号标签（已解锁显示全名；未解锁显示「？」；悬浮见描述与条件） */
function TitleTagPill({ row }: { row: TitleRowUi }) {
  const tipId = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [tipStyle, setTipStyle] = useState<CSSProperties>({});

  const updateTipPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === "undefined") return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const maxW = Math.min(288, vw - 32);
    let left = rect.left + rect.width / 2;
    const half = maxW / 2;
    left = Math.max(half + 16, Math.min(vw - half - 16, left));
    setTipStyle({
      position: "fixed",
      left,
      top: rect.top - margin,
      transform: "translate(-50%, -100%)",
      maxWidth: maxW,
      zIndex: 200,
    });
  }, []);

  useLayoutEffect(() => {
    if (!tipOpen) return;
    updateTipPosition();
    const onScrollOrResize = () => updateTipPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [tipOpen, updateTipPosition]);

  const label = row.unlocked ? row.name : "？";
  const pillCls = row.unlocked
    ? `${tierPillClass(row.tier)} ${tipOpen ? "border-rose-700/50 bg-slate-800/95" : ""}`
    : `border border-dashed border-slate-600/85 bg-slate-900/65 text-slate-500 ${tipOpen ? "border-slate-500 bg-slate-800/80" : ""}`;

  return (
    <>
      <span className="relative inline-flex max-w-full align-top">
        <span
          ref={anchorRef}
          className={`cursor-help whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] leading-tight shadow-sm transition ${pillCls}`}
          aria-describedby={tipOpen ? tipId : undefined}
          onMouseEnter={() => setTipOpen(true)}
          onMouseLeave={() => setTipOpen(false)}
        >
          {label}
        </span>
      </span>
      {tipOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            id={tipId}
            role="tooltip"
            className="pointer-events-none rounded-xl border border-slate-600 bg-[#161b22] px-3 py-2.5 text-left text-xs text-slate-200 shadow-2xl"
            style={tipStyle}
          >
            <TitleTooltipBody row={row} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** 好感 / 信任 / 亲密 / 欲望条与关系记忆、上回合数值变化 */
export function CharacterStatsContent({ ui }: { ui: CharacterStatsSlice }) {
  const deltaLine = formatDeltaLine(ui.lastStatDeltas);
  return (
    <>
      <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 px-3 py-2.5 space-y-0.5">
        {bar(ui.affection, "好感", "linear-gradient(90deg,#fda4af,#e11d48)", "text-rose-300")}
        {bar(ui.trust, "信任", "linear-gradient(90deg,#7dd3fc,#0284c7)", "text-sky-300")}
        {bar(ui.intimacy, "亲密", "linear-gradient(90deg,#fcd34d,#ea580c)", "text-amber-300")}
        {bar(ui.desire, "欲望", "linear-gradient(90deg,#c4b5fd,#7c3aed)", "text-violet-300")}
      </div>
      {deltaLine ? (
        <p className="text-center text-[11px] leading-snug text-emerald-400/90">{deltaLine}</p>
      ) : null}
      {ui.flagSummaryLines?.length ? (
        <details className="rounded-lg border border-slate-800/90 bg-slate-950/35 px-2 py-1.5">
          <summary className="cursor-pointer select-none text-left text-[11px] font-medium text-slate-400">
            关系记忆
          </summary>
          <ul className="mt-1.5 space-y-1 border-t border-slate-800/80 pt-1.5 text-left text-[11px] leading-snug text-slate-500">
            {ui.flagSummaryLines.map((row) => (
              <li key={row.id}>
                <span className="text-slate-400">{row.label}</span>
                <span className="text-slate-600"> · </span>
                {row.detail}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** 称号图鉴（可滚动，用于侧栏情境卡内） */
export function CharacterTitlesContent({ ui, compactMaxHeight }: { ui: CharacterTitlesSlice; compactMaxHeight?: string }) {
  const maxH = compactMaxHeight ?? "max-h-[min(42vh,440px)]";
  return (
    <div className={`${maxH} overflow-y-auto overflow-x-hidden pr-1`}>
      <div className="flex flex-wrap content-start gap-1.5" aria-label="称号图鉴">
        {ui.titleRows.map((row) => (
          <TitleTagPill key={row.id} row={row} />
        ))}
      </div>
    </div>
  );
}
