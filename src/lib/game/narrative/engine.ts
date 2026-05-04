import fs from "fs";
import path from "path";
import { requestCg, sanitizeSceneForSafeVisual } from "@/lib/game/adapters/cg";
import {
  approxMessageChars,
  pipelineLog,
  pipelineWarn,
} from "@/lib/game/adapters/llm-pipeline-log";
import type { BaseLLM } from "@/lib/game/adapters/llm";
import { getLlmMaxTokensBudget, makeLlm } from "@/lib/game/adapters/llm";
import {
  buildMultiCharacterSystemPrompt,
  buildSystemPrompt,
  INITIAL_ASSISTANT_MESSAGE,
  JSON_TRUNCATION_REPAIR_USER_PROMPT,
  USER_TURN_ZH_REMINDER,
} from "@/lib/game/content/prompts";
import type { GameConfig } from "@/lib/game/config";
import { defaultConfig } from "@/lib/game/config";
import { maybeMilestoneChapter } from "@/lib/game/domain/chapter-milestones";
import { unlockNewTitles } from "@/lib/game/domain/titles";
import type { ChoiceTag, EngineResponse } from "@/lib/game/domain/models";
import type { GameStateData } from "@/lib/game/domain/state";
import { GameState, PRIMARY_CHARACTER_ID, DEFAULT_HISTORY_USER_TURNS } from "@/lib/game/domain/state";
import { getOrCreatePair } from "@/lib/game/domain/pair-relation";
import {
  advanceCalendar,
  refreshTimeOfDayFromSlot,
  timeSlotLabel,
  type CalendarAdvanceKind,
} from "@/lib/game/domain/calendar";
import { DEFAULT_RISK_HINT_WHEN_TAGS_RISK } from "@/lib/game/content/story-flags";
import { arbitrateTrustDeltaForChoiceContext } from "@/lib/game/domain/choice-delta-arbitration";
import { coldWarRemainingAfterDelta } from "@/lib/game/domain/cold-war-rules";
import {
  choiceTagSystemPrefixForLlm,
  resolveChoiceTagForPick,
} from "@/lib/game/narrative/choice-tag-context";
import { parseLlmResponse, parseMultiCharacterResponse, type ParsedLlmResponse } from "@/lib/game/narrative/parser";
import { continuityLayoutSeed } from "@/lib/game/cg/continuity-seed";
import { resolveLocationLayoutEn } from "@/lib/game/cg/location-layouts";
import {
  getSceneRegistry,
  resolveScene,
  resolveSceneIdForSeed,
} from "@/lib/game/scene/registry";
import { evaluateSceneUnlock } from "@/lib/game/scene/unlock";
import {
  consumeTravelMove,
  initTravelAllowanceForCurrentSlot,
  locationLockReason,
  travelLabelForId,
} from "@/lib/game/content/world-locations";
import { applyFlagDeltaToFlags } from "@/lib/game/domain/merge-flag-delta";
import { itemCatalogConsumeOnUse } from "@/lib/game/content/item-catalog";
import { sanitizeItemUseFlagDelta } from "@/lib/game/world/item-use-flag-sanitize";
import { wearToCgOverlay } from "@/lib/game/domain/teacher-wear";
import { tryResolveItemUse } from "@/lib/game/world/item-use";
import { pickTravelArrivalBlurb } from "@/lib/game/world/travel-blurbs";

export type EngineSnapshot = {
  state: GameStateData | Record<string, unknown>;
  turn: number;
  consoleLines: string[];
  consoleMax: number;
  enableCg: boolean;
  cgForceInterval: number;
};

/** 多角色模式下非焦点角色的最大历史 turn 数 */
const MULTI_CHAR_OTHER_TURNS = 6;

/** 控制台行前缀：对齐后更易扫读 */
export type ConsoleKind = "SYS" | "PLAY" | "LLM" | "STEP" | "CG" | "SAVE";

const CONSOLE_KIND_WIDTH = 4;

function summarizeStoryLine(text: string): string {
  const line = text.split(/\n/).find((l) => l.trim()) || text;
  return line.trim().slice(0, 40);
}

export class NarrativeEngine {
  config: GameConfig;
  llm: BaseLLM;
  state: GameState;
  enableCg: boolean;
  cgForceInterval: number;
  private turn = 0;
  private consoleLines: string[] = [];
  private consoleMax = 120;
  /** 若设置，则每次 appendConsole 后立即回调（用于流式推送到前端） */
  private consoleStreamSink: ((line: string) => void) | null = null;
  /** 供 toUiPayload 在无本轮 resp 时展示上回合数值变化 */
  lastAppliedResponse: EngineResponse | null = null;
  /** 本回合新解锁的称号展示名，由 toUiPayload drain */
  pendingTitleUnlockNames: string[] = [];
  /** 叙事温度随应用配置动态读取；未挂载时使用默认值 */
  private llmTemperatureSource: (() => { primary: number; repair: number }) | null = null;

  constructor(options: {
    llm?: BaseLLM;
    state?: GameState;
    enableCg?: boolean;
    cgForceInterval?: number;
    config?: GameConfig;
  } = {}) {
    this.config = options.config ?? defaultConfig();
    this.llm = options.llm ?? makeLlm();
    this.state = options.state ?? GameState.newGame();
    this.enableCg = options.enableCg ?? true;
    this.cgForceInterval = options.cgForceInterval ?? 2;
  }

  /** 由应用层注入（读取 app-config / env）；用于断开 narrative → application 的直接依赖 */
  setLlmTemperatureSource(fn: () => { primary: number; repair: number }): void {
    this.llmTemperatureSource = fn;
  }

  private llmTemps(): { primary: number; repair: number } {
    return this.llmTemperatureSource?.() ?? { primary: 0.9, repair: 0.65 };
  }

