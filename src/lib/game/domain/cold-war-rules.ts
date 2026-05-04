/**
 * 冷战回合数合并规则（与 NarrativeEngine.applyColdWarRules 一致，供回归脚本引用）
 */
export function coldWarRemainingAfterDelta(
  prevRemaining: number,
  delta: number,
  trustAfterApply: number,
): number {
  let cr = prevRemaining + delta;
  cr = Math.max(0, Math.min(20, cr));
  const t = trustAfterApply;
  if (t < 8) cr = Math.max(cr, 2);
  /** 8–11：仅当仍有疏离时保底 1，允许叙事一次减到 0 */
  else if (t < 12 && cr > 0) cr = Math.max(cr, 1);
  return cr;
}
