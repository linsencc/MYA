import type { TeacherWear, TeacherWearNsfw } from "@/lib/game/domain/teacher-wear";
import {
  defaultTeacherWearNsfw,
  normalizeWear,
  normalizeWearNsfw,
} from "@/lib/game/domain/teacher-wear";
import type { CharacterRegistryEntry } from "@/lib/game/character/registry";
import { migrateCardRelativePath } from "@/lib/game/character/registry";
import { initialWearForCharacterEntry, initialWearForCharacterId } from "@/lib/game/character/initial-wear";

/** 单条对话（与 GameState.history 元素一致） */
export type HistoryMessage = { role: string; content: string };

/** 单角色可序列化切片（存档内 characters[id]）；v13 起时段字段移至 WorldState */
export type CharacterSliceData = {
  characterId: string;
  displayName: string;
  /** 相对 characterDir，如 `char_chen_yue/card.json` */
  cardRelativePath: string;
  affection: number;
  trust: number;
  intimacy: number;
  desire: number;
  mood: string;
  relationship: string;
  wear: TeacherWear;
  wear_nsfw: TeacherWearNsfw;
  unlocked_title_ids: string[];
  /** 最近一张 CG 文件名（basename），供面板缩略图 */
  portraitBasename: string | null;
  /** 是否已在剧情中遇见（面板只展示 met） */
  met: boolean;
  /** 该角色独立对话线（LLM 上下文） */
  history: HistoryMessage[];
  /** NPC 当前所在地点（可与玩家位置不同） */
  location: string;
  cg_count: number;
  cold_war_remaining: number;
  last_narration: string;
  last_choices: string[];
  last_choice_tags: string[];
  last_risk_hint: string;
  story_summary: string;
  /** 该角色对玩家的主观记忆摘要（"她记得关于你的什么"） */
  summary_subjective: string;
  ending_title: string;
  ending_summary: string;
  meta_cg_seen_count: number;
  nsfw_mode: boolean;
};

function defaultLastChoices(): string[] {
  return ["继续", "", "", ""];
}

function defaultLastChoiceTags(): string[] {
  return ["advance", "advance", "advance", "advance"];
}

function normalizeHistory(raw: unknown): HistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: HistoryMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const role = String(r.role ?? "").trim();
    const content = String(r.content ?? "");
    if (!role) continue;
    out.push({ role, content });
  }
  return out;
}

function normalizeLastChoices(raw: unknown): string[] {
  if (!Array.isArray(raw)) return defaultLastChoices();
  const out = raw.map((x) => String(x)).slice(0, 4);
  while (out.length < 4) out.push("");
  if (!out.some((x) => x.trim())) return defaultLastChoices();
  return out.slice(0, 4);
}

function normalizeLastChoiceTags(raw: unknown): string[] {
  const tags = ["advance", "probe", "risk"] as const;
  const set = new Set<string>(tags);
  if (!Array.isArray(raw)) return defaultLastChoiceTags();
  const out = raw.map((x) => {
    const t = String(x).toLowerCase().trim();
    return set.has(t) ? t : "advance";
  });
  while (out.length < 4) out.push("advance");
  return out.slice(0, 4);
}

export function defaultCharacterSlice(entry: CharacterRegistryEntry): CharacterSliceData {
  return {
    characterId: entry.id,
    displayName: entry.displayName,
    cardRelativePath: entry.cardFile,
    affection: 0,
    trust: entry.defaultMet ? 5 : 0,
    intimacy: 0,
    desire: 0,
    mood: entry.defaultMet ? "平静" : "—",
    relationship: entry.defaultMet ? "师生" : "—",
    wear: initialWearForCharacterEntry(entry),
    wear_nsfw: defaultTeacherWearNsfw(),
    unlocked_title_ids: [],
    portraitBasename: null,
    met: entry.defaultMet,
    history: [],
    location: "教室",
    cg_count: 0,
    cold_war_remaining: 0,
    last_narration: "",
    last_choices: defaultLastChoices(),
    last_choice_tags: defaultLastChoiceTags(),
    last_risk_hint: "",
    story_summary: "",
    summary_subjective: "",
    ending_title: "",
    ending_summary: "",
    meta_cg_seen_count: 0,
    nsfw_mode: true,
  };
}

