import type { TitleRowUi } from "@/lib/game/domain/titles";
import type { TeacherWear, TeacherWearNsfw } from "@/lib/game/domain/teacher-wear";
import type { FlagSummaryRowUi } from "@/lib/game/content/story-flags";
import type { WorldUiBlock } from "@/lib/game/content/world-ui-types";

/** API ↔ 前端共享：上轮四维与章节数值变化 */
export type StatDeltas = {
  affection: number;
  trust: number;
  intimacy: number;
  desire: number;
  chapter: number;
};

export type GameCastEntry = {
  characterId: string;
  displayName: string;
  portraitSrc: string;
  slot?: "left" | "center" | "right";
};

/** 人物面板：单角色快照（用于 roster / 详情） */
export type CharacterRosterEntry = {
  id: string;
  displayName: string;
  portraitSrc: string;
  met: boolean;
  affection: number;
  trust: number;
  intimacy: number;
  desire: number;
  relationship: string;
  mood: string;
  location: string;
  coldWarRemaining: number;
  outfit: string;
  wear: TeacherWear;
  wearNsfw: TeacherWearNsfw;
  nsfwMode: boolean;
  titleRows: TitleRowUi[];
  flagSummaryLines: FlagSummaryRowUi[];
  lastStatDeltas: StatDeltas;
};

/** 多角色模式：单角色台词展示条目 */
export type UiCharacterReply = {
  speaker: string;
  displayName: string;
  text: string;
  narration: string;
};

/** 多角色模式：带角色归属的选项 */
export type UiMultiChoice = {
  label: string;
  tag: string;
  speaker: string;
  speakerDisplayName: string;
};

/** 多角色模式：角色对关系展示 */
export type UiPairRelation = {
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  trust: number;
  affection: number;
  relationship: string;
  coldWarRemaining: number;
};

/** 游戏主界面 JSON 载荷（`/api/game/state`、`action` 等） */
export type GameUiPayload = {
  storyText: string;
  narration: string;
  affection: number;
  trust: number;
  intimacy: number;
  desire: number;
  stage: string;
  intimacyStage: string;
  desireStage: string;
  chapter: number;
  relationship: string;
  timeOfDay: string;
  /** 第N天·周X·时段 */
  calendarLine: string;
  calendarDay: number;
  weekdayLabel: string;
  /** 0…TIME_SLOT_COUNT-1，与 timeSlotLabel 对应 */
  timeSlot: number;
  timeSlotLabel: string;
  /** 玩家已累计回合（与引擎内 turn 一致，用于 UI 进度感） */
  playerTurn: number;
  location: string;
  mood: string;
  /** 由 wear 派生的一行摘要 */
  outfit: string;
  wear: TeacherWear;
  wearNsfw: TeacherWearNsfw;
  nsfwMode: boolean;
  choices: string[];
  choiceTags: string[];
  riskHint: string;
  lastStatDeltas: StatDeltas;
  endingTitle: string;
  endingSummary: string;
  coldWarRemaining: number;
  metaCgSeenCount: number;
  cgForceInterval: number;
  enableCg: boolean;
  cgImageSrc: string | null;
  cgPendingPath: string | null;
  /** 全屏场景底图，与 `world.locations[current].cgImageSrc` 同路 */
  sceneBackgroundSrc: string | null;
  /** 当前地点可用场景能力 id（`shop` / `library` / `cafe` 等） */
  sceneAffordances: string[];
  /** 本场出场；多角色时含多条，单角色时仍为单元素保持向后兼容 */
  cast: GameCastEntry[];
  /** 多角色焦点角色 id */
  focusCharacterId?: string;
  consoleText: string;
  saveLabel: string;
  /** 剧情标记（上帝面板等用） */
  flags: Record<string, unknown>;
  /** 称号图鉴（全量列表 + 是否已解锁） */
  titleRows: TitleRowUi[];
  /** 本响应内新解锁的称号展示名（服务端 drain 一次后为空） */
  newTitleUnlocks: string[];
  slots: string[][];
  thinking?: boolean;
  /** 当前章情境摘要（与叙事设定一致，截断） */
  chapterThemeShort: string;
  /** 里程碑 / 信任等非剧透提示行 */
  progressHintLines: string[];
  /** 白名单关系记忆（供侧栏，源自 story-flags 注册表） */
  flagSummaryLines: FlagSummaryRowUi[];
  /** 地图 / 背包 / 手机等世界层只读摘要（由服务端从 state.flags 等推导） */
  world: WorldUiBlock;
  /** 已遇见角色面板列表（多角色扩展入口） */
  characterRoster: CharacterRosterEntry[];

  // ─── Multi-character extensions (v13+) ────────────────────────────────────
  /** 多角色模式：各角色台词，客户端用于渲染分角色对话 */
  replies?: UiCharacterReply[];
  /** 多角色模式：带角色归属的选项 */
  multiChoices?: UiMultiChoice[];
  /** 多角色模式：各角色待生成 CG 路径（key=characterId, value=cgPath/null） */
  pendingCgMap?: Record<string, string | null>;
  /** 多角色模式：角色对关系快照 */
  pairRelations?: UiPairRelation[];
};
