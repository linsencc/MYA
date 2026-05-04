import fs from "fs";
import path from "path";
import { savesDir } from "@/lib/game/config";
import { TIME_SLOT_COUNT, refreshTimeOfDayFromSlot } from "@/lib/game/domain/calendar";
import {
  defaultTeacherWear,
  defaultTeacherWearNsfw,
  hasPartialWearNsfwUpdate,
  hasPartialWearUpdate,
  legacyOutfitStringToWear,
  mergeWear,
  mergeWearNsfw,
  normalizeWear,
  normalizeWearNsfw,
  type TeacherWear,
  type TeacherWearNsfw,
  wearToDisplayLine,
} from "@/lib/game/domain/teacher-wear";
import {
  clampPocketMoney,
  defaultStarterInventoryRow,
  POCKET_MONEY_FLAG,
  repairFlagsInventory,
} from "@/lib/game/content/item-catalog";
import {
  defaultCharacterSlice,
  normalizeCharacterSlice,
  sliceToDict,
  type CharacterSliceData,
} from "@/lib/game/domain/characters";
import {
  normalizePairRelation,
  pairToDict,
  type PairRelation,
} from "@/lib/game/domain/pair-relation";

export const MAX_SLOTS = 10;
export const SCHEMA_VERSION = 13;
export const STAT_FIELDS = ["affection", "trust", "intimacy", "desire"] as const;

/** 每轮 user+assistant 各一条；超出后丢弃最旧整轮，减轻 LLM 上下文压力 */
export const DEFAULT_HISTORY_USER_TURNS = 24;

/** 主角色 id（陈悦） */
export const PRIMARY_CHARACTER_ID = "chen_yue";

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

function affectionStage(affection: number): string {
  if (affection <= 15) return "陌生";
  if (affection <= 35) return "同学关系";
  if (affection <= 55) return "被注意到";
  if (affection <= 75) return "心动";
  if (affection <= 90) return "暧昧";
  return "深爱";
}

function intimacyStage(intimacy: number): string {
  if (intimacy <= 10) return "保持距离";
  if (intimacy <= 30) return "偶尔靠近";
  if (intimacy <= 55) return "肢体接触";
  if (intimacy <= 80) return "拥抱亲吻";
  return "毫无保留";
}

function desireStage(desire: number): string {
  if (desire <= 15) return "冷静";
  if (desire <= 40) return "微热";
  if (desire <= 65) return "心猿意马";
  if (desire <= 85) return "情难自禁";
  return "欲火焚身";
}

function normalizeChoices(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["继续", "", "", ""];
  const out = raw.map((x) => String(x)).slice(0, 4);
  while (out.length < 4) out.push("");
  if (!out.some((x) => x.trim())) return ["继续", "", "", ""];
  return out.slice(0, 4);
}

