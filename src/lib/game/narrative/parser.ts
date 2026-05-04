import {
  pipelineLog,
  pipelineWarn,
  rawOpensJsonObject,
  rawSuffixForLog,
} from "@/lib/game/adapters/llm-pipeline-log";
import type {
  CharacterReply,
  ChoiceTag,
  EngineResponse,
  MultiChoiceEntry,
  PairDelta,
  ParticipantChange,
} from "@/lib/game/domain/models";
import { emptyCharacterReply, emptyEngineResponse } from "@/lib/game/domain/models";
import type { TeacherWear, TeacherWearNsfw } from "@/lib/game/domain/teacher-wear";
import { WEAR_KEYS, WEAR_NSFW_KEYS } from "@/lib/game/domain/teacher-wear";

function extractJson(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("{")) return t;
  const m = t.match(/\{[\s\S]*\}/);
  return m ? m[0] : t;
}

function asInt(v: unknown, def = 0): number {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isNaN(n) ? def : n;
}

function asStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

const CHOICE_TAGS: ReadonlySet<string> = new Set(["advance", "probe", "risk"]);

function normalizeChoiceTags(raw: unknown): ChoiceTag[] {
  const out: ChoiceTag[] = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < 4; i++) {
      const t = asStr(raw[i]).toLowerCase();
      out.push(CHOICE_TAGS.has(t) ? (t as ChoiceTag) : "advance");
    }
  } else {
    while (out.length < 4) out.push("advance");
  }
  while (out.length < 4) out.push("advance");
  return out.slice(0, 4);
}

function parseWearPartial(raw: unknown): Partial<TeacherWear> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<TeacherWear> = {};
  for (const k of WEAR_KEYS) {
    if (o[k] !== undefined) {
      const s = asStr(o[k]);
      if (s) (out as Record<string, string>)[k] = s;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function parseWearNsfwPartial(raw: unknown): Partial<TeacherWearNsfw> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<TeacherWearNsfw> = {};
  for (const k of WEAR_NSFW_KEYS) {
    if (o[k] !== undefined) {
      const s = asStr(o[k]);
      if (s) (out as Record<string, string>)[k] = s;
    }
  }
  if (o.groin_insertion !== undefined && out.vagina === undefined && out.anus === undefined) {
    const s = asStr(o.groin_insertion);
    if (s) out.vagina = s;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseFlagDelta(raw: unknown): Record<string, unknown> {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k0, v] of Object.entries(raw as Record<string, unknown>)) {
    const k = k0.slice(0, 48);
    if (!k) continue;
    if (k === "inventory") {
      if (Array.isArray(v)) {
        out[k] = v;
      } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
        out[k] = v;
      }
      continue;
    }
    if (k === "phone_threads" && Array.isArray(v)) {
      out[k] = v;
      continue;
    }
    if (typeof v === "boolean" || typeof v === "number") {
      out[k] = v;
    } else if (typeof v === "string") {
      out[k] = v.slice(0, 200);
    }
  }
  return out;
}

/** LLM 原始字符串 → 结构化回合；`ok===false` 表示 JSON 损坏（常见：上游截断）。 */
export type ParsedLlmResponse =
  | { ok: true; response: EngineResponse }
  | { ok: false; response: EngineResponse; parseError: string };

function logParseFailure(raw: string | undefined, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const s = raw ?? "";
  const len = s.length;
  const head = s.slice(0, 200).replace(/\s+/g, " ");
  const tail = len > 240 ? s.slice(-120).replace(/\s+/g, " ") : "";
  pipelineWarn("05_parse_JSON_INVALID", {
    error: msg,
    raw_len: len,
    opens_with_brace: rawOpensJsonObject(s),
    ends_with_brace: s.trimEnd().endsWith("}"),
    head: len ? JSON.stringify(head) : "",
    tail: tail ? JSON.stringify(tail) : "",
    tail72_plain: rawSuffixForLog(s),
  });
  return msg;
}

