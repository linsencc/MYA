import type { GameState } from "@/lib/game/domain/state";

export const MAX_CHAPTER = 7;

/**
 * 当前章节下，好感达到该值时系统可自动升一章（与 LLM chapter_delta 并行，见引擎）。
 * 第 7 章无下一里程碑时返回 null。
 */
export function milestoneAffectionThresholdForChapter(ch: number): number | null {
  const c = Math.floor(ch);
  if (c >= MAX_CHAPTER) return null;
  return 12 + c * 11;
}

/**
 * LLM 已提交非零 chapter_delta 时不调用。
 * 按好感阈值尝试升一章（防模型忘推进）。
 */
export function maybeMilestoneChapter(state: GameState): number {
  const ch = state.chapter;
  if (ch >= MAX_CHAPTER) return ch;
  const th = milestoneAffectionThresholdForChapter(ch);
  if (th === null) return ch;
  if (state.affection >= th) return Math.min(MAX_CHAPTER, ch + 1);
  return ch;
}
