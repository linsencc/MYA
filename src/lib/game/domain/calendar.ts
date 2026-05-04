/** 确定性日历：时段、星期；不由 LLM 改写 */

/**
 * 一天内的时段（校园 AVG：通勤/上课/午休/社团/放学后/夜间）。
 * 索引用于存档与叙事参考顺序。
 */
export const TIME_SLOT_COUNT = 6;

export const TIME_SLOT_LABELS = [
  "清晨",
  "上午",
  "中午",
  "下午",
  "傍晚",
  "晚上",
] as const;

/**
 * 故事第 1 天（calendar_day === 1）对应的星期：0=周一 … 6=周日
 */
export const STORY_START_WEEKDAY_INDEX = 0;

const WEEKDAYS_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function weekdayCnForCalendarDay(day: number): string {
  const d = Math.max(1, Math.floor(day));
  const idx = (STORY_START_WEEKDAY_INDEX + (d - 1)) % 7;
  return WEEKDAYS_CN[idx];
}

export function timeSlotLabel(slot: number): string {
  const s = Math.max(0, Math.min(TIME_SLOT_COUNT - 1, Math.floor(slot)));
  return TIME_SLOT_LABELS[s];
}

export function buildCalendarLine(state: { calendar_day: number; time_slot: number }): string {
  const day = Math.max(1, Math.floor(state.calendar_day));
  const wd = weekdayCnForCalendarDay(day);
  const slot = timeSlotLabel(state.time_slot);
  return `第${day}天 · ${wd} · ${slot}`;
}

/** 手动推进日历：下一时段，或跨日至清晨 */
export type CalendarAdvanceKind = "next_slot" | "next_morning";

export function advanceCalendar(
  state: { calendar_day: number; time_slot: number },
  kind: CalendarAdvanceKind,
): void {
  if (kind === "next_morning") {
    state.calendar_day = Math.max(1, state.calendar_day) + 1;
    state.time_slot = 0;
    return;
  }
  if (state.time_slot < TIME_SLOT_COUNT - 1) {
    state.time_slot += 1;
  } else {
    state.calendar_day = Math.max(1, state.calendar_day) + 1;
    state.time_slot = 0;
  }
}

export function refreshTimeOfDayFromSlot(state: { time_slot: number; time_of_day: string }): void {
  state.time_of_day = timeSlotLabel(state.time_slot).slice(0, 40);
}
