import { CHAPTER_SETTINGS } from "@/lib/game/content/prompts";
import type { GameState } from "@/lib/game/domain/state";
import {
  MAX_CHAPTER,
  milestoneAffectionThresholdForChapter,
} from "@/lib/game/domain/chapter-milestones";

const THEME_MAX_LEN = 44;

const DEFAULT_CHAPTER_THEME = "你和陈悦老师在校园某处相遇。";

function truncateTheme(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= THEME_MAX_LEN) return t;
  return `${t.slice(0, THEME_MAX_LEN)}…`;
}

/** 当前章情境摘要（与 CHAPTER_SETTINGS 一致，截断防占屏） */
export function chapterThemeShortFromState(state: Pick<GameState, "chapter">): string {
  const ch = Math.max(1, Math.floor(state.chapter));
  const raw = CHAPTER_SETTINGS[ch] ?? DEFAULT_CHAPTER_THEME;
  return truncateTheme(raw);
}

/**
 * 里程碑好感线：与引擎自动升章一致，不等同于「必须剧情条件」；
 * LLM 仍可用 chapter_delta 提前/延后换章。
 */
export function buildProgressHintLines(state: GameState): string[] {
  const lines: string[] = [];
  const ch = Math.max(1, Math.floor(state.chapter));
  const aff = Math.max(0, Math.floor(state.affection));

  if (ch < MAX_CHAPTER) {
    const th = milestoneAffectionThresholdForChapter(ch);
    if (th !== null) {
      if (aff < th) {
        const gap = th - aff;
        lines.push(
          `系统好感契机：再积累约 ${gap} 点好感时，可能配合解锁下一章推进窗口（剧情仍须自然发展，非唯一条件）。`,
        );
      } else {
        lines.push("好感已满足当前章节下的系统推进契机，留意剧情中的转折与事件。");
      }
    }
  }

  if (state.cold_war_remaining > 0) {
    lines.push(
      `关系偏冷（约 ${state.cold_war_remaining} 回合疏离感）：优先真诚与分寸，修复信任后再推亲密。`,
    );
    if (state.trust >= 8 && state.trust < 12) {
      lines.push(
        "信任继续向 12 以上走时，疏离感更容易随剧情回落；可善用背包物品与稳重选项。",
      );
    }
    lines.push(
      "玩法：标题栏「地点」可换场景（同一时段有移动次数上限，用尽后需推进时段）；侧栏「背包」内部分道具可微调信任；「手机」未读可点已读。",
    );
  } else if (state.trust < 12) {
    lines.push("信任度偏低：她容易保持距离；稳重、尊重的选择更易稳住关系。");
  }

  if (state.history.length <= 6) {
    lines.push(
      "标题栏「地点」可换场景（每时段有移动次数）；侧栏「背包」里部分物品可「使用」微调信任；「手机」未读可点「已读」收束分心。",
    );
  }

  return lines;
}

export function buildPlayerProgressHints(state: GameState): {
  chapterThemeShort: string;
  progressHintLines: string[];
} {
  return {
    chapterThemeShort: chapterThemeShortFromState(state),
    progressHintLines: buildProgressHintLines(state),
  };
}