function dedupeTitleIds(raw: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  if (!Array.isArray(raw)) return [];
  for (const x of raw) {
    const id = String(x).slice(0, 48).trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeChoiceTags(raw: unknown): string[] {
  const tags = ["advance", "probe", "risk"] as const;
  const set = new Set<string>(tags);
  if (!Array.isArray(raw)) return ["advance", "advance", "advance", "advance"];
  const out = raw.map((x) => {
    const t = String(x).toLowerCase().trim();
    return set.has(t) ? t : "advance";
  });
  while (out.length < 4) out.push("advance");
  return out.slice(0, 4);
}

/** 全局世界状态（v13+），不依附于任何单角色 */
export type WorldState = {
  calendar_day: number;
  time_slot: number;
  time_of_day: string;
  chapter: number;
  /** 玩家当前所在场景 */
  location: string;
  flags: Record<string, unknown>;
  nsfw_mode: boolean;
  save_label: string;
  saved_at: string | null;
  recap_pending: boolean;
  /** 当前场景在场角色 id 列表 */
  scene_participants: string[];
};

function migrateSaveDict(d: Record<string, unknown>): Record<string, unknown> {
  const v = Number(d.schema_version ?? 0) || 0;
  if (v > SCHEMA_VERSION) {
    throw new Error(`unsupported save schema_version ${v} (max ${SCHEMA_VERSION})`);
  }
  const out = { ...d };
  if (v < 1) {
    if (out.last_narration === undefined) out.last_narration = "";
    if (out.last_choices === undefined) out.last_choices = ["继续", "", "", ""];
    if (out.save_label === undefined) out.save_label = "";
    if (out.saved_at === undefined) out.saved_at = null;
  }
  if (v < 2) {
    if (out.story_summary === undefined) out.story_summary = "";
    if (out.ending_title === undefined) out.ending_title = "";
    if (out.ending_summary === undefined) out.ending_summary = "";
    if (out.cold_war_remaining === undefined) out.cold_war_remaining = 0;
    if (out.meta_cg_seen_count === undefined) out.meta_cg_seen_count = 0;
    if (out.last_choice_tags === undefined) {
      out.last_choice_tags = ["advance", "advance", "advance", "advance"];
    }
    if (out.last_risk_hint === undefined) out.last_risk_hint = "";
    if (out.recap_pending === undefined) out.recap_pending = false;
  }
  if (v < 3) {
    if (out.calendar_day === undefined) out.calendar_day = 1;
    if (out.time_slot === undefined) out.time_slot = 2;
  }
  if (v < 4) {
    const ts = Math.floor(Number(out.time_slot ?? 4));
    /** 旧 3 时段：0 上午 / 1 下午 / 2 傍晚 → 新 6 时段对齐索引 */
    const legacy3To6 = [1, 3, 4];
    if (ts >= 0 && ts <= 2) {
      out.time_slot = legacy3To6[ts];
    } else {
      out.time_slot = Math.min(TIME_SLOT_COUNT - 1, Math.max(0, ts));
    }
  }
  if (v < 5) {
    delete out.actions_remaining;
    delete out.pending_calendar_transition;
  }
  if (v < 6) {
    if (!Array.isArray(out.unlocked_title_ids)) out.unlocked_title_ids = [];
    if (out.ending_title === undefined) out.ending_title = "";
    if (out.ending_summary === undefined) out.ending_summary = "";
  }
  if (v < 7) {
    const base =
      typeof out.flags === "object" && out.flags !== null && !Array.isArray(out.flags)
        ? ({ ...(out.flags as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    if (!Array.isArray(base.inventory)) {
      base.inventory = [defaultStarterInventoryRow()];
    }
    if (!Array.isArray(base.phone_threads)) {
      base.phone_threads = [
        { id: "class_notice", title: "班级群提醒", unread: true, lastSnippet: "明天的周记别忘交。" },
        { id: "chen_tip", title: "陈老师", unread: true, lastSnippet: "有问题明天课间来办公室。" },
      ];
    }
    out.flags = base;
  }
  if (v < 8) {
    const legacyOutfit = String(out.outfit ?? "白衬衫、黑色半身裙");
    if (!out.wear || typeof out.wear !== "object" || Array.isArray(out.wear)) {
      out.wear = legacyOutfitStringToWear(legacyOutfit);
    }
    if (!out.wear_nsfw || typeof out.wear_nsfw !== "object" || Array.isArray(out.wear_nsfw)) {
      out.wear_nsfw = { vagina: "无", anus: "无", nipples: "无" };
    }
  }
  if (v < 9) {
    delete out.run_ended;
  }
  if (v < 10) {
    const base =
      typeof out.flags === "object" && out.flags !== null && !Array.isArray(out.flags)
        ? ({ ...(out.flags as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    repairFlagsInventory(base);
    clampPocketMoney(base);
    if (base[POCKET_MONEY_FLAG] === undefined) base[POCKET_MONEY_FLAG] = 0;
    out.flags = base;
  }
  if (v < 11) {
    const loc = String(out.location ?? "").trim();
    if (loc === "放学后的教室") out.location = "教室";
  }
  // v13: introduce world + characters + pairs structure from legacy flat format
  if (v < 13 && !out.world) {
    const world: WorldState = {
      calendar_day: Math.max(1, Number(out.calendar_day ?? 1)),
      time_slot: Math.max(0, Math.min(TIME_SLOT_COUNT - 1, Math.floor(Number(out.time_slot ?? 4)))),
      time_of_day: String(out.time_of_day ?? "傍晚").slice(0, 40),
      chapter: Math.max(1, Math.min(7, Number(out.chapter ?? 1))),
      location: String(out.location ?? "教室").slice(0, 40),
      flags:
        typeof out.flags === "object" && out.flags !== null && !Array.isArray(out.flags)
          ? (out.flags as Record<string, unknown>)
          : {},
      nsfw_mode: out.nsfw_mode === undefined ? true : Boolean(out.nsfw_mode),
      save_label: String(out.save_label ?? ""),
      saved_at: out.saved_at != null ? String(out.saved_at) : null,
      recap_pending: Boolean(out.recap_pending),
      scene_participants: [PRIMARY_CHARACTER_ID],
    };
    // Build primary character slice from legacy flat fields
    const primarySlice: Record<string, unknown> = {
      characterId: PRIMARY_CHARACTER_ID,
      displayName: "陈悦",
      cardRelativePath: "char_chen_yue/card.json",
      affection: out.affection,
      trust: out.trust,
      intimacy: out.intimacy,
      desire: out.desire,
      mood: out.mood,
      relationship: out.relationship,
      wear: out.wear,
      wear_nsfw: out.wear_nsfw,
      unlocked_title_ids: out.unlocked_title_ids,
      portraitBasename: null,
      met: true,
      history: out.history,
      location: out.location,
      cg_count: out.cg_count,
      cold_war_remaining: out.cold_war_remaining,
      last_narration: out.last_narration,
      last_choices: out.last_choices,
      last_choice_tags: out.last_choice_tags,
      last_risk_hint: out.last_risk_hint,
      story_summary: out.story_summary,
      summary_subjective: "",
      ending_title: out.ending_title,
      ending_summary: out.ending_summary,
      meta_cg_seen_count: out.meta_cg_seen_count,
      nsfw_mode: out.nsfw_mode,
    };
    out.world = world;
    out.characters = { [PRIMARY_CHARACTER_ID]: primarySlice };
    out.pairs = [];
  }
  out.schema_version = SCHEMA_VERSION;
  return out;
}

/** Serializable save data shape (v13+) */
export type GameStateData = {
  schema_version: number;
  world: WorldState;
  characters: Record<string, Record<string, unknown>>;
  pairs: Record<string, unknown>[];
  /** Global counter across all characters (for NG+ meta) */
  meta_cg_seen_count: number;
  unlocked_title_ids: string[];
};

export class GameState {
  /** v13: global world state */
  world: WorldState = {
    calendar_day: 1,
    time_slot: 4,
    time_of_day: "傍晚",
    chapter: 1,
    location: "教室",
    flags: {
      [POCKET_MONEY_FLAG]: 80,
      inventory: [defaultStarterInventoryRow()],
      phone_threads: [
        { id: "class_notice", title: "班级群提醒", unread: true, lastSnippet: "明天的周记别忘交。" },
        { id: "chen_tip", title: "陈老师", unread: true, lastSnippet: "有问题明天课间来办公室。" },
      ],
    },
    nsfw_mode: true,
    save_label: "",
    saved_at: null,
    recap_pending: false,
    scene_participants: [PRIMARY_CHARACTER_ID],
  };

  /** v13: per-character state slices */
  characters: Map<string, CharacterSliceData> = new Map();

  /** v13: directed pair relations between characters */
  pairs: PairRelation[] = [];

  /** Global meta counter (NG+ carryover) */
  meta_cg_seen_count = 0;

  /** Global title unlocks */
  unlocked_title_ids: string[] = [];

  constructor() {
    // Initialize primary character slice
    const primaryEntry = this._buildDefaultPrimaryEntry();
    this.characters.set(PRIMARY_CHARACTER_ID, defaultCharacterSlice(primaryEntry));
  }

  private _buildDefaultPrimaryEntry() {
    return {
      id: PRIMARY_CHARACTER_ID,
      displayName: "陈悦",
      cardFile: "char_chen_yue/card.json",
      defaultMet: true,
      rosterLineCn: null,
    };
  }

  // ─── Delegate getters/setters to primary character + world ───────────────────
  // These preserve full backward compatibility with the engine and all existing code.

  get primaryChar(): CharacterSliceData {
    let c = this.characters.get(PRIMARY_CHARACTER_ID);
    if (!c) {
      c = defaultCharacterSlice(this._buildDefaultPrimaryEntry());
      this.characters.set(PRIMARY_CHARACTER_ID, c);
    }
    return c;
  }

  get affection(): number { return this.primaryChar.affection; }
  set affection(v: number) { this.primaryChar.affection = v; }

  get trust(): number { return this.primaryChar.trust; }
  set trust(v: number) { this.primaryChar.trust = v; }

  get intimacy(): number { return this.primaryChar.intimacy; }
  set intimacy(v: number) { this.primaryChar.intimacy = v; }

  get desire(): number { return this.primaryChar.desire; }
  set desire(v: number) { this.primaryChar.desire = v; }

  get mood(): string { return this.primaryChar.mood; }
  set mood(v: string) { this.primaryChar.mood = v; }

  get location(): string { return this.world.location; }
  set location(v: string) { this.world.location = v; }

  get wear(): TeacherWear { return this.primaryChar.wear; }
  set wear(v: TeacherWear) { this.primaryChar.wear = v; }

  get wear_nsfw(): TeacherWearNsfw { return this.primaryChar.wear_nsfw; }
  set wear_nsfw(v: TeacherWearNsfw) { this.primaryChar.wear_nsfw = v; }

  get time_of_day(): string { return this.world.time_of_day; }
  set time_of_day(v: string) { this.world.time_of_day = v; }

  get relationship(): string { return this.primaryChar.relationship; }
  set relationship(v: string) { this.primaryChar.relationship = v; }

  get chapter(): number { return this.world.chapter; }
  set chapter(v: number) { this.world.chapter = v; }

  get history(): { role: string; content: string }[] { return this.primaryChar.history; }
  set history(v: { role: string; content: string }[]) { this.primaryChar.history = v; }

  get flags(): Record<string, unknown> { return this.world.flags; }
  set flags(v: Record<string, unknown>) { this.world.flags = v; }

  get cg_count(): number { return this.primaryChar.cg_count; }
  set cg_count(v: number) { this.primaryChar.cg_count = v; }

  get nsfw_mode(): boolean { return this.world.nsfw_mode; }
  set nsfw_mode(v: boolean) { this.world.nsfw_mode = v; }

  get last_narration(): string { return this.primaryChar.last_narration; }
  set last_narration(v: string) { this.primaryChar.last_narration = v; }

  get last_choices(): string[] { return this.primaryChar.last_choices; }
  set last_choices(v: string[]) { this.primaryChar.last_choices = v; }

  get last_choice_tags(): string[] { return this.primaryChar.last_choice_tags; }
  set last_choice_tags(v: string[]) { this.primaryChar.last_choice_tags = v; }

  get last_risk_hint(): string { return this.primaryChar.last_risk_hint; }
  set last_risk_hint(v: string) { this.primaryChar.last_risk_hint = v; }

  get save_label(): string { return this.world.save_label; }
  set save_label(v: string) { this.world.save_label = v; }

  get saved_at(): string | null { return this.world.saved_at; }
  set saved_at(v: string | null) { this.world.saved_at = v; }

  get story_summary(): string { return this.primaryChar.story_summary; }
  set story_summary(v: string) { this.primaryChar.story_summary = v; }

  get ending_title(): string { return this.primaryChar.ending_title; }
  set ending_title(v: string) { this.primaryChar.ending_title = v; }

  get ending_summary(): string { return this.primaryChar.ending_summary; }
  set ending_summary(v: string) { this.primaryChar.ending_summary = v; }

  get cold_war_remaining(): number { return this.primaryChar.cold_war_remaining; }
  set cold_war_remaining(v: number) { this.primaryChar.cold_war_remaining = v; }

  get recap_pending(): boolean { return this.world.recap_pending; }
  set recap_pending(v: boolean) { this.world.recap_pending = v; }

  get calendar_day(): number { return this.world.calendar_day; }
  set calendar_day(v: number) { this.world.calendar_day = v; }

  get time_slot(): number { return this.world.time_slot; }
  set time_slot(v: number) { this.world.time_slot = v; }

  // unlocked_title_ids is global (all characters share the title gallery)

  // ─── Computed getters (unchanged) ─────────────────────────────────────────

  get stage(): string {
    return affectionStage(this.affection);
  }
  get intimacy_stage(): string {
    return intimacyStage(this.intimacy);
  }
  get desire_stage(): string {
    return desireStage(this.desire);
  }

  /** 由 `wear` 派生的一行摘要，兼容旧字段名 `outfit` */
  get outfit(): string {
    return wearToDisplayLine(this.wear);
  }

  // ─── Methods (unchanged signatures) ──────────────────────────────────────

  /**
   * 合并 LLM 返回的穿着更新；`outfit` 仅作无 `wear` 分项时的兼容入口。
   */
  applyWearFromEngineResponse(resp: {
    wear?: Partial<TeacherWear>;
    wear_nsfw?: Partial<TeacherWearNsfw>;
    outfit?: string;
  }): void {
    if (hasPartialWearUpdate(resp.wear)) {
      this.wear = mergeWear(this.wear, resp.wear!);
    } else if ((resp.outfit || "").trim()) {
      this.wear = mergeWear(this.wear, legacyOutfitStringToWear(resp.outfit!));
    }
    if (hasPartialWearNsfwUpdate(resp.wear_nsfw)) {
      this.wear_nsfw = mergeWearNsfw(this.wear_nsfw, resp.wear_nsfw!);
    }
  }

  adjust(stat: string, delta: number): void {
    if (!(STAT_FIELDS as readonly string[]).includes(stat)) return;
    const cur = this[stat as keyof GameState] as number;
    (this as unknown as Record<string, number>)[stat] = clamp(cur + delta);
  }

  setDiscrete(fieldName: string, value: string): void {
    if (!value) return;
    const allowed = ["mood", "location", "time_of_day", "relationship"];
    if (!allowed.includes(fieldName)) return;
    (this as unknown as Record<string, string>)[fieldName] = value.slice(0, 40);
  }

  /**
   * @param maxTurns 保留的「用户回合」条数（user 消息数）；每条 user 后通常紧跟一条 assistant，故最多约 maxTurns*2 条消息。
   */
  pushHistory(role: string, content: string, maxTurns = DEFAULT_HISTORY_USER_TURNS): void {
    this.history.push({ role, content });
    if (this.history.length > maxTurns * 2) {
      this.history = this.history.slice(-(maxTurns * 2));
    }
  }

  nextCgPath(outputDir: string): string {
    this.cg_count += 1;
    this.meta_cg_seen_count = Math.max(this.meta_cg_seen_count, this.cg_count);
    fs.mkdirSync(outputDir, { recursive: true });
    const name = `cg_${String(this.chapter).padStart(2, "0")}_${String(this.cg_count).padStart(3, "0")}.png`;
    return path.join(outputDir, name);
  }

  /** Generate a CG path scoped to a specific character (multi-char support) */
  nextCgPathForCharacter(outputDir: string, characterId: string): string {
    const char = this.characters.get(characterId) ?? this.primaryChar;
    char.cg_count += 1;
    this.meta_cg_seen_count = Math.max(this.meta_cg_seen_count, char.cg_count);
    const charDir = path.join(outputDir, characterId);
    fs.mkdirSync(charDir, { recursive: true });
    const name = `cg_${String(this.world.chapter).padStart(2, "0")}_${String(char.cg_count).padStart(3, "0")}.png`;
    return path.join(charDir, name);
  }

  toDict(): GameStateData {
    const charactersDict: Record<string, Record<string, unknown>> = {};
    for (const [id, slice] of this.characters) {
      charactersDict[id] = sliceToDict(slice);
    }
    return {
      schema_version: SCHEMA_VERSION,
      world: {
        calendar_day: this.world.calendar_day,
        time_slot: this.world.time_slot,
        time_of_day: this.world.time_of_day,
        chapter: this.world.chapter,
        location: this.world.location,
        flags: this.world.flags,
        nsfw_mode: this.world.nsfw_mode,
        save_label: this.world.save_label,
        saved_at: this.world.saved_at,
        recap_pending: this.world.recap_pending,
        scene_participants: [...this.world.scene_participants],
      },
      characters: charactersDict,
      pairs: this.pairs.map(pairToDict),
      meta_cg_seen_count: this.meta_cg_seen_count,
      unlocked_title_ids: [...this.unlocked_title_ids],
    };
  }

  static fromDict(d: Record<string, unknown>): GameState {
    const m = migrateSaveDict(d);
    const s = new GameState();

    // Load world state
    if (m.world && typeof m.world === "object" && !Array.isArray(m.world)) {
      const w = m.world as Record<string, unknown>;
      s.world.calendar_day = Math.max(1, Number(w.calendar_day ?? 1));
      s.world.time_slot = Math.max(0, Math.min(TIME_SLOT_COUNT - 1, Math.floor(Number(w.time_slot ?? 4))));
      s.world.time_of_day = String(w.time_of_day ?? "傍晚").slice(0, 40);
      s.world.chapter = Math.max(1, Math.min(7, Number(w.chapter ?? 1)));
      s.world.location = String(w.location ?? "教室").slice(0, 40);
      s.world.flags =
        typeof w.flags === "object" && w.flags !== null && !Array.isArray(w.flags)
          ? (w.flags as Record<string, unknown>)
          : {};
      s.world.nsfw_mode = w.nsfw_mode === undefined ? true : Boolean(w.nsfw_mode);
      s.world.save_label = String(w.save_label ?? "");
      s.world.saved_at = w.saved_at != null ? String(w.saved_at) : null;
      s.world.recap_pending = Boolean(w.recap_pending);
      s.world.scene_participants = Array.isArray(w.scene_participants)
        ? (w.scene_participants as unknown[]).map((x) => String(x)).filter(Boolean)
        : [PRIMARY_CHARACTER_ID];
    }

    // Load characters
    if (m.characters && typeof m.characters === "object" && !Array.isArray(m.characters)) {
      const chars = m.characters as Record<string, unknown>;
      s.characters.clear();
      for (const [id, raw] of Object.entries(chars)) {
        const slice = normalizeCharacterSlice(raw);
        if (slice) s.characters.set(id, slice);
      }
    }
    // Ensure primary character always exists
    if (!s.characters.has(PRIMARY_CHARACTER_ID)) {
      s.characters.set(PRIMARY_CHARACTER_ID, defaultCharacterSlice(s._buildDefaultPrimaryEntry()));
    }

    // Load pairs
    if (Array.isArray(m.pairs)) {
      s.pairs = (m.pairs as unknown[])
        .map(normalizePairRelation)
        .filter((p): p is PairRelation => p !== null);
    }

    // Load global meta
    s.meta_cg_seen_count = Math.max(0, Number(m.meta_cg_seen_count ?? 0));
    s.unlocked_title_ids = dedupeTitleIds(m.unlocked_title_ids);

    refreshTimeOfDayFromSlot(s);
    return s;
  }

  save(slot: number): string {
    if (slot < 0 || slot >= MAX_SLOTS) {
      throw new Error(`slot must be in 0..${MAX_SLOTS - 1}, got ${slot}`);
    }
    const dir = savesDir();
    fs.mkdirSync(dir, { recursive: true });
    const iso = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    this.world.saved_at = `${iso.getFullYear()}-${pad(iso.getMonth() + 1)}-${pad(iso.getDate())}T${pad(iso.getHours())}:${pad(iso.getMinutes())}:${pad(iso.getSeconds())}`;
    const p = path.join(dir, `save_${slot}.json`);
    fs.writeFileSync(p, JSON.stringify(this.toDict(), null, 2), "utf-8");
    return p;
  }

  static load(slot: number): GameState {
    if (slot < 0 || slot >= MAX_SLOTS) {
      throw new Error(`slot must be in 0..${MAX_SLOTS - 1}, got ${slot}`);
    }
    const p = path.join(savesDir(), `save_${slot}.json`);
    if (!fs.existsSync(p)) return new GameState();
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>;
    const s = GameState.fromDict(raw);
    s.recap_pending = true;
    return s;
  }

  static newGame(): GameState {
    return new GameState();
  }

  /** 新游戏+：保留周目 meta，清空进度与剧情 */
  static newGamePlus(prev: GameState): GameState {
    const s = new GameState();
    s.meta_cg_seen_count = prev.meta_cg_seen_count + prev.cg_count;
    s.world.nsfw_mode = prev.world.nsfw_mode;
    s.unlocked_title_ids = [...prev.unlocked_title_ids];
    const ng = prev.flags["new_game_plus_count"];
    const n = typeof ng === "number" ? ng + 1 : 1;
    s.world.flags = {
      new_game_plus_count: n,
      [POCKET_MONEY_FLAG]: 80,
      inventory: [defaultStarterInventoryRow()],
      phone_threads: [
        { id: "class_notice", title: "班级群提醒", unread: true, lastSnippet: "明天的周记别忘交。" },
        { id: "chen_tip", title: "陈老师", unread: true, lastSnippet: "有问题明天课间来办公室。" },
      ],
    };
    return s;
  }

  static deleteSlot(slot: number): boolean {
    if (slot < 0 || slot >= MAX_SLOTS) {
      throw new Error(`slot must be in 0..${MAX_SLOTS - 1}, got ${slot}`);
    }
    const p = path.join(savesDir(), `save_${slot}.json`);
    if (!fs.existsSync(p)) return false;
    fs.unlinkSync(p);
    return true;
  }
}

export type { CharacterSliceData } from "@/lib/game/domain/characters";
export type { PairRelation } from "@/lib/game/domain/pair-relation";

export function slotPath(slot: number): string {
  if (slot < 0 || slot >= MAX_SLOTS) {
    throw new Error(`slot must be in 0..${MAX_SLOTS - 1}, got ${slot}`);
  }
  return path.join(savesDir(), `save_${slot}.json`);
}

export function listSlots(): string[][] {
  const rows: string[][] = [];
  for (let slot = 0; slot < MAX_SLOTS; slot++) {
    const p = path.join(savesDir(), `save_${slot}.json`);
    if (!fs.existsSync(p)) {
      rows.push([String(slot + 1), "—", "—", "—", "—", "空"]);
      continue;
    }
    try {
      const data = migrateSaveDict(JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>);
      // After migration, data.world holds the world state
      const world = data.world as Record<string, unknown> | undefined;
      const rel = (String((data.characters as Record<string, unknown> | undefined)?.[PRIMARY_CHARACTER_ID]
        ? ((data.characters as Record<string, Record<string, unknown>>)[PRIMARY_CHARACTER_ID].relationship ?? "")
        : (data.relationship ?? "")).slice(0, 20) || "—");
      const aff = String((data.characters as Record<string, Record<string, unknown>> | undefined)?.[PRIMARY_CHARACTER_ID]?.affection ?? data.affection ?? "");
      const saved = String(world?.saved_at ?? data.saved_at ?? "").trim() || "—";
      const charSlice = (data.characters as Record<string, Record<string, unknown>> | undefined)?.[PRIMARY_CHARACTER_ID];
      const sum = String(charSlice?.story_summary ?? data.story_summary ?? "").trim().slice(0, 24) || "—";
      rows.push([String(slot + 1), rel, aff, saved, sum, "已存"]);
    } catch {
      rows.push([String(slot + 1), "—", "—", "—", "（损坏）", "错误"]);
    }
  }
  return rows;
}