export function normalizeCharacterSlice(raw: unknown): CharacterSliceData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const characterId = String(o.characterId ?? o.character_id ?? "").trim();
  if (!characterId) return null;
  const history = normalizeHistory(o.history);
  const lastChoices = normalizeLastChoices(o.last_choices ?? o.lastChoices);
  const lastChoiceTags = normalizeLastChoiceTags(o.last_choice_tags ?? o.lastChoiceTags);
  const rawLoc = String(o.location ?? "教室").trim();
  const normalizedLoc = (rawLoc === "放学后的教室" ? "教室" : rawLoc).slice(0, 40);
  return {
    characterId,
    displayName: String(o.displayName ?? o.display_name ?? characterId).trim() || characterId,
    cardRelativePath:
      migrateCardRelativePath(String(o.cardRelativePath ?? o.card_relative_path ?? "")) || "char_chen_yue/card.json",
    affection: Math.max(0, Math.min(100, Math.floor(Number(o.affection ?? 0)))),
    trust: Math.max(0, Math.min(100, Math.floor(Number(o.trust ?? 0)))),
    intimacy: Math.max(0, Math.min(100, Math.floor(Number(o.intimacy ?? 0)))),
    desire: Math.max(0, Math.min(100, Math.floor(Number(o.desire ?? 0)))),
    mood: String(o.mood ?? "平静"),
    relationship: String(o.relationship ?? "师生"),
    wear: o.wear !== undefined ? normalizeWear(o.wear) : initialWearForCharacterId(characterId),
    wear_nsfw: normalizeWearNsfw(o.wear_nsfw ?? o.wearNsfw),
    unlocked_title_ids: Array.isArray(o.unlocked_title_ids)
      ? (o.unlocked_title_ids as unknown[]).map((x) => String(x).slice(0, 48).trim()).filter(Boolean)
      : Array.isArray(o.unlockedTitleIds)
        ? (o.unlockedTitleIds as unknown[]).map((x) => String(x).slice(0, 48).trim()).filter(Boolean)
        : [],
    portraitBasename:
      o.portraitBasename != null
        ? String(o.portraitBasename).trim() || null
        : o.portrait_basename != null
          ? String(o.portrait_basename).trim() || null
          : null,
    met: o.met === undefined ? false : Boolean(o.met),
    history,
    location: normalizedLoc || "教室",
    cg_count: Math.max(0, Math.floor(Number(o.cg_count ?? 0))),
    cold_war_remaining: Math.max(0, Math.min(20, Math.floor(Number(o.cold_war_remaining ?? o.coldWarRemaining ?? 0)))),
    last_narration: String(o.last_narration ?? o.lastNarration ?? ""),
    last_choices: lastChoices,
    last_choice_tags: lastChoiceTags,
    last_risk_hint: String(o.last_risk_hint ?? o.lastRiskHint ?? ""),
    story_summary: String(o.story_summary ?? o.storySummary ?? "").slice(0, 80),
    summary_subjective: String(o.summary_subjective ?? o.summarySubjective ?? "").slice(0, 300),
    ending_title: String(o.ending_title ?? o.endingTitle ?? "").slice(0, 120),
    ending_summary: String(o.ending_summary ?? o.endingSummary ?? "").slice(0, 500),
    meta_cg_seen_count: Math.max(0, Math.floor(Number(o.meta_cg_seen_count ?? o.metaCgSeenCount ?? 0))),
    nsfw_mode: o.nsfw_mode === undefined && o.nsfwMode === undefined ? true : Boolean(o.nsfw_mode ?? o.nsfwMode),
  };
}

export function sliceToDict(s: CharacterSliceData): Record<string, unknown> {
  return {
    characterId: s.characterId,
    displayName: s.displayName,
    cardRelativePath: s.cardRelativePath,
    affection: s.affection,
    trust: s.trust,
    intimacy: s.intimacy,
    desire: s.desire,
    mood: s.mood,
    relationship: s.relationship,
    wear: { ...s.wear },
    wear_nsfw: { ...s.wear_nsfw },
    unlocked_title_ids: [...s.unlocked_title_ids],
    portraitBasename: s.portraitBasename,
    met: s.met,
    history: [...s.history],
    location: s.location,
    cg_count: s.cg_count,
    cold_war_remaining: s.cold_war_remaining,
    last_narration: s.last_narration,
    last_choices: [...s.last_choices],
    last_choice_tags: [...s.last_choice_tags],
    last_risk_hint: s.last_risk_hint,
    story_summary: s.story_summary,
    summary_subjective: s.summary_subjective,
    ending_title: s.ending_title,
    ending_summary: s.ending_summary,
    meta_cg_seen_count: s.meta_cg_seen_count,
    nsfw_mode: s.nsfw_mode,
  };
}