export function parseLlmResponse(raw: string): ParsedLlmResponse {
  try {
    const data = JSON.parse(extractJson(raw)) as Record<string, unknown>;
    let choices: string[];
    const rawCh = data.choices;
    if (!Array.isArray(rawCh)) choices = [];
    else choices = rawCh.map((c) => String(c)).filter(Boolean);
    if (choices.length === 0) choices = ["继续"];
    while (choices.length < 4) choices.push("");
    choices = choices.slice(0, 4);

    const r = emptyEngineResponse();
    r.text = asStr(data.text) || "……";
    r.narration = asStr(data.narration);
    r.choices = choices;
    r.choice_tags = normalizeChoiceTags(data.choice_tags);
    r.risk_hint = asStr(data.risk_hint).slice(0, 200);
    r.cg_trigger = Boolean(data.cg_trigger);
    r.cg_explicit = Boolean(data.cg_explicit);
    r.cg_scene = asStr(data.cg_scene);
    r.affection_delta = Math.max(-10, Math.min(15, asInt(data.affection_delta)));
    r.trust_delta = Math.max(-10, Math.min(15, asInt(data.trust_delta)));
    r.intimacy_delta = Math.max(-5, Math.min(15, asInt(data.intimacy_delta)));
    r.desire_delta = Math.max(-10, Math.min(20, asInt(data.desire_delta)));
    r.chapter_delta = Math.max(-3, Math.min(3, asInt(data.chapter_delta)));
    r.flag_delta = parseFlagDelta(data.flag_delta);
    r.mood = asStr(data.mood);
    r.location = asStr(data.location);
    r.outfit = asStr(data.outfit);
    r.wear = parseWearPartial(data.wear);
    r.wear_nsfw = parseWearNsfwPartial(data.wear_nsfw);
    r.time_of_day = asStr(data.time_of_day);
    r.relationship = asStr(data.relationship);
    r.game_over = Boolean(data.game_over);
    r.ending_title = asStr(data.ending_title).slice(0, 80);
    r.ending_summary = asStr(data.ending_summary).slice(0, 400);
    r.cold_war_delta = Math.max(-5, Math.min(5, asInt(data.cold_war_delta)));
    pipelineLog("05_parse_ok", {
      raw_chars: (raw ?? "").length,
      text_chars: r.text.length,
      narration_chars: r.narration.length,
      choices_nonempty: choices.filter((c) => (c || "").trim()).length,
      cg_trigger: r.cg_trigger,
    });
    return { ok: true, response: r };
  } catch (err) {
    const r = emptyEngineResponse();
    const parseError = logParseFailure(raw, err);
    const fallback =
      raw != null && raw.length > 20000 ? `${raw.slice(0, 20000)}…` : raw;
    r.text = fallback?.trim() || "（叙事引擎暂时无法响应，请重试。）";
    r.choices = ["继续"];
    return { ok: false, response: r, parseError };
  }
}

// ─── Multi-character parsing (v13+) ────────────────────────────────────────

function parseCharacterReply(raw: unknown, fallbackSpeaker: string): CharacterReply {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyCharacterReply(fallbackSpeaker);
  }
  const o = raw as Record<string, unknown>;
  const reply = emptyCharacterReply(asStr(o.speaker) || fallbackSpeaker);
  reply.text = asStr(o.text) || "……";
  reply.narration = asStr(o.narration);
  reply.affection_delta = Math.max(-10, Math.min(15, asInt(o.affection_delta)));
  reply.trust_delta = Math.max(-10, Math.min(15, asInt(o.trust_delta)));
  reply.intimacy_delta = Math.max(-5, Math.min(15, asInt(o.intimacy_delta)));
  reply.desire_delta = Math.max(-10, Math.min(20, asInt(o.desire_delta)));
  reply.mood = asStr(o.mood);
  reply.relationship = asStr(o.relationship);
  reply.wear = parseWearPartial(o.wear);
  reply.wear_nsfw = parseWearNsfwPartial(o.wear_nsfw);
  reply.cg_trigger = Boolean(o.cg_trigger);
  reply.cg_scene = asStr(o.cg_scene);
  reply.cg_explicit = Boolean(o.cg_explicit);
  reply.cold_war_delta = Math.max(-5, Math.min(5, asInt(o.cold_war_delta)));
  return reply;
}

function parsePairDelta(raw: unknown): PairDelta | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const fromId = asStr(o.fromId);
  const toId = asStr(o.toId);
  if (!fromId || !toId) return null;
  return {
    fromId,
    toId,
    trust_delta: Math.max(-10, Math.min(15, asInt(o.trust_delta))),
    affection_delta: Math.max(-10, Math.min(15, asInt(o.affection_delta))),
    relationship: asStr(o.relationship) || undefined,
    cold_war_delta: asInt(o.cold_war_delta) !== 0
      ? Math.max(-5, Math.min(5, asInt(o.cold_war_delta)))
      : undefined,
  };
}

function parseMultiChoiceEntry(raw: unknown): MultiChoiceEntry | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const label = asStr(o.label);
  if (!label) return null;
  const tagRaw = asStr(o.tag).toLowerCase();
  const tag: ChoiceTag =
    tagRaw === "risk" || tagRaw === "probe" ? (tagRaw as ChoiceTag) : "advance";
  return { label, tag, speaker: asStr(o.speaker) || "group" };
}

function parseParticipantChange(raw: unknown): ParticipantChange | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const characterId = asStr(o.characterId);
  if (!characterId) return null;
  const action = asStr(o.action);
  if (action !== "enter" && action !== "exit") return null;
  return { characterId, action };
}

/**
 * 多角色 LLM 输出解析。
 * 若 `replies` 字段存在则走多角色路径；否则自动降级到单角色解析并将结果包装为单元素 `replies`。
 */
