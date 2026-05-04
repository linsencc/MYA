/** 有向角色对关系（A 对 B 的态度）；v13 新增 */
export type PairRelation = {
  /** 关系发起方 characterId */
  fromId: string;
  /** 关系接收方 characterId */
  toId: string;
  /** A 对 B 的信任度 0–100 */
  trust: number;
  /** A 对 B 的好感度 0–100 */
  affection: number;
  /** 关系标签，如 "同事"、"竞争"、"暗恋"、"闺蜜" */
  relationship: string;
  /** 两人间冷战剩余回合（0=正常） */
  cold_war_remaining: number;
  /** 两人间专属 flags（如 "曾当众争吵" 等剧情标记） */
  flags: Record<string, unknown>;
};

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

export function defaultPairRelation(fromId: string, toId: string): PairRelation {
  return {
    fromId,
    toId,
    trust: 50,
    affection: 50,
    relationship: "同事",
    cold_war_remaining: 0,
    flags: {},
  };
}

/** 查找 A→B 的有向对；不存在返回 null */
export function findPair(
  pairs: PairRelation[],
  fromId: string,
  toId: string,
): PairRelation | null {
  return pairs.find((p) => p.fromId === fromId && p.toId === toId) ?? null;
}

/** 查找或创建 A→B 的有向对，不存在时 push 默认值并返回引用 */
export function getOrCreatePair(
  pairs: PairRelation[],
  fromId: string,
  toId: string,
): PairRelation {
  let pair = findPair(pairs, fromId, toId);
  if (!pair) {
    pair = defaultPairRelation(fromId, toId);
    pairs.push(pair);
  }
  return pair;
}

export function normalizePairRelation(raw: unknown): PairRelation | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const fromId = String(o.fromId ?? "").trim();
  const toId = String(o.toId ?? "").trim();
  if (!fromId || !toId) return null;
  return {
    fromId,
    toId,
    trust: clamp(Number(o.trust ?? 50)),
    affection: clamp(Number(o.affection ?? 50)),
    relationship: String(o.relationship ?? "同事").slice(0, 40),
    cold_war_remaining: Math.max(0, Math.min(20, Math.floor(Number(o.cold_war_remaining ?? 0)))),
    flags:
      o.flags && typeof o.flags === "object" && !Array.isArray(o.flags)
        ? (o.flags as Record<string, unknown>)
        : {},
  };
}

export function pairToDict(p: PairRelation): Record<string, unknown> {
  return {
    fromId: p.fromId,
    toId: p.toId,
    trust: p.trust,
    affection: p.affection,
    relationship: p.relationship,
    cold_war_remaining: p.cold_war_remaining,
    flags: { ...p.flags },
  };
}
