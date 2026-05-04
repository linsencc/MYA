import { TIME_SLOT_COUNT, TIME_SLOT_LABELS } from "@/lib/game/domain/calendar";

export type SceneTimeStripVariant = "aside" | "header";

export type HeaderCalendarAdvance = {
  loading: boolean;
  onNextSlot: () => void;
  onNextMorning: () => void;
};

/** header 地点栏：本时段剩余 / 上限（与侧栏原「地点」角标一致） */
export type HeaderTravelMovesBadge = {
  remaining: number;
  max: number;
};

/** 日历天 + 当日 6 时段条 + 累计行动次数（与日历档分开） */
export function SceneTimeStrip({
  calendarDay,
  weekdayLabel,
  timeSlot,
  timeSlotLabel,
  playerTurn,
  coldWarRemaining,
  location,
  variant = "aside",
  headerCalendarAdvance,
  headerLocationOpenMap,
  headerLocationPanelActive,
  headerTravelMovesBadge,
}: {
  calendarDay: number;
  weekdayLabel: string;
  timeSlot: number;
  timeSlotLabel: string;
  playerTurn: number;
  coldWarRemaining: number;
  /** 当前地点（标题栏模式：与时间并排） */
  location?: string | null;
  /** aside：侧栏卡片内；header：标题下全宽（不含冷战等关系向信息） */
  variant?: SceneTimeStripVariant;
  /** header：与时间与地点同一卡片内展示「下一时段 / 次日清晨」 */
  headerCalendarAdvance?: HeaderCalendarAdvance;
  /** header：点击地点栏打开侧栏地点图鉴（换场景） */
  headerLocationOpenMap?: () => void;
  /** header：侧栏是否正在展示地点图鉴 */
  headerLocationPanelActive?: boolean;
  /** header：地点栏旁展示本时段可移动次数 */
  headerTravelMovesBadge?: HeaderTravelMovesBadge | null;
}) {
  const slot = Math.max(0, Math.min(TIME_SLOT_COUNT - 1, Math.floor(timeSlot)));
  const slotShort = ["清", "上", "中", "下", "傍", "晚"] as const;

  const isHeader = variant === "header";

  const showLocation = location != null && location !== "";

  // ── aside variant (侧栏，保持原样) ──────────────────────────────────────
  if (!isHeader) {
    const helperText = "用下方「下一时段 / 次日清晨」推进日历档；与上方行动次数分开计。";
    return (
      <div
        className="mb-2 rounded-lg border border-sky-900/25 bg-slate-900/55 px-3 py-2 shadow-inner"
        aria-label="剧情时间与行动"
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-b border-slate-800/55 pb-2">
          <span className="shrink-0 text-[11px] font-medium text-slate-500">时间与行动</span>
          <span className="shrink-0 rounded-md border border-slate-600/55 bg-slate-950/45 px-2 py-0.5 font-mono text-[11px] tabular-nums text-slate-200">
            {playerTurn <= 0 ? "开场 · 待选择" : `行动第 ${playerTurn} 次`}
          </span>
        </div>
        <p className="min-w-0 text-[11px] leading-snug text-slate-400">
          第 <span className="font-medium text-slate-200">{calendarDay}</span> 天 ·{" "}
          <span className="text-slate-300">{weekdayLabel}</span>
          <span className="text-slate-600"> · </span>
          当前 <span className="font-medium text-sky-200/90">{timeSlotLabel}</span>
          <span className="text-slate-600">（今日第 </span>
          <span className="font-medium text-slate-200">{slot + 1}</span>
          <span className="text-slate-600"> / {TIME_SLOT_COUNT} 时段）</span>
        </p>
        {(showLocation || playerTurn <= 0) && (
          <p className="mt-1 text-[11px] leading-snug text-slate-300/95">
            {playerTurn <= 0 ? (
              <span className="text-slate-500">◎ —</span>
            ) : showLocation ? (
              <span className="flex min-w-0 max-w-full items-baseline gap-1.5" title={location!}>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-slate-500">地点</span>
                <span className="min-w-0 truncate font-medium text-slate-100/90">{location}</span>
              </span>
            ) : (
              <span className="text-slate-500">◎ —</span>
            )}
          </p>
        )}
        <p className="mt-1 text-[10px] leading-snug text-slate-500">{helperText}</p>
        {coldWarRemaining > 0 && (
          <p className="mt-0.5 text-[11px] text-amber-300/90">冷战余约 {coldWarRemaining} 回合</p>
        )}
        <div className="mt-2" role="list" aria-label="当日时段进度">
          <div className="flex gap-1">
            {TIME_SLOT_LABELS.map((lab, i) => {
              const active = i === slot;
              const past = i < slot;
              return (
                <div key={lab} className="min-w-0 flex-1" title={`${lab}${active ? "（当前）" : ""}`}>
                  <div className={`h-1.5 rounded-sm transition-colors sm:h-2 ${active ? "bg-sky-400" : past ? "bg-slate-500/50" : "bg-slate-800/90"}`} />
                  <span className={`mt-0.5 block truncate text-center text-[9px] leading-none sm:mt-1 ${active ? "font-semibold text-sky-200/90" : past ? "text-slate-500" : "text-slate-600"}`}>
                    {slotShort[i] ?? "·"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── header variant（全宽三栏信息带）──────────────────────────────────────
  const hasAdvance = !!headerCalendarAdvance;

  return (
    <div
      className="mt-3 w-full overflow-hidden rounded-xl border border-slate-700/40 bg-slate-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      aria-label={
        hasAdvance
          ? `剧情时间、地点与推进日历，当前${timeSlotLabel}`
          : `剧情时间与地点，当前${timeSlotLabel}`
      }
    >
      {/* 三栏主体 */}
      <div className="flex flex-wrap items-stretch divide-x divide-slate-800/60 sm:flex-nowrap">

        {/* 左栏：日历 + 时段标签（占满地点栏省下的宽度） */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold tabular-nums text-slate-100">
              第 {calendarDay} 天
            </span>
            <span className="text-[11px] text-slate-400">{weekdayLabel}</span>
          </div>
          {/* 时段进度条 */}
          <div className="flex gap-1" role="list" aria-label="当日时段进度">
            {TIME_SLOT_LABELS.map((lab, i) => {
              const active = i === slot;
              const past = i < slot;
              return (
                <div key={lab} className="min-w-0 flex-1" title={`${lab}${active ? "（当前）" : ""}`} role="listitem">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      active
                        ? "bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.5)]"
                        : past
                          ? "bg-slate-500/60"
                          : "bg-slate-800"
                    }`}
                  />
                  <span
                    className={`mt-0.5 block text-center text-[9px] leading-none ${
                      active ? "font-bold text-sky-300" : past ? "text-slate-500" : "text-slate-700"
                    }`}
                  >
                    {slotShort[i] ?? "·"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 中栏：地点（可点击打开侧栏地点图鉴） */}
        {headerLocationOpenMap ? (
          <button
            type="button"
            className={`flex min-h-0 min-w-0 w-auto max-w-[11rem] shrink-0 flex-col justify-center px-3 py-2.5 text-left transition sm:max-w-[12rem] sm:min-w-[9rem] sm:px-4 focus-visible:z-[1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-sky-500/50 ${
              headerLocationPanelActive
                ? "bg-sky-950/30 ring-1 ring-inset ring-sky-700/35 hover:bg-sky-950/40"
                : "hover:bg-slate-800/40"
            }`}
            aria-pressed={Boolean(headerLocationPanelActive)}
            aria-label="打开地点图鉴，切换场景"
            onClick={headerLocationOpenMap}
          >
            <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">地点</span>
              {headerTravelMovesBadge ? (
                <span className="rounded bg-sky-900/70 px-1 py-px text-[10px] font-normal tabular-nums text-sky-100">
                  {headerTravelMovesBadge.remaining}/{headerTravelMovesBadge.max}
                </span>
              ) : null}
            </div>
            {playerTurn <= 0 || !showLocation ? (
              <span className="text-[11px] text-slate-600">—</span>
            ) : (
              <span
                className="line-clamp-2 min-w-0 break-words text-[13px] font-medium leading-snug text-slate-100"
                title={location!}
              >
                {location}
              </span>
            )}
          </button>
        ) : (
          <div className="flex min-h-0 min-w-0 w-auto max-w-[11rem] shrink-0 flex-col justify-center px-3 py-2.5 sm:max-w-[12rem] sm:min-w-[9rem] sm:px-4">
            <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">地点</span>
              {headerTravelMovesBadge ? (
                <span className="rounded bg-sky-900/70 px-1 py-px text-[10px] font-normal tabular-nums text-sky-100">
                  {headerTravelMovesBadge.remaining}/{headerTravelMovesBadge.max}
                </span>
              ) : null}
            </div>
            {playerTurn <= 0 || !showLocation ? (
              <span className="text-[11px] text-slate-600">—</span>
            ) : (
              <span
                className="line-clamp-2 min-w-0 break-words text-[13px] font-medium leading-snug text-slate-100"
                title={location!}
              >
                {location}
              </span>
            )}
          </div>
        )}

        {/* 右栏：行动次数 + 推进按钮（同一行横排） */}
        <div className="flex w-64 shrink-0 flex-row flex-wrap items-center justify-end gap-x-2 gap-y-1 px-3 py-2.5 sm:px-4">
          <span
            className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ${
              playerTurn <= 0
                ? "bg-slate-800/50 text-slate-400 ring-slate-700/50"
                : "bg-rose-950/40 text-rose-200 ring-rose-800/50"
            }`}
          >
            {playerTurn <= 0 ? (
              "开场"
            ) : (
              <>
                <span className="font-normal text-rose-400/75">行动</span>
                {playerTurn}
                <span className="font-normal text-rose-400/75">次</span>
              </>
            )}
          </span>
          {hasAdvance && headerCalendarAdvance && (
            <div
              className="flex shrink-0 gap-1"
              role="group"
              aria-label="推进日历"
            >
              <p id="header-calendar-advance-desc" className="sr-only">
                推进日历将请求一轮叙事并计入行动次数
              </p>
              <button
                type="button"
                disabled={headerCalendarAdvance.loading}
                title="进入当天下一时段（晚间之后则进入次日清晨）；会请求一轮叙事"
                aria-describedby="header-calendar-advance-desc"
                className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/50 px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-sky-500/50 hover:bg-slate-700/60 hover:text-slate-100 disabled:opacity-40"
                onClick={headerCalendarAdvance.onNextSlot}
              >
                下一时段
              </button>
              <button
                type="button"
                disabled={headerCalendarAdvance.loading}
                title="睡到次日清晨；会请求一轮叙事"
                aria-describedby="header-calendar-advance-desc"
                className="inline-flex h-7 shrink-0 items-center justify-center rounded-lg border border-slate-600/60 bg-slate-800/50 px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-emerald-500/50 hover:bg-slate-700/60 hover:text-slate-100 disabled:opacity-40"
                onClick={headerCalendarAdvance.onNextMorning}
              >
                次日清晨
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
