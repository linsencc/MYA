"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { titleRowsForUi } from "@/lib/game/domain/titles";
import type { GameUiPayload } from "@/lib/game/contracts/game-ui";
import type { AppLlmConfigResponse } from "@/lib/game/contracts/app-config";
import { emptyWorldUiBlock } from "@/components/game/world-empty-ui";
import { defaultTeacherWear, defaultTeacherWearNsfw } from "@/lib/game/domain/teacher-wear";
import type { CharacterPanelTab } from "@/components/game/character-side-panel";
import { LocationMapContent } from "@/components/game/character-side-panel";
import { GameReadingColumn } from "@/components/game/game-reading-column";
import { GameSceneBackground } from "@/components/game/game-scene-background";
import { SceneTimeStrip } from "@/components/game/scene-time-strip";
import { SettingsSection } from "@/components/game/settings";
import type { GodForm, GalleryItem } from "@/components/game/settings/types";
import { useChoiceHotkeys } from "@/components/game/use-choice-hotkeys";
import { DEFAULT_PROTAGONIST_DISPLAY_NAME, DEFAULT_PROTAGONIST_ID } from "@/lib/game/application/game-cast-constants";

type ApiPayload = GameUiPayload & {
  statusMsg?: string;
  slots?: string[][];
  clearCustom?: boolean;
  message?: string;
  thinking?: boolean;
};

const emptyPayload: GameUiPayload = {
  storyText: "",
  narration: "",
  affection: 0,
  trust: 5,
  intimacy: 0,
  desire: 0,
  stage: "陌生",
  intimacyStage: "保持距离",
  desireStage: "冷静",
  chapter: 1,
  relationship: "师生",
  timeOfDay: "傍晚",
  calendarLine: "第1天 · 周一 · 傍晚",
  calendarDay: 1,
  weekdayLabel: "周一",
  timeSlot: 4,
  timeSlotLabel: "傍晚",
  playerTurn: 0,
    location: "教室",
  mood: "平静",
  outfit: "白色衬衫、黑色铅笔裙",
  wear: defaultTeacherWear(),
  wearNsfw: defaultTeacherWearNsfw(),
  nsfwMode: true,
  choices: ["继续", "", "", ""],
  choiceTags: ["advance", "advance", "advance", "advance"],
  riskHint: "",
  lastStatDeltas: { affection: 0, trust: 0, intimacy: 0, desire: 0, chapter: 0 },
  endingTitle: "",
  endingSummary: "",
  coldWarRemaining: 0,
  metaCgSeenCount: 0,
  cgForceInterval: 2,
  enableCg: true,
  cgImageSrc: "/api/game/placeholder",
  cgPendingPath: null,
  sceneBackgroundSrc: null,
  sceneAffordances: [] as string[],
  cast: [
    {
      characterId: DEFAULT_PROTAGONIST_ID,
      displayName: DEFAULT_PROTAGONIST_DISPLAY_NAME,
      portraitSrc: "/api/game/placeholder",
      slot: "left" as const,
    },
  ],
  consoleText: "",
  saveLabel: "",
  flags: {},
  titleRows: titleRowsForUi([]),
  newTitleUnlocks: [],
  slots: [],
  chapterThemeShort: "",
  progressHintLines: [],
  flagSummaryLines: [],
  world: emptyWorldUiBlock(),
  characterRoster: [
    {
      id: DEFAULT_PROTAGONIST_ID,
      displayName: DEFAULT_PROTAGONIST_DISPLAY_NAME,
      portraitSrc: "/api/game/placeholder",
      met: true,
      affection: 0,
      trust: 5,
      intimacy: 0,
      desire: 0,
      relationship: "师生",
      mood: "平静",
      location: "教室",
      coldWarRemaining: 0,
      outfit: "白色衬衫、黑色铅笔裙",
      wear: defaultTeacherWear(),
      wearNsfw: defaultTeacherWearNsfw(),
      nsfwMode: true,
      titleRows: titleRowsForUi([]),
      flagSummaryLines: [],
      lastStatDeltas: { affection: 0, trust: 0, intimacy: 0, desire: 0, chapter: 0 },
    },
  ],
};

