import { clampPocketMoney, POCKET_MONEY_FLAG } from "@/lib/game/content/item-catalog";
import { refreshTimeOfDayFromSlot, TIME_SLOT_COUNT } from "@/lib/game/domain/calendar";
import type { GameState } from "@/lib/game/domain/state";
import {
  mergeWear,
  mergeWearNsfw,
  type TeacherWear,
  type TeacherWearNsfw,
  WEAR_KEYS,
  WEAR_NSFW_KEYS,
} from "@/lib/game/domain/teacher-wear";

const DISCRETE_MAX = 40;
const WEAR_MAX = 48;

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

const FORBIDDEN_FLAG_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export type GodPatch = Partial<{
  affection: number;
  trust: number;
  intimacy: number;
  desire: number;
  chapter: number;
  cold_war_remaining: number;
  calendar_day: number;
  time_slot: number;
  mood: string;
  location: string;
  /** 与 wear 二选一优先 wear；否则整行并入 wear */
  outfit: string;
  wear: Partial<TeacherWear>;
  wear_nsfw: Partial<TeacherWearNsfw>;
  time_of_day: string;
  relationship: string;
  flags: Record<string, string | number | boolean>;
  /** 写入 flags.pocket_money 并钳制 */
  pocket_money?: number;
}>;

export type ParseGodPatchResult =
  | { ok: true; patch: GodPatch }
  | { ok: false; error: string };

function num(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function str(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  return String(raw);
}

function wearPartialFromUnknown(raw: unknown): Partial<TeacherWear> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<TeacherWear> = {};
  for (const k of WEAR_KEYS) {
    if (o[k] !== undefined) {
      const s = String(o[k]).trim();
      if (s) (out as Record<string, string>)[k] = s.slice(0, WEAR_MAX);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function wearNsfwPartialFromUnknown(raw: unknown): Partial<TeacherWearNsfw> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Partial<TeacherWearNsfw> = {};
  for (const k of WEAR_NSFW_KEYS) {
    if (o[k] !== undefined) {
      const s = String(o[k]).trim();
      if (s) (out as Record<string, string>)[k] = s.slice(0, WEAR_MAX);
    }
  }
  if (o.groin_insertion !== undefined && out.vagina === undefined && out.anus === undefined) {
    const s = String(o.groin_insertion).trim();
    if (s) out.vagina = s.slice(0, WEAR_MAX);
  }
  return Object.keys(out).length ? out : undefined;
}

/** 从 API body 的 godPatch 对象解析为白名单补丁（忽略未知键）。 */
export function parseGodPatch(raw: unknown): ParseGodPatchResult {
  if (raw === undefined || raw === null) {
    return { ok: true, patch: {} };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "godPatch 必须是对象" };
  }
  const o = raw as Record<string, unknown>;
  const patch: GodPatch = {};

  const a = num(o.affection);
  if (a !== undefined) patch.affection = a;
  const t = num(o.trust);
  if (t !== undefined) patch.trust = t;
  const i = num(o.intimacy);
  if (i !== undefined) patch.intimacy = i;
  const d = num(o.desire);
  if (d !== undefined) patch.desire = d;
  const ch = num(o.chapter);
  if (ch !== undefined) patch.chapter = ch;
  const cw = num(o.cold_war_remaining);
  if (cw !== undefined) patch.cold_war_remaining = cw;
  const cd = num(o.calendar_day);
  if (cd !== undefined) patch.calendar_day = cd;
  const ts = num(o.time_slot);
  if (ts !== undefined) patch.time_slot = ts;
  const mood = str(o.mood);
  if (mood !== undefined) patch.mood = mood;
  const loc = str(o.location);
  if (loc !== undefined) patch.location = loc;
  const outfit = str(o.outfit);
  if (outfit !== undefined) patch.outfit = outfit;
  const wearP = wearPartialFromUnknown(o.wear);
  if (wearP) patch.wear = wearP;
  const wearNsfwP = wearNsfwPartialFromUnknown(o.wear_nsfw);
  if (wearNsfwP) patch.wear_nsfw = wearNsfwP;
  const tod = str(o.time_of_day);
  if (tod !== undefined) patch.time_of_day = tod;
  const rel = str(o.relationship);
  if (rel !== undefined) patch.relationship = rel;
  const pm = num(o.pocket_money);
  if (pm !== undefined) patch.pocket_money = pm;

  if (o.flags !== undefined && o.flags !== null) {
    if (typeof o.flags !== "object" || Array.isArray(o.flags)) {
      return { ok: false, error: "flags 必须是对象" };
    }
    const flags: Record<string, string | number | boolean> = {};
    for (const [k, v] of Object.entries(o.flags as Record<string, unknown>)) {
      if (FORBIDDEN_FLAG_KEYS.has(k)) continue;
      if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
        flags[k] = v;
      }
    }
    if (Object.keys(flags).length > 0) patch.flags = flags;
  }

  return { ok: true, patch };
}

