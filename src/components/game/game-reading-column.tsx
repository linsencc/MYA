"use client";

import { useMemo, useState, type RefObject } from "react";
import type { GameUiPayload, UiCharacterReply, UiMultiChoice } from "@/lib/game/contracts/game-ui";
import {
  CharacterSidePanel,
  type CharacterPanelTab,
} from "@/components/game/character-side-panel";
import {
  choiceTagLabel,
  choiceTagStyle,
  effectiveRiskHintForDisplay,
} from "@/components/game/game-reading-utils";
import { CgCrossfadeImage } from "@/components/game/cg-crossfade-image";

function EmptyReadingCard({ onStartGame, disabled }: { onStartGame: () => void; disabled: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-600/60 bg-slate-950/50 p-5 text-center shadow-inner">
      <h2 className="text-base font-semibold text-slate-200">尚未载入剧情</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        点击「开始游戏」载入开场；读档与多槽管理在「设置」中。
      </p>
      <button
        type="button"
        disabled={disabled}
        className="mt-5 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 px-5 py-2.5 text-sm font-medium text-white shadow-md transition hover:from-rose-500 hover:to-rose-400 disabled:opacity-50"
        onClick={onStartGame}
      >
        开始游戏
      </button>
    </div>
  );
}

function InnerMonologue({ narration, label }: { narration: string; label?: string }) {
  const [expanded, setExpanded] = useState(false);
  const body = narration?.trim() || "（此刻心如止水……）";
  const long = body.length > 72;
  return (
    <div className="shrink-0 border-t border-slate-800/80 bg-slate-950/25 px-3 py-2 sm:px-4">
      <p className="text-[11px] font-medium text-slate-500">{label ?? "陈悦的内心独白"}</p>
      <p className={`mt-2 text-[13px] leading-relaxed text-slate-400 ${!expanded && long ? "line-clamp-2" : ""}`}>
        {body}
      </p>
      {long ? (
        <button
          type="button"
          className="mt-1.5 text-[12px] font-medium text-sky-400/90 hover:text-sky-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/50"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}
    </div>
  );
}

/** 多角色模式：单角色台词块 */
function CharacterReplyBlock({ reply }: { reply: UiCharacterReply }) {
  return (
    <div className="mb-3 last:mb-0 border-l-2 border-sky-700/60 pl-3">
      <p className="mb-1 text-[11px] font-semibold text-sky-400/90">{reply.displayName}</p>
      {reply.text.split("\n\n").map((para, i) => (
        <p key={i} className="mb-1.5 last:mb-0 leading-relaxed text-slate-100/95 text-[0.9375rem]">
          {para}
        </p>
      ))}
    </div>
  );
}

/** 多角色模式：分角色分组选项 */
function GroupedChoices({
  multiChoices,
  loading,
  onStep,
}: {
  multiChoices: UiMultiChoice[];
  loading: boolean;
  onStep: (choice: string) => void;
}) {
  // Group choices by speaker
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, UiMultiChoice[]>();
    for (const c of multiChoices) {
      if (!c.label.trim()) continue;
      if (!map.has(c.speaker)) {
        order.push(c.speaker);
        map.set(c.speaker, []);
      }
      map.get(c.speaker)!.push(c);
    }
    return order.map((speaker) => ({ speaker, choices: map.get(speaker) ?? [] }));
  }, [multiChoices]);

  return (
    <div className="flex flex-col gap-2 p-2">
      {groups.map((group) => (
        <div key={group.speaker}>
          <p className="mb-1 px-1 text-[11px] font-semibold text-sky-400/80">
            {group.choices[0]?.speakerDisplayName ?? group.speaker}
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {group.choices.map((c, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                className={`flex min-h-[48px] flex-row items-stretch rounded-xl border bg-slate-800/50 px-3 py-2.5 text-left text-sm leading-snug text-slate-100 shadow-sm transition hover:bg-slate-700/55 disabled:opacity-50 active:scale-[0.99] ${choiceTagStyle(c.tag)}`}
                onClick={() => onStep(c.label)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    {choiceTagLabel(c.tag)}
                  </span>
                  <span>{c.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GameReadingColumn({
  ui,
  loading,
  showEmptyGuide,
  titleUnlockBanner,
  onDismissTitleBanner,
  characterPanel,
  onCharacterPanel,
  onTravelTo,
  onUseItem,
  onShopBuy,
  onPhoneRead,
  custom,
  setCustom,
  customInputRef,
  onStep,
  onCustomSubmit,
  onStartGame,
}: {
  ui: GameUiPayload;
  loading: boolean;
  showEmptyGuide: boolean;
  titleUnlockBanner: string[];
  onDismissTitleBanner: () => void;
  characterPanel: CharacterPanelTab;
  onCharacterPanel: (p: CharacterPanelTab) => void;
  onTravelTo: (locationId: string) => void;
  onUseItem: (itemId: string) => void;
  onShopBuy: (listingId: string) => void;
  onPhoneRead: (threadId: string) => void;
  custom: string;
  setCustom: (v: string) => void;
  customInputRef: RefObject<HTMLInputElement | null>;
  onStep: (choice: string) => void;
  onCustomSubmit: (text: string) => void;
  onStartGame: () => void;
}) {
  const nonEmptyChoiceIndices = useMemo(
    () => ui.choices.map((c, i) => (c?.trim() ? i : -1)).filter((i) => i >= 0),
    [ui.choices],
  );

  const riskDisplayLine = useMemo(() => effectiveRiskHintForDisplay(ui), [ui]);
  const isMultiChar = Boolean(ui.replies && ui.replies.length > 1);
  const hasMultiChoices = Boolean(ui.multiChoices && ui.multiChoices.length > 0);

  return (
    <main className="flex min-h-0 min-w-0 flex-col gap-3">
      {/* Full-width CG composite area: scene BG + character portrait, tabs overlay */}
      <div className="w-full overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 shadow-lg shadow-black/30">
        {/* Inner composite layer: scene BG + portrait + tabs all composited together */}
        <div
          className="relative flex items-end bg-slate-950"
          style={{ minHeight: "min(58vh, 640px)" }}
        >
          {/* Scene background: object-contain so wide/tall art is not cropped by object-cover */}
          {ui.sceneBackgroundSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ui.sceneBackgroundSrc}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full object-contain object-center opacity-60"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />
          )}
          {/* Character CG: left-aligned portrait, above scene BG */}
          <div className="relative z-10 ml-8 w-[45%] max-w-[280px] shrink-0 self-end sm:ml-12">
            <CgCrossfadeImage src={ui.cgImageSrc} />
            {ui.cgPendingPath ? (
              <p className="bg-slate-950/70 px-2 py-1 text-center text-[11px] text-sky-300/85">
                新 CG 生成中…
              </p>
            ) : null}
          </div>
          {/* Tab panel overlay: same vertical inset as horizontal (symmetric with CG frame) */}
          <div className="absolute inset-y-2 right-2 z-20 flex min-h-0 w-[54%] max-w-sm flex-col">
            <CharacterSidePanel
              ui={ui}
              panel={characterPanel}
              onPanel={onCharacterPanel}
              onTravelTo={onTravelTo}
              travelLoading={loading}
              onUseItem={onUseItem}
              onShopBuy={onShopBuy}
              onPhoneRead={onPhoneRead}
            />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex w-full max-w-full flex-col overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/45 shadow-inner ring-1 ring-sky-500/10">
          {titleUnlockBanner.length > 0 ? (
            <div
              className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-700/35 bg-amber-950/55 px-4 py-2.5 text-left text-sm text-amber-50"
              role="status"
            >
              <span>
                <span className="font-semibold text-amber-200/95">新称号</span>
                <span className="text-amber-100/90"> · {titleUnlockBanner.join("、")}</span>
              </span>
              <button
                type="button"
                className="shrink-0 rounded border border-amber-700/50 px-2 py-0.5 text-[11px] text-amber-100 hover:bg-amber-900/40"
                onClick={onDismissTitleBanner}
              >
                收起
              </button>
            </div>
          ) : null}
          <div
            className={`story-html story-html-scroll max-h-[min(34vh,260px)] overflow-y-auto overscroll-y-contain p-3 text-[0.9375rem] leading-relaxed sm:max-h-[min(38vh,300px)] sm:p-3.5 sm:text-[0.95rem] lg:max-h-[min(44vh,380px)] xl:max-h-[min(50vh,460px)] ${loading ? "thinking" : ""}`}
            role="region"
            aria-label="剧情文本"
            aria-busy={loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2 text-slate-400">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky-400/80" aria-hidden />
                叙事生成中…
              </span>
            ) : showEmptyGuide ? (
              <EmptyReadingCard onStartGame={onStartGame} disabled={loading} />
            ) : isMultiChar && ui.replies ? (
              <>
                {/* Scene-level narration */}
                {ui.narration?.trim() ? (
                  <p className="mb-3 text-[0.875rem] italic text-slate-400/90 leading-relaxed">
                    {ui.narration}
                  </p>
                ) : null}
                {ui.replies.map((reply) => (
                  <CharacterReplyBlock key={reply.speaker} reply={reply} />
                ))}
              </>
            ) : (
              ui.storyText.split("\n\n").map((para, i) => (
                <p key={i} className="mb-3 last:mb-0 leading-relaxed text-slate-100/95">
                  {para}
                </p>
              ))
            )}
          </div>
          {/* Inner monologue: multi-char shows first character's narration, single-char shows default */}
          {isMultiChar && ui.replies ? (
            ui.replies
              .filter((r) => r.narration?.trim())
              .map((r) => (
                <InnerMonologue
                  key={r.speaker}
                  narration={r.narration}
                  label={`${r.displayName}的内心独白`}
                />
              ))
          ) : (
            <InnerMonologue narration={ui.narration ?? ""} />
          )}
          {riskDisplayLine ? (
            <div
              className="flex shrink-0 gap-2 border-t border-amber-900/30 bg-amber-950/[0.1] px-4 py-2.5 text-xs leading-snug text-amber-100/90"
              role="note"
            >
              <span className="shrink-0 font-semibold text-amber-400/95">风险</span>
              <span className="min-w-0">{riskDisplayLine}</span>
            </div>
          ) : null}
        </div>
        <div
          className="shrink-0 overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/50 shadow-inner ring-1 ring-white/[0.03]"
          role="group"
          aria-label="本回合交互区"
        >
          {/* 选项区 */}
          <div role="group" aria-label="本回合选项">
            {showEmptyGuide ? (
              <p className="px-3 py-2 text-sm text-slate-500">
                开始游戏后，这里会出现 2–4 个选项；也可用键盘{" "}
                <kbd className="rounded border border-slate-600 bg-slate-800 px-1">1</kbd>–
                <kbd className="rounded border border-slate-600 bg-slate-800 px-1">4</kbd>{" "}
                快速选择（输入框聚焦时无效）。
              </p>
            ) : hasMultiChoices && ui.multiChoices ? (
              <GroupedChoices multiChoices={ui.multiChoices} loading={loading} onStep={onStep} />
            ) : (
              <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
                {ui.choices.map((c, i) => {
                  if (!c?.trim()) return null;
                  const keySlot = nonEmptyChoiceIndices.indexOf(i);
                  const keyLabel = keySlot >= 0 ? String(keySlot + 1) : "";
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={loading}
                      className={`group flex min-h-[52px] flex-row items-stretch rounded-xl border bg-slate-800/50 px-3 py-3 text-left text-sm leading-snug text-slate-100 shadow-sm transition hover:bg-slate-700/55 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/50 disabled:opacity-50 active:scale-[0.99] ${keyLabel ? "gap-3" : ""} ${choiceTagStyle(ui.choiceTags[i] ?? "advance")}`}
                      onClick={() => onStep(c)}
                    >
                      {keyLabel ? (
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-lg border border-slate-600/80 bg-slate-900/90 font-mono text-xs font-bold text-slate-300 shadow-inner transition group-hover:border-sky-500/40 group-hover:text-sky-200/95"
                          aria-hidden
                        >
                          {keyLabel}
                        </span>
                      ) : null}
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-500">
                          {choiceTagLabel(ui.choiceTags[i] ?? "advance")}
                        </span>
                        <span>{c}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* 分隔线 */}
          <div className="mx-2 border-t border-slate-700/60" />
          {/* 自由输入区 */}
          <div className="px-2 py-2">
            <input
              ref={customInputRef}
              disabled={loading}
              className="w-full min-h-[44px] rounded-xl border border-slate-700/50 bg-slate-800/50 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-rose-500/40 focus:outline-none focus:ring-2 focus:ring-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="自由输入… Enter 发送；未聚焦时 1–4 选上方选项"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && custom.trim() && !loading) {
                  onCustomSubmit(custom.trim());
                }
              }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