  get llmLabel(): string {
    return this.llm.label;
  }

  private static formatClock(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${ms}`;
  }

  setConsoleStreamSink(cb: ((line: string) => void) | null): void {
    this.consoleStreamSink = cb;
  }

  appendConsole(message: string, kind: ConsoleKind = "SYS"): void {
    const ts = NarrativeEngine.formatClock();
    const tag = kind.padEnd(CONSOLE_KIND_WIDTH, " ");
    const fullLine = `${ts} ${tag} | ${message}`;
    this.consoleLines.push(fullLine);
    if (this.consoleLines.length > this.consoleMax) {
      this.consoleLines = this.consoleLines.slice(-this.consoleMax);
    }
    this.consoleStreamSink?.(fullLine);
  }

  get consoleText(): string {
    if (this.consoleLines.length === 0) return "（尚无日志）";
    return this.consoleLines.join("\n");
  }

  /** 已累计的玩家决策次数（含选项、自由输入、手动推进日历触发的叙事）；开场后未选时为 0 */
  get playerTurn(): number {
    return this.turn;
  }

  setNsfw(enabled: boolean): void {
    this.state.nsfw_mode = Boolean(enabled);
  }

  /** 从磁盘快照恢复 turn / 控制台缓冲，避免在 static 工厂里对私有字段做类型断言 */
  private applyRestoredRuntime(snap: Pick<EngineSnapshot, "turn" | "consoleLines" | "consoleMax">): void {
    this.turn = snap.turn;
    this.consoleLines = [...snap.consoleLines];
    this.consoleMax = snap.consoleMax;
  }

  private systemMessage(): { role: string; content: string } {
    return { role: "system", content: buildSystemPrompt(this.state, { sceneDir: this.config.sceneDir }) };
  }

  private isMultiCharMode(): boolean {
    return this.state.world.scene_participants.length > 1;
  }

  private multiCharSystemMessage(focusCharId: string): { role: string; content: string } {
    return {
      role: "system",
      content: buildMultiCharacterSystemPrompt(this.state, focusCharId, { sceneDir: this.config.sceneDir }),
    };
  }

  private messagesForLlm(): { role: string; content: string }[] {
    return [this.systemMessage(), ...this.state.history];
  }

  /** 多角色模式：使用主角色的历史 + 多角色 system prompt */
  private messagesForMultiCharLlm(focusCharId: string): { role: string; content: string }[] {
    const sysMsg = this.multiCharSystemMessage(focusCharId);
    const focusChar = this.state.characters.get(focusCharId);
    const history = focusChar ? focusChar.history : this.state.history;
    return [sysMsg, ...history];
  }

  /** choice_tags 含 risk 时 LLM 须填 risk_hint；否则写入默认句并打日志 */
  private ensureRiskHintCompliance(resp: EngineResponse): void {
    const hasRisk = resp.choice_tags.some((t) => t === "risk");
    if (!hasRisk) return;
    if ((resp.risk_hint || "").trim()) return;
    resp.risk_hint = DEFAULT_RISK_HINT_WHEN_TAGS_RISK.slice(0, 200);
    this.appendConsole("协议兜底 · 含 risk 标签但缺 risk_hint，已填入默认句", "STEP");
  }

  /** 场景 venue 禁止 risk 时与冷战规则一致：将 risk 改写为 advance，避免仅靠 prompt 自律 */
  private venueDisallowsRiskChoices(): boolean {
    const reg = getSceneRegistry(this.config.sceneDir);
    if (!reg?.scenesById.size) return false;
    try {
      const r = resolveScene(this.state.location || "", reg);
      return r.scene.venue?.allow_risk_choices === false;
    } catch {
      return false;
    }
  }

  private stripRiskChoiceTags(resp: EngineResponse, logLine: string): void {
    const hadRisk = resp.choice_tags.some((t) => t === "risk");
    if (!hadRisk) return;
    resp.choice_tags = resp.choice_tags.map((t) =>
      t === "risk" ? "advance" : t,
    ) as ChoiceTag[];
    if (!resp.choice_tags.includes("risk")) resp.risk_hint = "";
    this.appendConsole(logLine, "STEP");
  }

  private mergeFlagDelta(resp: EngineResponse): void {
    applyFlagDeltaToFlags(this.state.flags, resp.flag_delta);
  }

  private applyChapterAndMilestones(resp: EngineResponse): void {
    const llmDelta = resp.chapter_delta;
    let ch = this.state.chapter;
    if (llmDelta !== 0) {
      ch = Math.max(1, Math.min(7, ch + llmDelta));
      this.appendConsole(`章节 · LLM Δ${llmDelta} → 第 ${ch} 章`, "STEP");
      this.state.chapter = ch;
      return;
    }
    const before = this.state.chapter;
    const next = maybeMilestoneChapter(this.state);
    if (next > before) {
      this.state.chapter = next;
      this.appendConsole(`章节 · 里程碑 → 第 ${next} 章`, "STEP");
    }
  }

  private applyColdWarRules(resp: EngineResponse): void {
    this.state.cold_war_remaining = coldWarRemainingAfterDelta(
      this.state.cold_war_remaining,
      resp.cold_war_delta,
      this.state.trust,
    );
  }

  private applyTitleUnlocks(): void {
    const names = unlockNewTitles(this.state);
    for (const n of names) {
      this.pendingTitleUnlockNames.push(n);
      this.appendConsole(`称号 · 解锁「${n}」`, "STEP");
    }
  }

  private applyResponse(resp: EngineResponse): void {
    this.state.adjust("affection", resp.affection_delta);
    this.state.adjust("trust", resp.trust_delta);
    this.state.adjust("intimacy", resp.intimacy_delta);
    this.state.adjust("desire", resp.desire_delta);
    this.state.setDiscrete("mood", resp.mood);
    this.applyLocationFromResponse(resp);
    this.state.applyWearFromEngineResponse(resp);
    this.state.setDiscrete("relationship", resp.relationship);
    this.mergeFlagDelta(resp);
    this.applyChapterAndMilestones(resp);
    this.applyColdWarRules(resp);
    refreshTimeOfDayFromSlot(this.state);
    this.applyTitleUnlocks();
    const et = (resp.ending_title || "").trim();
    const es = (resp.ending_summary || "").trim();
    if (et) this.state.ending_title = et.slice(0, 120);
    if (es) this.state.ending_summary = es.slice(0, 500);
  }

  /**
   * 多角色状态更新。处理 replies[]、pair_deltas[]、participant_changes[]。
   */
  private applyMultiResponse(resp: EngineResponse, playerInput: string): void {
    const world = this.state.world;

    // 1. Apply participant changes
    if (resp.participant_changes) {
      for (const pc of resp.participant_changes) {
        if (pc.action === "enter") {
          if (!world.scene_participants.includes(pc.characterId)) {
            world.scene_participants.push(pc.characterId);
            const char = this.state.characters.get(pc.characterId);
            if (char) char.met = true;
            this.appendConsole(`登场 · ${pc.characterId}`, "STEP");
          }
        } else if (pc.action === "exit") {
          world.scene_participants = world.scene_participants.filter(
            (id) => id !== pc.characterId,
          );
          this.appendConsole(`离场 · ${pc.characterId}`, "STEP");
        }
      }
    }

    // 2. Apply global world changes
    this.applyLocationFromResponse(resp);
    this.applyChapterAndMilestones(resp);
    this.mergeFlagDelta(resp);
    refreshTimeOfDayFromSlot(this.state);

    const et = (resp.ending_title || "").trim();
    const es = (resp.ending_summary || "").trim();
    if (et) this.state.ending_title = et.slice(0, 120);
    if (es) this.state.ending_summary = es.slice(0, 500);

    // 3. Apply per-character replies
    if (resp.replies) {
      for (const reply of resp.replies) {
        const char = this.state.characters.get(reply.speaker);
        if (!char) continue;

        if (reply.affection_delta) {
          char.affection = Math.max(0, Math.min(100, char.affection + reply.affection_delta));
        }
        if (reply.trust_delta) {
          char.trust = Math.max(0, Math.min(100, char.trust + reply.trust_delta));
        }
        if (reply.intimacy_delta) {
          char.intimacy = Math.max(0, Math.min(100, char.intimacy + reply.intimacy_delta));
        }
        if (reply.desire_delta) {
          char.desire = Math.max(0, Math.min(100, char.desire + reply.desire_delta));
        }
        if (reply.mood) char.mood = reply.mood.slice(0, 40);
        if (reply.relationship) char.relationship = reply.relationship.slice(0, 40);
        if (reply.wear) {
          this.state.applyWearFromEngineResponse({ wear: reply.wear, wear_nsfw: reply.wear_nsfw });
        }
        if (reply.cold_war_delta) {
          char.cold_war_remaining = coldWarRemainingAfterDelta(
            char.cold_war_remaining,
            reply.cold_war_delta,
            char.trust,
          );
        }

        // Push this character's reply into their own history
        if (reply.text) {
          char.history.push({ role: "assistant", content: reply.text });
          const maxLen = char === this.state.primaryChar
            ? DEFAULT_HISTORY_USER_TURNS * 2
            : MULTI_CHAR_OTHER_TURNS * 2;
          if (char.history.length > maxLen) {
            char.history = char.history.slice(-maxLen);
          }
        }

        // CG trigger per character
        if (reply.cg_trigger && this.enableCg) {
          const useExplicit = this.cgUseExplicitVisualForChar(char, reply);
          const scene = useExplicit ? reply.cg_scene : sanitizeSceneForSafeVisual(reply.cg_scene);
          const cgPath = this.triggerCgForCharacter(scene, useExplicit, reply.speaker);
          reply.cg_path = cgPath;
        }
      }
    }

    // 4. Apply pair deltas
    if (resp.pair_deltas) {
      for (const pd of resp.pair_deltas) {
        const pair = getOrCreatePair(this.state.pairs, pd.fromId, pd.toId);
        pair.trust = Math.max(0, Math.min(100, pair.trust + pd.trust_delta));
        pair.affection = Math.max(0, Math.min(100, pair.affection + pd.affection_delta));
        if (pd.relationship) pair.relationship = pd.relationship.slice(0, 40);
        if (pd.cold_war_delta) {
          pair.cold_war_remaining = Math.max(
            0,
            Math.min(20, pair.cold_war_remaining + pd.cold_war_delta),
          );
        }
      }
    }

    // 5. Write user input into all participant histories
    for (const id of world.scene_participants) {
      const char = this.state.characters.get(id);
      if (!char) continue;
      char.history.push({ role: "user", content: playerInput });
      const maxLen = id === PRIMARY_CHARACTER_ID
        ? DEFAULT_HISTORY_USER_TURNS * 2
        : MULTI_CHAR_OTHER_TURNS * 2;
      if (char.history.length > maxLen) {
        char.history = char.history.slice(-maxLen);
      }
    }

    this.applyTitleUnlocks();
  }

  private cgUseExplicitVisualForChar(
    char: { intimacy: number; desire: number; nsfw_mode: boolean },
    reply: { cg_explicit: boolean },
  ): boolean {
    if (!this.state.world.nsfw_mode) return false;
    const flagged = Boolean(reply.cg_explicit);
    const followLlm = char.intimacy >= 36 || char.desire >= 30;
    const deep = char.intimacy >= 75 && char.desire >= 58;
    return deep || (flagged && followLlm);
  }

  private triggerCgForCharacter(scene: string, useExplicitVisual: boolean, characterId: string): string | null {
    const char = this.state.characters.get(characterId);
    if (!char) return null;

    // Find the character's card json to use for CG generation
    const charCardPath = char.cardRelativePath
      ? this.config.characterDir
        ? path.join(this.config.characterDir, char.cardRelativePath)
        : char.cardRelativePath
      : this.config.characterJson;

    const outPath = this.state.nextCgPathForCharacter(this.config.outputDir, characterId);
    this.appendConsole(
      `后台已排队 · [${characterId}] 文件 ${outPath.split(/[/\\]/).pop()} · ${useExplicitVisual ? "成人" : "日常"}`,
      "CG",
    );
    requestCg({
      characterJson: charCardPath,
      scene,
      outPath,
      modelVersionCache: this.config.modelVersionCache,
      allowExplicitVisual: useExplicitVisual,
      locationEn: this.locationBackdropEn(useExplicitVisual),
      wearOverlay: wearToCgOverlay(char.wear),
      continuitySeed: continuityLayoutSeed(
        this.state.world.chapter,
        resolveSceneIdForSeed(this.state.location || "", this.config.sceneDir),
      ),
      log: (line) => this.appendConsole(line, "CG"),
    });
    return outPath;
  }

  /**
   * 非空 location：解析 content/scenes、校验 unlock，成功则写入 display_name；失败则保留旧地点。
   */
  private applyLocationFromResponse(resp: EngineResponse): void {
    const raw = (resp.location || "").trim();
    if (!raw) return;
    const reg = getSceneRegistry(this.config.sceneDir);
    if (reg && reg.scenesById.size > 0) {
      const target = resolveScene(raw, reg);
      const un = evaluateSceneUnlock(target.scene, this.state);
      if (!un.ok) {
        this.appendConsole(`场景 · 未解锁（${un.reason}）· 维持「${this.state.location}」`, "STEP");
        resp.location = this.state.location;
        return;
      }
      const canon = target.scene.display_name.slice(0, 40);
      this.state.setDiscrete("location", canon);
      resp.location = canon;
      return;
    }
    this.state.setDiscrete("location", raw.slice(0, 40));
  }

  private syncLastUi(resp: EngineResponse): void {
    this.state.last_narration = resp.narration || "";
    const ch = [...(resp.choices || []), "", "", "", ""].slice(0, 4);
    this.state.last_choices = ch;
    const tags = [...(resp.choice_tags || [])];
    while (tags.length < 4) tags.push("advance");
    this.state.last_choice_tags = tags.slice(0, 4);
    this.state.last_risk_hint = (resp.risk_hint || "").slice(0, 200);
    this.state.story_summary = summarizeStoryLine(resp.text);
  }

  private cgUseExplicitVisual(resp: EngineResponse): boolean {
    const s = this.state;
    if (!s.nsfw_mode) return false;
    const flagged = Boolean(resp.cg_explicit);
    const followLlm = s.intimacy >= 36 || s.desire >= 30;
    const deep = s.intimacy >= 75 && s.desire >= 58;
    return deep || (flagged && followLlm);
  }

  private maybeTriggerCg(resp: EngineResponse): void {
    if (!(resp.cg_trigger && this.enableCg)) return;
    const useExplicit = this.cgUseExplicitVisual(resp);
    if (!(resp.cg_scene || "").trim()) {
      resp.cg_scene = this.autoScene(useExplicit);
    }
    const scene = useExplicit ? resp.cg_scene : sanitizeSceneForSafeVisual(resp.cg_scene);
    resp.cg_path = this.triggerCg(scene, useExplicit);
  }

  start(): EngineResponse {
    this.appendConsole("开场 · 载入固定剧本（不调用 LLM）", "SYS");
    const parsedInit: ParsedLlmResponse = parseLlmResponse(INITIAL_ASSISTANT_MESSAGE);
    const resp = parsedInit.response;
    if (!parsedInit.ok) {
      this.appendConsole(`开场剧本 JSON 解析失败 · ${parsedInit.parseError}`, "SYS");
    }
    this.applyResponse(resp);
    this.state.pushHistory("assistant", resp.text);
    this.syncLastUi(resp);
    this.appendConsole("开场 · 状态与选项已写入", "STEP");
    this.maybeTriggerCg(resp);
    this.lastAppliedResponse = resp;
    initTravelAllowanceForCurrentSlot(this.state);
    return resp;
  }

  /**
   * 切换地点（不调用 LLM）：更新 state.location，追加简短叙事与历史。
   */
  travelByLocationId(locationId: string): EngineResponse {
    const label = travelLabelForId(locationId, this.config.sceneDir);
    if (!label) throw new Error("未知的地点。");
    if (label === this.state.location) throw new Error("你已经在该地点。");
    const gate = locationLockReason(label, this.state);
    if (gate.locked) throw new Error(gate.reason || "此处无法前往。");
    if (!consumeTravelMove(this.state)) throw new Error("本时段可移动次数已用尽。请推进时间后再试。");

    this.turn += 1;
    this.state.setDiscrete("location", label);
    const userLine = `（系统：玩家移动到「${label}」。保持当前日历与时段不变，仅切换场景。）`;
    this.state.pushHistory("user", userLine);
    const blurb = pickTravelArrivalBlurb(locationId, this.turn + this.state.calendar_day * 31);
    const para = `你已来到「${label}」。${blurb}`;
    this.state.pushHistory("assistant", para);

    const normTag = (t: string): ChoiceTag => {
      const x = String(t).toLowerCase();
      return x === "risk" || x === "probe" ? (x as ChoiceTag) : "advance";
    };
    const tags = this.state.last_choice_tags.map((t) => normTag(String(t)));
    while (tags.length < 4) tags.push("advance");
    const resp: EngineResponse = {
      text: para,
      narration: this.state.last_narration,
      choices: [...this.state.last_choices],
      choice_tags: tags.slice(0, 4),
      risk_hint: this.state.last_risk_hint,
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
      mood: this.state.mood,
      location: "",
      outfit: this.state.outfit,
      wear: { ...this.state.wear },
      wear_nsfw: { ...this.state.wear_nsfw },
      time_of_day: this.state.time_of_day,
      relationship: this.state.relationship,
      game_over: false,
      ending_title: "",
      ending_summary: "",
      cold_war_delta: 0,
    };
    this.syncLastUi(resp);
    this.lastAppliedResponse = resp;
    this.appendConsole(`移动 · ${label} · 未调用 LLM`, "STEP");
    return resp;
  }

  /** 使用背包物品（不调用 LLM） */
  useItem(itemId: string): EngineResponse {
    const id = String(itemId ?? "").trim();
    const rawArr = this.state.flags.inventory;
    if (!Array.isArray(rawArr)) throw new Error("背包为空。");
    const arr = rawArr as Record<string, unknown>[];
    const idx = arr.findIndex((o) => String(o?.id ?? "").trim() === id);
    if (idx < 0) throw new Error("未持有该物品。");
    const row = arr[idx]!;
    if (row.usable === false) throw new Error("该物品暂不可使用。");
    const name = String(row.name ?? id);
    const resolved = tryResolveItemUse({ itemId: id, displayName: name });
    if (!resolved) throw new Error("此物品尚无使用效果。");
    const para = resolved.paragraph;
    const affD = Math.max(-10, Math.min(15, Math.floor(Number(resolved.affectionDelta ?? 0))));
    const trustD = Math.max(-10, Math.min(15, Math.floor(Number(resolved.trustDelta ?? 0))));
    const intD = Math.max(-5, Math.min(15, Math.floor(Number(resolved.intimacyDelta ?? 0))));
    const desD = Math.max(-10, Math.min(20, Math.floor(Number(resolved.desireDelta ?? 0))));
    const coldD = Math.max(-5, Math.min(5, Math.floor(Number(resolved.coldWarDelta ?? 0))));

    const patch = sanitizeItemUseFlagDelta(
      resolved.flagDeltaPatch as Record<string, unknown> | undefined,
    );
    if (Object.keys(patch).length > 0) {
      applyFlagDeltaToFlags(this.state.flags, patch);
    }

    this.state.adjust("affection", affD);
    this.state.adjust("trust", trustD);
    this.state.adjust("intimacy", intD);
    this.state.adjust("desire", desD);
    if (coldD !== 0) {
      this.state.cold_war_remaining = Math.max(0, Math.min(20, this.state.cold_war_remaining + coldD));
    }

    const qty = Math.max(1, Math.floor(Number(row.qty ?? 1)));
    if (itemCatalogConsumeOnUse(id)) {
      if (qty <= 1) arr.splice(idx, 1);
      else arr[idx] = { ...row, qty: qty - 1 };
      this.state.flags.inventory = arr;
    }

    this.turn += 1;
    const userLine = `（系统：玩家使用了物品「${name}」。）`;
    this.state.pushHistory("user", userLine);
    this.state.pushHistory("assistant", para);

    const normTag = (t: string): ChoiceTag => {
      const x = String(t).toLowerCase();
      return x === "risk" || x === "probe" ? (x as ChoiceTag) : "advance";
    };
    const tags = this.state.last_choice_tags.map((t) => normTag(String(t)));
    while (tags.length < 4) tags.push("advance");
    const resp: EngineResponse = {
      text: para,
      narration: this.state.last_narration,
      choices: [...this.state.last_choices],
      choice_tags: tags.slice(0, 4),
      risk_hint: this.state.last_risk_hint,
      cg_trigger: false,
      cg_explicit: false,
      cg_scene: "",
      cg_path: null,
      affection_delta: affD,
      trust_delta: trustD,
      intimacy_delta: intD,
      desire_delta: desD,
      chapter_delta: 0,
      flag_delta: {},
      mood: this.state.mood,
      location: "",
      outfit: this.state.outfit,
      wear: { ...this.state.wear },
      wear_nsfw: { ...this.state.wear_nsfw },
      time_of_day: this.state.time_of_day,
      relationship: this.state.relationship,
      game_over: false,
      ending_title: "",
      ending_summary: "",
      cold_war_delta: coldD,
    };
    this.syncLastUi(resp);
    this.lastAppliedResponse = resp;
    this.appendConsole(
      `背包 · 使用 ${name} · 信任 ${trustD >= 0 ? "+" : ""}${trustD}` +
        (affD ? ` · 好感 ${affD >= 0 ? "+" : ""}${affD}` : "") +
        (intD ? ` · 亲密 ${intD >= 0 ? "+" : ""}${intD}` : "") +
        (desD ? ` · 欲望 ${desD >= 0 ? "+" : ""}${desD}` : ""),
      "STEP",
    );
    return resp;
  }

  /**
   * 标记手机线程已读（不调用 LLM）；写入简短历史便于下一回合 LLM 承接。
   * @returns 会话标题（供 API statusMsg）
   */
  phoneMarkRead(threadId: string): string {
    const tid = String(threadId ?? "").trim();
    const arr = this.state.flags.phone_threads;
    if (!Array.isArray(arr)) throw new Error("暂无消息。");
    let title = "消息";
    let hit = false;
    for (const x of arr) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      if (String(o.id ?? "").trim() !== tid) continue;
      o.unread = false;
      title = String(o.title ?? "消息").trim() || "消息";
      hit = true;
      break;
    }
    if (!hit) throw new Error("找不到该会话。");
    const userLine = `（系统：玩家在手机上将「${title}」标为已读。）`;
    this.state.pushHistory("user", userLine);
    this.state.pushHistory(
      "assistant",
      "你划掉未读角标，屏幕安静下来——像把一根细刺轻轻拔掉，却仍留着一点余温。",
    );
    this.appendConsole(`手机 · 已读 · ${tid}`, "PLAY");
    return title;
  }

  /**
   * 玩家手动推进日历后，请求一轮叙事（系统写入 user 行，不由玩家打字）。
   */
  async advanceCalendarAndNarrate(kind: CalendarAdvanceKind): Promise<EngineResponse> {
    advanceCalendar(this.state, kind);
    refreshTimeOfDayFromSlot(this.state);
    this.appendConsole(
      `日历 · 手动推进 → 第 ${this.state.calendar_day} 天 · ${timeSlotLabel(this.state.time_slot)}`,
      "STEP",
    );
    const userLine =
      kind === "next_morning"
        ? "（剧情时间推进：已休息到第二天早上。请据新日历与清晨时段接续描写，自然衔接场景与情绪。）"
        : "（剧情时间推进：已进入下一时段。请据新日历与当前时段接续描写，自然衔接场景与情绪。）";
    this.turn += 1;
    this.state.pushHistory("user", userLine);
    initTravelAllowanceForCurrentSlot(this.state);
    return this.runLlmTurnAfterUserInput("choice");
  }

  /**
   * @param playerPickRaw 点选选项的原文；日历推进等非点选回合勿传，数值仲裁将跳过。
   * @param playerInputForMulti 多角色模式下用于写入各角色历史的原始 user 输入
   */
  private async runLlmTurnAfterUserInput(
    inputKind: "choice" | "custom",
    playerPickRaw?: string,
    playerInputForMulti?: string,
  ): Promise<EngineResponse> {
    const multiChar = this.isMultiCharMode();
    const focusCharId = this.state.world.scene_participants[0] ?? PRIMARY_CHARACTER_ID;
    const messages = multiChar
      ? this.messagesForMultiCharLlm(focusCharId)
      : this.messagesForLlm();
    pipelineLog("02_engine_prepare_llm_turn", {
      turn: this.turn,
      input_kind: inputKind,
      multi_char: multiChar,
      participant_count: this.state.world.scene_participants.length,
      llm_label: this.llmLabel,
      max_tokens_budget: getLlmMaxTokensBudget(),
      messages_count: messages.length,
      approx_context_chars: approxMessageChars(messages),
    });
    this.appendConsole(
      `第 ${this.turn} 轮 · 开始请求 · ${this.llmLabel} · 上下文 ${messages.length} 条消息`,
      "LLM",
    );

    const t0 = Date.now();
    let raw: string;
    let llmErr: string | null = null;
    try {
      raw = await this.llm.chat(messages, {
        temperature: this.llmTemps().primary,
        pipelineAttempt: "primary",
      });
    } catch (exc) {
      console.error("LLM call failed:", exc);
      llmErr =
        exc instanceof Error ? `${exc.name}: ${exc.message}` : `Error: ${String(exc)}`;
      pipelineWarn("03_llm_http_or_sdk_error", {
        turn: this.turn,
        attempt: "primary",
        error: llmErr,
      });
      raw = JSON.stringify({
        text: `（网络或模型暂时无法响应：${exc}）`,
        choices: ["重试", "保存并退出"],
        choice_tags: ["advance", "advance", "advance", "advance"],
        risk_hint: "",
        cg_trigger: false,
        cg_explicit: false,
        cg_scene: "",
        affection_delta: 0,
        trust_delta: 0,
        intimacy_delta: 0,
        desire_delta: 0,
        chapter_delta: 0,
        flag_delta: {},
        game_over: false,
        ending_title: "",
        ending_summary: "",
        cold_war_delta: 0,
      });
      pipelineLog("03_llm_fallback_json_injected", {
        turn: this.turn,
        fallback_chars: raw.length,
      });
    }
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    if (llmErr) {
      this.appendConsole(`上游失败 · ${llmErr} · Fallback ${raw.length} 字符 · ${sec}s · 解析 JSON`, "LLM");
    } else {
      this.appendConsole(`上游完成 · ${raw.length} 字符 · ${sec}s · 解析 JSON`, "LLM");
    }

    const maxRawInRepair = 12_000;
    const doParse = (r: string): ParsedLlmResponse =>
      multiChar ? parseMultiCharacterResponse(r, focusCharId) : parseLlmResponse(r);
    let parsed: ParsedLlmResponse = doParse(raw);
    pipelineLog("06_engine_after_parse_primary", {
      turn: this.turn,
      parse_ok: parsed.ok,
      raw_chars: raw.length,
    });
    if (!parsed.ok && !llmErr) {
      pipelineWarn("06_engine_parse_failed_will_retry", {
        turn: this.turn,
        raw_chars: raw.length,
        parse_error: parsed.parseError,
      });
      this.appendConsole("JSON 解析失败 · 自动紧凑重试 1/1（临时对话，不入存档）", "STEP");
      try {
        const repairMessages: { role: string; content: string }[] = [
          ...messages,
          {
            role: "assistant",
            content: raw.length > maxRawInRepair ? `${raw.slice(0, maxRawInRepair)}…` : raw,
          },
          { role: "user", content: JSON_TRUNCATION_REPAIR_USER_PROMPT },
        ];
        pipelineLog("02_engine_repair_messages_built", {
          turn: this.turn,
          messages_count: repairMessages.length,
          approx_chars: approxMessageChars(repairMessages),
          assistant_fragment_chars: Math.min(raw.length, maxRawInRepair),
        });
        const tR0 = Date.now();
        raw = await this.llm.chat(repairMessages, {
          temperature: this.llmTemps().repair,
          pipelineAttempt: "repair",
        });
        const secR = ((Date.now() - tR0) / 1000).toFixed(1);
        this.appendConsole(`紧凑重试 · 上游完成 · ${raw.length} 字符 · ${secR}s · 解析 JSON`, "LLM");
        parsed = doParse(raw);
        if (parsed.ok) {
          this.appendConsole("紧凑重试 · 已解析为合法 JSON", "STEP");
        } else {
          this.appendConsole(
            `紧凑重试 · 仍解析失败 · ${parsed.parseError} · raw ${raw.length} 字符`,
            "STEP",
          );
        }
        pipelineLog("06_engine_after_parse_repair", {
          turn: this.turn,
          parse_ok: parsed.ok,
          raw_chars: raw.length,
        });
      } catch (retryExc) {
        console.error("LLM compact retry failed:", retryExc);
        pipelineWarn("06_engine_repair_request_failed", {
          turn: this.turn,
          error:
            retryExc instanceof Error ? `${retryExc.name}: ${retryExc.message}` : String(retryExc),
        });
        this.appendConsole(
          `紧凑重试 · 请求异常 · ${
            retryExc instanceof Error ? `${retryExc.name}: ${retryExc.message}` : String(retryExc)
          }`,
          "STEP",
        );
      }
    }

    let resp = parsed.response;
    if (!parsed.ok) {
      pipelineWarn("07_engine_turn_final_parse_still_bad", {
        turn: this.turn,
        parse_error: parsed.parseError,
        raw_chars: raw.length,
        hint: "check 04_llm_response truncated / completion_tokens vs max_tokens_requested",
      });
      this.appendConsole(
        `JSON 解析失败 · ${parsed.parseError} · raw ${raw.length} 字符 · 查服务端 [game:pipeline] 04_llm_response / 05_parse_JSON_INVALID`,
        "STEP",
      );
    } else {
      pipelineLog("07_engine_turn_ready", {
        turn: this.turn,
        text_chars: (resp.text || "").length,
        cg_trigger: resp.cg_trigger,
      });
    }
    if (this.venueDisallowsRiskChoices()) {
      this.stripRiskChoiceTags(resp, "场景规则 · 当前地点不宜 risk，已收敛为 advance");
    }
    if (this.state.cold_war_remaining >= 3) {
      const hadRisk = resp.choice_tags.some((t) => t === "risk");
      resp.choice_tags = resp.choice_tags.map((t) =>
        t === "risk" ? "advance" : t,
      ) as ChoiceTag[];
      if (hadRisk) {
        this.appendConsole("冷战规则 · 僵持≥3 时收敛 risk 选项为 advance", "STEP");
        if (!resp.choice_tags.includes("risk")) resp.risk_hint = "";
      }
    }
    this.ensureRiskHintCompliance(resp);
    if (inputKind === "custom") {
      /** 自由输入仍略放大信任波动，但系数从 1.15 降到 1.08，减少「一句炸档」 */
      resp.trust_delta = Math.max(
        -15,
        Math.min(15, Math.round(resp.trust_delta * 1.08)),
      );
    }

    // 顺序：parser 全局夹紧 → venue/cold/risk_hint → custom trust 缩放 → 点选标签数值仲裁
    const appliedTag = resolveChoiceTagForPick(
      playerPickRaw ?? "",
      inputKind,
      this.state.last_choices,
      this.state.last_choice_tags,
    );
    const trustBeforeArb = resp.trust_delta;
    const arb = arbitrateTrustDeltaForChoiceContext(trustBeforeArb, {
      appliedTag,
      coldWarRemaining: this.state.cold_war_remaining,
      inputKind,
    });
    if (arb.adjusted) {
      resp.trust_delta = arb.trustDelta;
      this.appendConsole(
        `数值仲裁 · trust_delta ${trustBeforeArb} → ${arb.trustDelta}（点选标签=${appliedTag ?? "无"}）`,
        "STEP",
      );
    }

    if (multiChar && resp.replies) {
      // Multi-character apply path
      this.applyMultiResponse(resp, playerInputForMulti ?? playerPickRaw ?? "");
      this.syncLastUi(resp);
      this.state.recap_pending = false;
    } else {
      // Single-character apply path (unchanged)
      this.applyResponse(resp);
      this.state.pushHistory("assistant", resp.text);
      this.syncLastUi(resp);
      this.state.recap_pending = false;
    }

    const nChoices = resp.choices.filter((c) => (c || "").trim()).length;
    this.appendConsole(
      `回合已落地 · 有效选项 ${nChoices} 个` + (resp.cg_trigger ? " · 本回合标记出图" : ""),
      "STEP",
    );

    if (!multiChar) {
      const wouldIntervalForce =
        !resp.cg_trigger &&
        this.enableCg &&
        this.cgForceInterval > 0 &&
        this.turn % this.cgForceInterval === 0;
      if (wouldIntervalForce && this.state.cold_war_remaining >= 2) {
        this.appendConsole("冷战疏离 ≥2：跳过本回合间隔性强制的 CG，以免冲淡情绪", "STEP");
      } else if (wouldIntervalForce) {
        resp.cg_trigger = true;
        this.appendConsole(`间隔规则 · 第 ${this.turn} 轮强制触发 CG`, "STEP");
      }
      this.maybeTriggerCg(resp);
    }
    // Multi-char CG is already triggered inside applyMultiResponse per-character

    this.lastAppliedResponse = resp;
    return resp;
  }

  async step(
    playerInput: string,
    opts: { inputKind?: "choice" | "custom" } = {},
  ): Promise<EngineResponse> {
    const inputKind = opts.inputKind ?? "choice";
    const lastRaw = String(this.state.flags["_last_player_raw"] ?? "");
    const repeatChoice = lastRaw === playerInput && playerInput.length > 0;
    this.state.flags["_last_player_raw"] = playerInput;

    this.turn += 1;
    const tagPx = choiceTagSystemPrefixForLlm(
      playerInput,
      inputKind,
      this.state.last_choices,
      this.state.last_choice_tags,
    );
    let userLine = USER_TURN_ZH_REMINDER + tagPx + playerInput;
    if (repeatChoice) {
      userLine =
        "（系统：玩家与上一回合选择了相同行动，请换台词与微动作，勿复读。）\n" + userLine;
    }

    if (this.isMultiCharMode()) {
      // In multi-char mode, we only push user line to the focus character's history;
      // applyMultiResponse will push to all participant histories after LLM response.
      const focusCharId = this.state.world.scene_participants[0] ?? PRIMARY_CHARACTER_ID;
      const focusChar = this.state.characters.get(focusCharId);
      if (focusChar) {
        focusChar.history.push({ role: "user", content: userLine });
      }
    } else {
      this.state.pushHistory("user", userLine);
    }

    return this.runLlmTurnAfterUserInput(inputKind, playerInput, userLine);
  }

  private autoScene(allowExplicitVisual: boolean): string {
    const s = this.state;
    const parts = ["standing, neutral pose, cinematic"];
    if (allowExplicitVisual && s.nsfw_mode && s.desire >= 50) {
      parts.push("sensual atmosphere, intimate tension");
    }
    if (allowExplicitVisual && s.nsfw_mode && s.intimacy >= 70) {
      parts.push("close physical contact, intimate, suggestive");
    }
    return parts.join(", ");
  }

  private locationBackdropEn(useExplicitVisual: boolean): string {
    return resolveLocationLayoutEn(this.state.location || "", {
      sceneDir: this.config.sceneDir,
      timeOfDay: this.state.time_of_day,
      useExplicitVisual,
    });
  }

  private triggerCg(scene: string, useExplicitVisual: boolean): string | null {
    const outPath = this.state.nextCgPath(this.config.outputDir);
    this.appendConsole(
      `后台已排队 · 文件 ${outPath.split(/[/\\]/).pop()} · 场景约 ${scene.length} 字 · ` +
        `${useExplicitVisual ? "画面·成人" : "画面·日常"}`,
      "CG",
    );
    requestCg({
      characterJson: this.config.characterJson,
      scene,
      outPath,
      modelVersionCache: this.config.modelVersionCache,
      allowExplicitVisual: useExplicitVisual,
      locationEn: this.locationBackdropEn(useExplicitVisual),
      wearOverlay: wearToCgOverlay(this.state.wear),
      continuitySeed: continuityLayoutSeed(
        this.state.chapter,
        resolveSceneIdForSeed(this.state.location || "", this.config.sceneDir),
      ),
      log: (line) => this.appendConsole(line, "CG"),
    });
    return outPath;
  }

  save(slot: number): void {
    this.state.story_summary = summarizeStoryLine(
      [...this.state.history].reverse().find((m) => m.role === "assistant")?.content || "",
    );
    this.state.save(slot);
    this.appendConsole(`写入 · 槽位 ${slot + 1}`, "SAVE");
  }

  load(slot: number): void {
    this.state = GameState.load(slot);
    delete this.state.flags["_last_player_raw"];
    this.turn = this.state.history.filter((m) => m.role === "user").length;
    this.consoleLines = [];
    this.lastAppliedResponse = null;
    this.pendingTitleUnlockNames = [];
    this.appendConsole(`读取 · 槽位 ${slot + 1} · 累计用户回合 ${this.turn}`, "SAVE");
  }

  reset(): void {
    const nsfw = this.state.nsfw_mode;
    this.state = GameState.newGame();
    this.state.nsfw_mode = nsfw;
    this.turn = 0;
    this.lastAppliedResponse = null;
    this.pendingTitleUnlockNames = [];
  }

  toSnapshot(): EngineSnapshot {
    return {
      state: this.state.toDict(),
      turn: this.turn,
      consoleLines: [...this.consoleLines],
      consoleMax: this.consoleMax,
      enableCg: this.enableCg,
      cgForceInterval: this.cgForceInterval,
    };
  }

  static fromSnapshot(snap: EngineSnapshot, config?: GameConfig): NarrativeEngine {
    const eng = new NarrativeEngine({
      config,
      llm: makeLlm(),
      state: GameState.fromDict(snap.state as unknown as Record<string, unknown>),
      enableCg: snap.enableCg,
      cgForceInterval: snap.cgForceInterval,
    });
    eng.applyRestoredRuntime(snap);
    return eng;
  }
}

export function lastCgFilepath(engine: NarrativeEngine): string | null {
  const s = engine.state;
  if (s.cg_count <= 0) return null;
  return resolvedCgFilepathAt(engine, s.cg_count);
}

export function resolvedCgFilepathAt(engine: NarrativeEngine, index: number): string | null {
  if (index <= 0) return null;
  const s = engine.state;
  const p = path.join(
    engine.config.outputDir,
    `cg_${String(s.chapter).padStart(2, "0")}_${String(index).padStart(3, "0")}.png`,
  );
  try {
    if (fs.existsSync(p) && fs.statSync(p).size > 1000) return p;
  } catch {
    /* ignore */
  }
  return null;
}