export function applyGodPatch(
  state: GameState,
  patch: GodPatch,
): { applied: string[]; warnings: string[] } {
  const applied: string[] = [];
  const warnings: string[] = [];

  if (patch.affection !== undefined) {
    state.affection = clamp(patch.affection);
    applied.push(`affection=${state.affection}`);
  }
  if (patch.trust !== undefined) {
    state.trust = clamp(patch.trust);
    applied.push(`trust=${state.trust}`);
  }
  if (patch.intimacy !== undefined) {
    state.intimacy = clamp(patch.intimacy);
    applied.push(`intimacy=${state.intimacy}`);
  }
  if (patch.desire !== undefined) {
    state.desire = clamp(patch.desire);
    applied.push(`desire=${state.desire}`);
  }

  if (patch.chapter !== undefined) {
    const ch = Math.max(1, Math.min(7, Math.floor(patch.chapter)));
    if (ch !== Math.floor(patch.chapter)) warnings.push("chapter 已约束到 1–7");
    state.chapter = ch;
    applied.push(`chapter=${state.chapter}`);
  }

  if (patch.cold_war_remaining !== undefined) {
    const cr = Math.max(0, Math.min(20, Math.floor(patch.cold_war_remaining)));
    if (cr !== Math.floor(patch.cold_war_remaining)) warnings.push("cold_war_remaining 已约束到 0–20");
    state.cold_war_remaining = cr;
    applied.push(`cold_war_remaining=${state.cold_war_remaining}`);
  }

  if (patch.calendar_day !== undefined) {
    const day = Math.max(1, Math.floor(patch.calendar_day));
    state.calendar_day = day;
    applied.push(`calendar_day=${state.calendar_day}`);
  }

  let slotTouched = false;
  if (patch.time_slot !== undefined) {
    const slot = Math.max(0, Math.min(TIME_SLOT_COUNT - 1, Math.floor(patch.time_slot)));
    if (slot !== Math.floor(patch.time_slot)) warnings.push("time_slot 已约束到有效时段索引");
    state.time_slot = slot;
    slotTouched = true;
    applied.push(`time_slot=${state.time_slot}`);
  }

  if (slotTouched) {
    refreshTimeOfDayFromSlot(state);
  }

  const setDiscrete = (field: keyof Pick<GodPatch, "mood" | "location" | "time_of_day" | "relationship">) => {
    const v = patch[field];
    if (v === undefined) return;
    const s = String(v).trim();
    if (!s) return;
    (state as unknown as Record<string, string>)[field as string] = s.slice(0, DISCRETE_MAX);
    applied.push(`${String(field)}=${(state as unknown as Record<string, string>)[field as string]}`);
  };

  setDiscrete("mood");
  setDiscrete("location");
  setDiscrete("relationship");

  if (patch.wear !== undefined) {
    state.wear = mergeWear(state.wear, patch.wear);
    applied.push("wear(merge)");
  }
  if (patch.wear_nsfw !== undefined) {
    state.wear_nsfw = mergeWearNsfw(state.wear_nsfw, patch.wear_nsfw);
    applied.push("wear_nsfw(merge)");
  }
  if (patch.outfit !== undefined && patch.wear === undefined) {
    state.applyWearFromEngineResponse({ outfit: patch.outfit });
    applied.push("outfit→wear");
  }
  if (patch.time_of_day !== undefined) {
    const s = String(patch.time_of_day).trim();
    if (s) {
      state.time_of_day = s.slice(0, DISCRETE_MAX);
      applied.push(`time_of_day=${state.time_of_day}`);
    }
  }

  if (patch.flags && Object.keys(patch.flags).length > 0) {
    for (const [k, v] of Object.entries(patch.flags)) {
      if (FORBIDDEN_FLAG_KEYS.has(k)) continue;
      state.flags[k] = v;
    }
    applied.push(`flags(+${Object.keys(patch.flags).length} keys)`);
  }

  if (patch.pocket_money !== undefined) {
    state.flags[POCKET_MONEY_FLAG] = Math.floor(Number(patch.pocket_money));
    clampPocketMoney(state.flags);
    applied.push(`pocket_money=${String(state.flags[POCKET_MONEY_FLAG])}`);
  }

  return { applied, warnings };
}

/**
 * 开发环境（NODE_ENV=development）可直接使用上帝指令。
 * 生产环境须在环境中设置 GAME_GOD_KEY，且请求体 godKey 须与其一致。
 */
export function isGodPatchAllowed(godKeyFromBody: unknown): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const key = process.env.GAME_GOD_KEY?.trim();
  if (!key) return false;
  return String(godKeyFromBody ?? "") === key;
}
