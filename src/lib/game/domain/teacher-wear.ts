/** 陈悦穿着（日常）与成人状态；与角色卡分项对齐，供存档与 LLM 部分更新 */

export const WEAR_FIELD_MAX = 48;

export type TeacherWear = {
  top: string;
  bottom: string;
  legwear: string;
  shoes: string;
  accessories: string;
  state: string;
};

export type TeacherWearNsfw = {
  vagina: string;
  anus: string;
  nipples: string;
};

export const WEAR_KEYS = ["top", "bottom", "legwear", "shoes", "accessories", "state"] as const;
export type TeacherWearKey = (typeof WEAR_KEYS)[number];

export const WEAR_NSFW_KEYS = ["vagina", "anus", "nipples"] as const;
export type TeacherWearNsfwKey = (typeof WEAR_NSFW_KEYS)[number];

export function defaultTeacherWear(): TeacherWear {
  return {
    top: "白色衬衫",
    bottom: "黑色铅笔裙",
    legwear: "黑色连裤袜",
    shoes: "黑色低跟鞋",
    accessories: "黑框眼镜、细银手表",
    state: "整齐",
  };
}

export function defaultTeacherWearNsfw(): TeacherWearNsfw {
  return { vagina: "无", anus: "无", nipples: "无" };
}

export function sliceWearField(s: string): string {
  return s.trim().slice(0, WEAR_FIELD_MAX);
}

/** 从任意对象恢复 TeacherWear，缺键用默认 */
export function normalizeWear(raw: unknown): TeacherWear {
  const d = defaultTeacherWear();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const o = raw as Record<string, unknown>;
  const out = { ...d };
  for (const k of WEAR_KEYS) {
    const v = o[k];
    if (v === undefined || v === null) continue;
    const t = String(v).trim();
    if (t) out[k] = sliceWearField(t);
  }
  return out;
}

export function normalizeWearNsfw(raw: unknown): TeacherWearNsfw {
  const d = defaultTeacherWearNsfw();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return d;
  const o = raw as Record<string, unknown>;
  const out = { ...d };
  for (const k of WEAR_NSFW_KEYS) {
    const v = o[k];
    if (v === undefined || v === null) continue;
    const t = String(v).trim();
    if (t) out[k] = sliceWearField(t);
  }
  const legacy = o.groin_insertion;
  if (legacy !== undefined && legacy !== null && o.vagina === undefined && o.anus === undefined) {
    const t = String(legacy).trim();
    if (t) out.vagina = sliceWearField(t);
  }
  return out;
}

/** 未出现键不改；空串不覆盖；非空（含「无」）写入 */
export function mergeWear(base: TeacherWear, patch: Partial<TeacherWear> | null | undefined): TeacherWear {
  if (!patch) return base;
  const out = { ...base };
  for (const k of WEAR_KEYS) {
    const v = patch[k];
    if (v === undefined) continue;
    const t = String(v).trim();
    if (!t) continue;
    out[k] = sliceWearField(t);
  }
  return out;
}

export function mergeWearNsfw(
  base: TeacherWearNsfw,
  patch: Partial<TeacherWearNsfw> | null | undefined,
): TeacherWearNsfw {
  if (!patch) return base;
  const out = { ...base };
  for (const k of WEAR_NSFW_KEYS) {
    const v = patch[k];
    if (v === undefined) continue;
    const t = String(v).trim();
    if (!t) continue;
    out[k] = sliceWearField(t);
  }
  return out;
}

export function hasPartialWearUpdate(p: Partial<TeacherWear> | undefined | null): boolean {
  if (!p) return false;
  return WEAR_KEYS.some((k) => {
    const v = p[k];
    return v !== undefined && String(v).trim() !== "";
  });
}

export function hasPartialWearNsfwUpdate(p: Partial<TeacherWearNsfw> | undefined | null): boolean {
  if (!p) return false;
  return WEAR_NSFW_KEYS.some((k) => {
    const v = p[k];
    return v !== undefined && String(v).trim() !== "";
  });
}

/** 主界面一行 SFW 摘要（与旧 outfit 观感接近） */
export function wearToSummary(w: TeacherWear): string {
  const a = w.top.trim();
  const b = w.bottom.trim();
  if (a && b) return `${a}、${b}`;
  if (a) return a;
  if (b) return b;
  return "—";
}

const DISPLAY_LINE_MAX = 140;
const CG_OVERLAY_MAX = 180;

/** UI 与存档派生「outfit」：含上衣至外衣状态，与 narrative 对齐的一行概览 */
export function wearToDisplayLine(w: TeacherWear): string {
  const parts = [w.top, w.bottom, w.legwear, w.shoes, w.accessories, w.state]
    .map((x) => x.trim())
    .filter(Boolean);
  if (!parts.length) return "—";
  const joined = parts.join("、");
  if (joined.length <= DISPLAY_LINE_MAX) return joined;
  return `${joined.slice(0, DISPLAY_LINE_MAX - 1)}…`;
}

/** PG 出图：追加在固化服装后的叙事着装短语（中文逗号分隔，供与 state 对齐） */
export function wearToCgOverlay(w: TeacherWear): string {
  const s = wearToDisplayLine(w);
  if (s === "—") return "";
  return s.length <= CG_OVERLAY_MAX ? s : `${s.slice(0, CG_OVERLAY_MAX - 1)}…`;
}

/** 侧栏/ chips 用一行中文摘要；默认「无」也写出，便于阅读 */
export function wearNsfwToSummary(w: TeacherWearNsfw): string {
  const v = (w.vagina.trim() || "无").slice(0, 80);
  const a = (w.anus.trim() || "无").slice(0, 80);
  const n = (w.nipples.trim() || "无").slice(0, 80);
  return `阴道：${v}；肛门：${a}；胸部：${n}`;
}

/** 旧档单字段 outfit → 结构化（弱拆分） */
export function legacyOutfitStringToWear(raw: string): TeacherWear {
  const base = defaultTeacherWear();
  const s = raw.trim();
  if (!s) return base;
  const parts = s
    .split(/[、，,]/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      ...base,
      top: sliceWearField(parts[0]!),
      bottom: sliceWearField(parts[1]!),
    };
  }
  if (parts.length === 1) {
    return { ...base, top: sliceWearField(parts[0]!) };
  }
  return { ...base, state: sliceWearField(s) };
}

/** 用于系统 prompt：只列非空行，中文标签 */
export function formatWearBlock(w: TeacherWear): string {
  const lines: string[] = [];
  const push = (label: string, v: string) => {
    const t = v.trim();
    if (t) lines.push(`- ${label}：${t}`);
  };
  push("上衣", w.top);
  push("下装", w.bottom);
  push("腿部", w.legwear);
  push("鞋履", w.shoes);
  push("配饰", w.accessories);
  push("外衣状态", w.state);
  return lines.length ? lines.join("\n") : "（未记录）";
}

export function formatWearNsfwBlock(w: TeacherWearNsfw): string {
  const v = w.vagina.trim() || "无";
  const a = w.anus.trim() || "无";
  const n = w.nipples.trim() || "无";
  return [`- 阴道：${v}`, `- 肛门：${a}`, `- 胸部：${n}`].join("\n");
}