export function parseMultiCharacterResponse(
  raw: string,
  primarySpeaker: string,
): ParsedLlmResponse {
  try {
    const data = JSON.parse(extractJson(raw)) as Record<string, unknown>;

    // If no replies array, fall back to single-char parse and wrap
    if (!Array.isArray(data.replies)) {
      const single = parseLlmResponse(raw);
      if (single.ok) {
        const resp = single.response;
        // Wrap into single CharacterReply
        const reply = emptyCharacterReply(primarySpeaker);
        reply.text = resp.text;
        reply.narration = resp.narration;
        reply.affection_delta = resp.affection_delta;
        reply.trust_delta = resp.trust_delta;
        reply.intimacy_delta = resp.intimacy_delta;
        reply.desire_delta = resp.desire_delta;
        reply.mood = resp.mood;
        reply.relationship = resp.relationship;
        reply.wear = resp.wear;
        reply.wear_nsfw = resp.wear_nsfw;
        reply.cg_trigger = resp.cg_trigger;
        reply.cg_scene = resp.cg_scene;
        reply.cg_explicit = resp.cg_explicit;
        reply.cold_war_delta = resp.cold_war_delta;
        resp.replies = [reply];
        // Wrap flat choices into multi_choices
        if (!resp.multi_choices) {
          resp.multi_choices = resp.choices.map((label, i) => ({
            label,
            tag: (resp.choice_tags[i] ?? "advance") as ChoiceTag,
            speaker: primarySpeaker,
          })).filter((c) => c.label.trim());
        }
      }
      return single;
    }

    // Multi-character path
    const r = emptyEngineResponse();

    // Global narration (scene-level text)
    r.narration = asStr(data.narration);
    // Kept for backward compat / fallback text display
    r.text = asStr(data.text) || r.narration || "……";
    r.risk_hint = asStr(data.risk_hint).slice(0, 200);
    r.chapter_delta = Math.max(-3, Math.min(3, asInt(data.chapter_delta)));
    r.flag_delta = parseFlagDelta(data.flag_delta);
    r.location = asStr(data.location);
    r.game_over = Boolean(data.game_over);
    r.ending_title = asStr(data.ending_title).slice(0, 80);
    r.ending_summary = asStr(data.ending_summary).slice(0, 400);

    // Parse replies
    r.replies = (data.replies as unknown[]).map((rr, i) =>
      parseCharacterReply(rr, i === 0 ? primarySpeaker : `char_${i}`),
    );

    // Set single-char compat fields from primary speaker's reply
    const primaryReply = r.replies.find((rr) => rr.speaker === primarySpeaker) ?? r.replies[0];
    if (primaryReply) {
      r.affection_delta = primaryReply.affection_delta;
      r.trust_delta = primaryReply.trust_delta;
      r.intimacy_delta = primaryReply.intimacy_delta;
      r.desire_delta = primaryReply.desire_delta;
      r.mood = primaryReply.mood;
      r.relationship = primaryReply.relationship;
      r.wear = primaryReply.wear;
      r.wear_nsfw = primaryReply.wear_nsfw;
      r.cg_trigger = primaryReply.cg_trigger;
      r.cg_scene = primaryReply.cg_scene;
      r.cg_explicit = primaryReply.cg_explicit;
      r.cold_war_delta = primaryReply.cold_war_delta;
    }

    // Parse pair_deltas
    if (Array.isArray(data.pair_deltas)) {
      r.pair_deltas = (data.pair_deltas as unknown[])
        .map(parsePairDelta)
        .filter((p): p is PairDelta => p !== null);
    }

    // Parse multi_choices (choices with speaker attribution)
    if (Array.isArray(data.choices)) {
      const rawChoices = data.choices as unknown[];
      // choices may be plain strings or {label, tag, speaker} objects
      if (rawChoices.length > 0 && typeof rawChoices[0] === "object") {
        r.multi_choices = rawChoices
          .map(parseMultiChoiceEntry)
          .filter((c): c is MultiChoiceEntry => c !== null);
        r.choices = r.multi_choices.map((c) => c.label);
        r.choice_tags = r.multi_choices.map((c) => c.tag);
      } else {
        r.choices = rawChoices.map((c) => String(c)).filter(Boolean);
        r.choice_tags = normalizeChoiceTags(data.choice_tags);
        r.multi_choices = r.choices.map((label, i) => ({
          label,
          tag: r.choice_tags[i] ?? "advance",
          speaker: primarySpeaker,
        }));
      }
    } else {
      r.choices = ["继续"];
      r.choice_tags = ["advance", "advance", "advance", "advance"];
    }
    while (r.choices.length < 4) r.choices.push("");

    // Parse participant_changes
    if (Array.isArray(data.participant_changes)) {
      r.participant_changes = (data.participant_changes as unknown[])
        .map(parseParticipantChange)
        .filter((p): p is ParticipantChange => p !== null);
    }

    pipelineLog("05_parse_multi_ok", {
      raw_chars: (raw ?? "").length,
      replies_count: r.replies.length,
      pair_deltas_count: r.pair_deltas?.length ?? 0,
      multi_choices_count: r.multi_choices?.length ?? 0,
      participant_changes_count: r.participant_changes?.length ?? 0,
    });
    return { ok: true, response: r };
  } catch (err) {
    const r = emptyEngineResponse();
    const parseError = logParseFailure(raw, err);
    const fallback =
      raw != null && raw.length > 20000 ? `${raw.slice(0, 20000)}…` : raw;
    r.text = fallback?.trim() || "（叙事引擎暂时无法响应，请重试。）";
    r.choices = ["继续"];
    return { ok: false, response: r, parseError };
  }
}