export default function GameClient() {
  const [tab, setTab] = useState<"game" | "settings">("game");
  const [ui, setUi] = useState<GameUiPayload>(emptyPayload);
  const [statusMsg, setStatusMsg] = useState("");
  const [custom, setCustom] = useState("");
  const [loading, setLoading] = useState(false);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [godKey, setGodKey] = useState("");
  const [godForm, setGodForm] = useState<GodForm>({
    affection: 0,
    trust: 5,
    intimacy: 0,
    desire: 0,
    chapter: 1,
    coldWar: 0,
    calendarDay: 1,
    timeSlot: 4,
    mood: "平静",
    location: "教室",
    wear: defaultTeacherWear(),
    wearNsfw: defaultTeacherWearNsfw(),
    timeOfDay: "傍晚",
    relationship: "师生",
  });
  const [godFlagsText, setGodFlagsText] = useState("{}");
  const [llmConfig, setLlmConfig] = useState<AppLlmConfigResponse | null>(null);
  const [characterPanel, setCharacterPanel] = useState<CharacterPanelTab>("characters");
  const [mapOverlay, setMapOverlay] = useState(false);
  const [titleUnlockBanner, setTitleUnlockBanner] = useState<string[]>([]);
  const [consoleDockVisible, setConsoleDockVisible] = useState(false);
  const consoleBoxRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  /** 仅在进入「设置」时从 ui 填充上帝表单；避免 ui 轮询/刷新把正在编辑的值冲掉 */
  const settingsTabPrevRef = useRef<"game" | "settings">("game");

  const showEmptyGuide = !loading && !ui.storyText?.trim();

  const nonEmptyChoiceIndices = useMemo(
    () => ui.choices.map((c, i) => (c?.trim() ? i : -1)).filter((i) => i >= 0),
    [ui.choices],
  );

  const persistConsoleDockVisible = (visible: boolean) => {
    setConsoleDockVisible(visible);
    try {
      localStorage.setItem("mya_game_console_visible", visible ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const applyPayload = useCallback((data: ApiPayload) => {
    const { statusMsg: sm, slots, clearCustom, message, thinking: _t, ...rest } = data;
    setUi((prev) => ({
      ...prev,
      ...rest,
      nsfwMode: rest.nsfwMode ?? prev.nsfwMode,
      slots: slots ?? prev.slots,
    }));
    if (clearCustom) setCustom("");
    const unlocks = rest.newTitleUnlocks;
    const titleLine =
      unlocks && unlocks.length > 0 ? `解锁称号：${unlocks.join("、")}` : "";
    let combined = "";
    if (message !== undefined) combined = String(message);
    else if (sm !== undefined) combined = String(sm ?? "");
    if (titleLine) combined = combined ? `${combined} · ${titleLine}` : titleLine;
    if (message !== undefined || sm !== undefined || titleLine) setStatusMsg(combined);
    if (rest.newTitleUnlocks?.length) setTitleUnlockBanner([...rest.newTitleUnlocks]);
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const r = await fetch("/api/game/state");
      if (!r.ok) {
        setStatusMsg(`加载状态失败（HTTP ${r.status}）。请确认本机游戏服务已启动后刷新页面。`);
        return;
      }
      const data = (await r.json()) as ApiPayload;
      applyPayload(data);
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : String(e));
    }
  }, [applyPayload]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (tab !== "settings") return;
    void (async () => {
      try {
        const r = await fetch("/api/game/app-config");
        if (!r.ok) return;
        setLlmConfig((await r.json()) as AppLlmConfigResponse);
      } catch {
        setLlmConfig(null);
      }
    })();
  }, [tab]);

  useEffect(() => {
    if (!titleUnlockBanner.length) return;
    const t = window.setTimeout(() => setTitleUnlockBanner([]), 14000);
    return () => window.clearTimeout(t);
  }, [titleUnlockBanner]);

  useEffect(() => {
    try {
      const k = localStorage.getItem("mya_game_god_key");
      if (k) setGodKey(k);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem("mya_game_console_visible") === "0") {
        setConsoleDockVisible(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const prev = settingsTabPrevRef.current;
    settingsTabPrevRef.current = tab;
    if (tab !== "settings") return;
    // 已在设置页时 ui 仍会更新（轮询、出图等），不得再次覆盖本地编辑
    if (prev === "settings") return;
    setGodForm({
      affection: ui.affection,
      trust: ui.trust,
      intimacy: ui.intimacy,
      desire: ui.desire,
      chapter: ui.chapter,
      coldWar: ui.coldWarRemaining,
      calendarDay: ui.calendarDay,
      timeSlot: ui.timeSlot,
      mood: ui.mood,
      location: ui.location,
      wear: { ...ui.wear },
      wearNsfw: { ...ui.wearNsfw },
      timeOfDay: ui.timeOfDay,
      relationship: ui.relationship,
    });
    setGodFlagsText(JSON.stringify(ui.flags ?? {}, null, 2));
  }, [
    tab,
    ui.affection,
    ui.trust,
    ui.intimacy,
    ui.desire,
    ui.chapter,
    ui.coldWarRemaining,
    ui.calendarDay,
    ui.timeSlot,
    ui.mood,
    ui.location,
    ui.wear,
    ui.wearNsfw,
    ui.timeOfDay,
    ui.relationship,
    ui.flags,
  ]);

  useEffect(() => {
    if (tab !== "settings") return;
    void (async () => {
      try {
        const r = await fetch("/api/game/gallery");
        if (!r.ok) return;
        const data = (await r.json()) as { items?: GalleryItem[] };
        setGallery(data.items ?? []);
      } catch {
        setGallery([]);
      }
    })();
  }, [tab]);

  useEffect(() => {
    const el = consoleBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [ui.consoleText]);

  useEffect(() => {
    if (!ui.cgPendingPath) return;
    const t = setInterval(() => {
      void refreshState();
    }, 1200);
    return () => clearInterval(t);
  }, [ui.cgPendingPath, refreshState]);

  const consumeNdjsonActionResponse = useCallback(
    async (r: Response) => {
      const reader = r.body?.getReader();
      if (!reader) {
        const data = (await r.json()) as ApiPayload;
        applyPayload(data);
        return;
      }
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        for (;;) {
          const nl = buf.indexOf("\n");
          if (nl < 0) break;
          const rawLine = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!rawLine) continue;
          let evt: Record<string, unknown>;
          try {
            evt = JSON.parse(rawLine) as Record<string, unknown>;
          } catch {
            continue;
          }
          const t = evt.type;
          if (t === "log" && typeof evt.line === "string") {
            flushSync(() => {
              setUi((prev) => {
                const cur = prev.consoleText?.trim() ?? "";
                const next =
                  !cur || cur === "（尚无日志）" ? evt.line as string : `${prev.consoleText}\n${evt.line}`;
                return { ...prev, consoleText: next };
              });
            });
          }
          if (t === "error" && typeof evt.message === "string") {
            setStatusMsg(evt.message);
          }
          if (t === "done") {
            const { type: _ty, line: _ln, message: _m, ...rest } = evt;
            applyPayload(rest as ApiPayload);
          }
        }
      }
    },
    [applyPayload],
  );

  const postAction = useCallback(
    async (body: Record<string, unknown>) => {
      setLoading(true);
      try {
        const action = String(body.action ?? "");
        const input = String(body.input ?? "").trim();
        const useNdjson =
          (action === "step" && input.length > 0) ||
          (action === "custom" && input.length > 0) ||
          action === "advance_calendar";

        const r = await fetch("/api/game/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const ct = r.headers.get("content-type") ?? "";
        if (useNdjson && ct.includes("ndjson")) {
          if (!r.ok) {
            try {
              const data = (await r.json()) as ApiPayload;
              applyPayload(data);
            } catch {
              setStatusMsg(`请求失败 HTTP ${r.status}`);
            }
            return;
          }
          await consumeNdjsonActionResponse(r);
          return;
        }

        if (!r.ok) {
          try {
            const errBody = (await r.json()) as ApiPayload & { error?: string };
            let msg = `请求失败 HTTP ${r.status}`;
            if (typeof errBody.message === "string") msg = errBody.message;
            else if (typeof errBody.error === "string") msg = errBody.error;
            applyPayload({ ...errBody, message: msg, statusMsg: msg });
          } catch {
            setStatusMsg(`请求失败 HTTP ${r.status}`);
          }
          return;
        }

        const data = (await r.json()) as ApiPayload;
        applyPayload(data);
      } catch (e) {
        setStatusMsg(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [applyPayload, consumeNdjsonActionResponse],
  );

  const submitGodPatch = useCallback(() => {
    let flagsPart: Record<string, string | number | boolean> | undefined;
    const raw = godFlagsText.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          setStatusMsg("flags 须为 JSON 对象");
          return;
        }
        flagsPart = {};
        for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            flagsPart[k] = v;
          }
        }
      } catch {
        setStatusMsg("flags JSON 无法解析");
        return;
      }
    }
    const godPatch: Record<string, unknown> = {
      affection: godForm.affection,
      trust: godForm.trust,
      intimacy: godForm.intimacy,
      desire: godForm.desire,
      chapter: godForm.chapter,
      cold_war_remaining: godForm.coldWar,
      calendar_day: godForm.calendarDay,
      time_slot: godForm.timeSlot,
      mood: godForm.mood,
      location: godForm.location,
      wear: godForm.wear,
      wear_nsfw: godForm.wearNsfw,
      time_of_day: godForm.timeOfDay,
      relationship: godForm.relationship,
    };
    if (flagsPart && Object.keys(flagsPart).length > 0) godPatch.flags = flagsPart;
    try {
      localStorage.setItem("mya_game_god_key", godKey.trim());
    } catch {
      /* ignore */
    }
    void postAction({ action: "god_patch", godKey: godKey.trim(), godPatch });
  }, [godForm, godFlagsText, godKey, postAction]);

  const onChoiceStep = useCallback(
    (choice: string) => void postAction({ action: "step", input: choice }),
    [postAction],
  );

  const onCustomSubmit = useCallback(
    (text: string) => void postAction({ action: "custom", input: text }),
    [postAction],
  );

  useChoiceHotkeys({
    enabled: tab === "game",
    loading,
    choices: ui.choices,
    nonEmptyChoiceIndices,
    customInputRef,
    onStep: onChoiceStep,
  });

  return (
    <>
      {/* 全屏底只用简约纹理渐变；场景 CG 仅在主栏 composite 区展示，避免双层叠加 */}
      <GameSceneBackground src={null} />
      <div className="relative z-10 mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-5 pb-4">
        {/* 标题行：游戏名 + 操作按钮 */}
        <div className="flex items-center justify-between gap-3">
          <div className="game-title min-w-0 flex-1">
            <h1>课后的余晖</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {tab === "game" && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/70 bg-slate-800/60 px-3.5 py-1.5 text-sm font-medium text-slate-300 shadow-sm transition-all hover:border-slate-500/80 hover:bg-slate-700/70"
                aria-controls="game-console"
                aria-expanded={consoleDockVisible}
                onClick={() => persistConsoleDockVisible(!consoleDockVisible)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-400" aria-hidden>
                  <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                控制台
              </button>
            )}
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium shadow-sm transition-all ${
                tab === "settings"
                  ? "border-rose-800/60 bg-rose-950/50 text-rose-200 hover:border-rose-700/70 hover:bg-rose-900/50"
                  : "border-slate-600/70 bg-slate-800/60 text-slate-200 hover:border-slate-500/80 hover:bg-slate-700/70"
              }`}
              onClick={() => setTab(tab === "game" ? "settings" : "game")}
            >
              {tab === "game" ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5 text-slate-400"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.295 1.473c.497.144.971.342 1.411.59l1.262-.924a1 1 0 011.21.13l1.667 1.667a1 1 0 01.13 1.21l-.923 1.261c.248.44.447.914.59 1.411l1.473.296a1 1 0 01.804.98v2.36a1 1 0 01-.804.98l-1.473.295a6.95 6.95 0 01-.59 1.411l.924 1.262a1 1 0 01-.13 1.21l-1.667 1.667a1 1 0 01-1.21.13l-1.261-.923a6.964 6.964 0 01-1.411.59l-.296 1.473a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.295-1.473a6.957 6.957 0 01-1.411-.59l-1.262.924a1 1 0 01-1.21-.13L2.196 15.75a1 1 0 01-.13-1.21l.923-1.261a6.956 6.956 0 01-.59-1.411l-1.473-.296A1 1 0 010 11.18V8.82a1 1 0 01.804-.98l1.473-.295c.144-.497.342-.971.59-1.411L1.944 4.87a1 1 0 01.13-1.21L3.74 2.001a1 1 0 011.21-.13l1.261.923a6.946 6.946 0 011.411-.59L7.84 1.804zM10 13a3 3 0 100-6 3 3 0 000 6z"
                      clipRule="evenodd"
                    />
                  </svg>
                  设置
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                      clipRule="evenodd"
                    />
                  </svg>
                  返回游戏
                </>
              )}
            </button>
          </div>
        </div>
        {/* 设置页不展示顶部信息带（日历 / 地点 / 行动） */}
        {tab === "game" ? (
          <SceneTimeStrip
            variant="header"
            location={ui.location}
            calendarDay={ui.calendarDay}
            weekdayLabel={ui.weekdayLabel}
            timeSlot={ui.timeSlot}
            timeSlotLabel={ui.timeSlotLabel}
            playerTurn={ui.playerTurn}
            coldWarRemaining={ui.coldWarRemaining}
            headerCalendarAdvance={{
              loading,
              onNextSlot: () => void postAction({ action: "advance_calendar", calendarKind: "next_slot" }),
              onNextMorning: () =>
                void postAction({ action: "advance_calendar", calendarKind: "next_morning" }),
            }}
            headerLocationOpenMap={() => setMapOverlay((v) => !v)}
            headerLocationPanelActive={mapOverlay}
            headerTravelMovesBadge={
              ui.world.travelMovesMax != null && ui.world.travelMovesRemaining != null
                ? { remaining: ui.world.travelMovesRemaining, max: ui.world.travelMovesMax }
                : null
            }
          />
        ) : null}
      </header>

      {statusMsg ? (
        <div
          className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
          role="status"
          aria-live="polite"
        >
          <span className="min-w-0 flex-1">{statusMsg}</span>
          <button
            type="button"
            className="shrink-0 rounded px-2 py-0.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="关闭提示"
            onClick={() => setStatusMsg("")}
          >
            关闭
          </button>
        </div>
      ) : null}

      {tab === "game" ? (
        <>
          <div className={consoleDockVisible ? "pb-game-console" : undefined}>
            {mapOverlay ? (
              <div className="rounded-2xl border border-slate-700/80 bg-slate-900/50 p-4 shadow-inner sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-200">地点图鉴</h2>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/70 bg-slate-800/60 px-3 py-1.5 text-sm font-medium text-slate-200 shadow-sm transition hover:border-slate-500/80 hover:bg-slate-700/70"
                    onClick={() => setMapOverlay(false)}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
                      <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
                    </svg>
                    返回游戏
                  </button>
                </div>
                <LocationMapContent
                  ui={ui}
                  travelLoading={loading}
                  onTravelTo={(locationId) => {
                    void postAction({ action: "travel", locationId });
                    setMapOverlay(false);
                  }}
                />
              </div>
            ) : (
              <GameReadingColumn
                ui={ui}
                loading={loading}
                showEmptyGuide={showEmptyGuide}
                titleUnlockBanner={titleUnlockBanner}
                onDismissTitleBanner={() => setTitleUnlockBanner([])}
                characterPanel={characterPanel}
                onCharacterPanel={setCharacterPanel}
                onTravelTo={(locationId) => void postAction({ action: "travel", locationId })}
                onUseItem={(itemId) => void postAction({ action: "use_item", itemId })}
                onShopBuy={(listingId) => void postAction({ action: "shop_buy", listingId })}
                onPhoneRead={(threadId) => void postAction({ action: "phone_read", threadId })}
                custom={custom}
                setCustom={setCustom}
                customInputRef={customInputRef}
                onStep={onChoiceStep}
                onCustomSubmit={onCustomSubmit}
                onStartGame={() => void postAction({ action: "start" })}
              />
            )}
          </div>

          {consoleDockVisible ? (
            <section
              className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/90 bg-[#0d1117]/95 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur-md"
              aria-label="控制台日志"
            >
              <div className="mx-auto max-w-7xl px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    控制台 / 进度日志
                  </h2>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-[10px] text-slate-600 sm:inline">LLM · CG · 存档</span>
                    <button
                      type="button"
                      className="rounded-md border border-slate-600/80 bg-slate-800/70 px-2 py-1 text-[11px] font-medium text-slate-300 transition hover:border-slate-500 hover:bg-slate-700/70"
                      aria-expanded={consoleDockVisible}
                      onClick={() => persistConsoleDockVisible(false)}
                    >
                      隐藏
                    </button>
                  </div>
                </div>
                <div ref={consoleBoxRef} className="game-console game-console-docked mt-1.5" id="game-console">
                  {ui.consoleText}
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <SettingsSection
          ui={ui}
          loading={loading}
          onPostAction={(body) => void postAction(body)}
          godKey={godKey}
          setGodKey={setGodKey}
          godForm={godForm}
          setGodForm={setGodForm}
          godFlagsText={godFlagsText}
          setGodFlagsText={setGodFlagsText}
          onSubmitGodPatch={() => void submitGodPatch()}
          gallery={gallery}
          llmConfig={llmConfig}
          onLlmConfigUpdated={setLlmConfig}
          onStatusMessage={setStatusMsg}
        />
      )}
    </div>
    </>
  );
}
