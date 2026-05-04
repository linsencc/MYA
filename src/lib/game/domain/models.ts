import type { TeacherWear, TeacherWearNsfw } from "@/lib/game/domain/teacher-wear";

export type ChoiceTag = "advance" | "probe" | "risk";

export type EngineResponse = {
  text: string;
  narration: string;
  choices: string[];
  /** 与 choices 等长，advance | probe | risk */
  choice_tags: ChoiceTag[];
  /** 本回合风险说明（选 risk 项可能降信任等） */
  risk_hint: string;
  cg_trigger: boolean;
  /** 本轮画面是否允许成人裸露/情欲向出图（与叙事 NSFW 分开） */
  cg_explicit: boolean;
  cg_scene: string;
  cg_path: string | null;

  affection_delta: number;
  trust_delta: number;
  intimacy_delta: number;
  desire_delta: number;

  /** 章节变化，累加后 clamp 到 1–7 */
  chapter_delta: number;
  /** 合并进 state.flags；多数键为 string|boolean|number，inventory / phone_threads 可为数组或背包映射对象 */
  flag_delta: Record<string, unknown>;

  mood: string;
  location: string;
  /** 兼容旧协议：无 wear 分项时的整行中文描述 */
  outfit: string;
  /** 分项部分更新；仅填本回合有变化的子键 */
  wear?: Partial<TeacherWear>;
  wear_nsfw?: Partial<TeacherWearNsfw>;
  time_of_day: string;
  relationship: string;

  game_over: boolean;
  ending_title: string;
  ending_summary: string;

  /** 冷战剩余回合增量（可为负） */
  cold_war_delta: number;

  // ─── Multi-character extensions (v13+) ────────────────────────────────────
  /** 多角色模式：各在场角色的台词与数值变化；存在则使用多角色路径 */
  replies?: CharacterReply[];
  /** 多角色模式：角色间关系数值变化 */
  pair_deltas?: PairDelta[];
  /** 多角色模式：带角色归属的选项列表 */
  multi_choices?: MultiChoiceEntry[];
  /** 多角色模式：角色进场/退场 */
  participant_changes?: ParticipantChange[];
};

/** 单个角色在本回合的台词与状态变化 */
export type CharacterReply = {
  /** characterId */
  speaker: string;
  /** 该角色的台词/旁白 */
  text: string;
  /** 该角色的内心独白 */
  narration: string;
  affection_delta: number;
  trust_delta: number;
  intimacy_delta: number;
  desire_delta: number;
  mood: string;
  relationship: string;
  wear?: Partial<TeacherWear>;
  wear_nsfw?: Partial<TeacherWearNsfw>;
  cg_trigger: boolean;
  cg_scene: string;
  cg_explicit: boolean;
  cold_war_delta: number;
  /** CG 输出路径（由引擎填充，LLM 不返回） */
  cg_path?: string | null;
};

/** 角色对之间的关系数值变化 */
export type PairDelta = {
  fromId: string;
  toId: string;
  trust_delta: number;
  affection_delta: number;
  relationship?: string;
  cold_war_delta?: number;
};

/** 带角色归属的玩家选项 */
export type MultiChoiceEntry = {
  label: string;
  tag: ChoiceTag;
  /** characterId 或 "group"（对所有人） */
  speaker: string;
};

/** 角色进场或退场 */
export type ParticipantChange = {
  characterId: string;
  action: "enter" | "exit";
};

export function emptyCharacterReply(speaker: string): CharacterReply {
  return {
    speaker,
    text: "",
    narration: "",
    affection_delta: 0,
    trust_delta: 0,
    intimacy_delta: 0,
    desire_delta: 0,
    mood: "",
    relationship: "",
    cg_trigger: false,
    cg_scene: "",
    cg_explicit: false,
    cold_war_delta: 0,
    cg_path: null,
  };
}

export function emptyEngineResponse(): EngineResponse {
  return {
    text: "",
    narration: "",
    choices: [],
    choice_tags: ["advance", "advance", "advance", "advance"],
    risk_hint: "",
    cg_trigger: false,
    cg_explicit: false,
    cg_scene: "",
    cg_path: null,
    affection_delta: 0,
    trust_delta: 0,
    intimacy_delta: 0,
    desire_delta: 0,
    chapter_delta: 0,
    flag_delta: {},
    mood: "",
    location: "",
    outfit: "",
    time_of_day: "",
    relationship: "",
    game_over: false,
    ending_title: "",
    ending_summary: "",
    cold_war_delta: 0,
  };
}
