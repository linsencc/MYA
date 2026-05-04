import type { ChoiceTag } from "@/lib/game/domain/models";

/** 冷战期间点 risk 时，信任正向增益上限（parser 全局上限仍为 +15） */
const RISK_POSITIVE_TRUST_CAP_DURING_COLD_WAR = 2;

/** 非冷战且点 advance 时，信任负向不低于该值（即从 -10 抬到 -6） */
const ADVANCE_MIN_TRUST_DELTA_WHEN_NO_COLD_WAR = -6;

export type TrustDeltaArbitrationContext = {
  appliedTag: ChoiceTag | null;
  coldWarRemaining: number;
  inputKind: "choice" | "custom";
};

/**
 * 按点选标签与冷战状态后验调整 trust_delta（仅 choice 且能解析出标签时生效）。
 */
export function arbitrateTrustDeltaForChoiceContext(
  trustDelta: number,
  ctx: TrustDeltaArbitrationContext,
): { trustDelta: number; adjusted: boolean } {
  if (ctx.inputKind !== "choice" || ctx.appliedTag === null) {
    return { trustDelta, adjusted: false };
  }

  let next = trustDelta;
  const { appliedTag, coldWarRemaining } = ctx;

  if (appliedTag === "risk" && coldWarRemaining > 0 && trustDelta > RISK_POSITIVE_TRUST_CAP_DURING_COLD_WAR) {
    next = RISK_POSITIVE_TRUST_CAP_DURING_COLD_WAR;
  } else if (
    appliedTag === "advance" &&
    coldWarRemaining === 0 &&
    trustDelta < ADVANCE_MIN_TRUST_DELTA_WHEN_NO_COLD_WAR
  ) {
    next = ADVANCE_MIN_TRUST_DELTA_WHEN_NO_COLD_WAR;
  }

  return { trustDelta: next, adjusted: next !== trustDelta };
}
