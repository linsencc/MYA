import { DEFAULT_RISK_HINT_WHEN_TAGS_RISK } from "@/lib/game/content/story-flags";
import type { GameUiPayload } from "@/lib/game/contracts/game-ui";

export function formatDeltaLine(d: GameUiPayload["lastStatDeltas"]): string {
  const parts: string[] = [];
  const fmt = (name: string, v: number) => {
    if (v === 0) return;
    parts.push(`${name}${v > 0 ? "+" : ""}${v}`);
  };
  fmt("好感", d.affection);
  fmt("信任", d.trust);
  fmt("亲密", d.intimacy);
  fmt("欲望", d.desire);
  if (d.chapter !== 0) parts.push(`章节${d.chapter > 0 ? "+" : ""}${d.chapter}`);
  return parts.length ? `本回合：${parts.join(" · ")}` : "";
}

export function choiceTagStyle(tag: string): string {
  if (tag === "risk") return "border-rose-800/60 hover:border-rose-600/70";
  if (tag === "probe") return "border-amber-700/50 hover:border-amber-600/60";
  return "border-slate-600 hover:border-rose-800/60";
}

export function choiceTagLabel(tag: string): string {
  if (tag === "risk") return "冒险";
  if (tag === "probe") return "试探";
  return "推进";
}

/** LLM 未填 risk_hint 时，含 risk 标签则给系统兜底说明（不写回存档） */
export function effectiveRiskHintForDisplay(
  ui: Pick<GameUiPayload, "riskHint" | "choiceTags">,
): string {
  const h = ui.riskHint?.trim();
  if (h) return h;
  if (ui.choiceTags?.some((t) => String(t).toLowerCase() === "risk")) {
    return DEFAULT_RISK_HINT_WHEN_TAGS_RISK;
  }
  return "";
}
