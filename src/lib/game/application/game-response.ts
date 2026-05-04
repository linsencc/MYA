import fs from "fs";
import path from "path";
import type { EngineResponse } from "@/lib/game/domain/models";
import type { NarrativeEngine } from "@/lib/game/narrative/engine";
import { lastCgFilepath, resolvedCgFilepathAt } from "@/lib/game/narrative/engine";
import { listSlots } from "@/lib/game/domain/state";
import { placeholderPublicPath } from "@/lib/game/adapters/cg";
import { buildCalendarLine, timeSlotLabel, weekdayCnForCalendarDay } from "@/lib/game/domain/calendar";
import { characterStandImageUrl, cgPublicUrlFromDiskPath } from "@/lib/game/application/cg-url";
import { titleRowsForUi } from "@/lib/game/domain/titles";
import { buildPlayerProgressHints } from "@/lib/game/domain/progress-hints";
import { buildFlagSummaryForUi } from "@/lib/game/content/story-flags";
import { buildWorldUiBlock } from "@/lib/game/content/world-locations";
import { resolveSceneAffordances } from "@/lib/game/content/scene-affordances";
import { getSceneRegistry, resolveScene } from "@/lib/game/scene/registry";
import { DEFAULT_PROTAGONIST_DISPLAY_NAME, DEFAULT_PROTAGONIST_ID } from "@/lib/game/application/game-cast-constants";
import type {
  CharacterRosterEntry,
  GameCastEntry,
  GameUiPayload,
  StatDeltas,
  UiCharacterReply,
  UiMultiChoice,
  UiPairRelation,
} from "@/lib/game/contracts/game-ui";

export type { GameCastEntry, GameUiPayload, StatDeltas } from "@/lib/game/contracts/game-ui";

function lastAssistantText(engine: NarrativeEngine): string {
  for (let i = engine.state.history.length - 1; i >= 0; i--) {
    const m = engine.state.history[i];
    if (m.role === "assistant") return m.content || "";
  }
  return "";
}

function cgBasename(filePath: string | null): string | null {
  if (!filePath) return null;
  return path.basename(filePath);
}

function emptyDeltas(): StatDeltas {
  return { affection: 0, trust: 0, intimacy: 0, desire: 0, chapter: 0 };
}

function deltasFromResp(resp: EngineResponse | null | undefined): StatDeltas {
  if (!resp) return emptyDeltas();
  return {
    affection: resp.affection_delta,
    trust: resp.trust_delta,
    intimacy: resp.intimacy_delta,
    desire: resp.desire_delta,
    chapter: resp.chapter_delta,
  };
}

export function toUiPayload(
  engine: NarrativeEngine,
  resp: EngineResponse | null,
  opts: { thinking?: boolean } = {},
): GameUiPayload {
  const s = engine.state;
  const storyText = resp?.text ?? lastAssistantText(engine);
  const narration = resp?.narration ?? s.last_narration;
  const choices = (resp?.choices ?? s.last_choices).slice(0, 4);
  while (choices.length < 4) choices.push("");
  const choiceTags = (resp?.choice_tags?.map(String) ?? s.last_choice_tags ?? []).slice(0, 4);
  while (choiceTags.length < 4) choiceTags.push("advance");
  const riskHint = resp?.risk_hint ?? s.last_risk_hint ?? "";

  const applied = resp ?? engine.lastAppliedResponse;
  const lastStatDeltas = deltasFromResp(applied);

  const cgDisk = lastCgFilepath(engine);
  let cgImageSrc: string | null = null;
  let cgPendingPath: string | null = null;
  const standSrc = characterStandImageUrl(engine.config.characterJson);

  if (!engine.enableCg) {
    cgImageSrc = standSrc;
    cgPendingPath = null;
  } else {
    const expected = s.cg_count > 0
      ? path.join(
          engine.config.outputDir,
          `cg_${String(s.chapter).padStart(2, "0")}_${String(s.cg_count).padStart(3, "0")}.png`,
        )
      : null;

    if (cgDisk) {
      cgImageSrc = cgPublicUrlFromDiskPath(cgDisk);
    } else if (expected && fs.existsSync(expected) === false && (resp?.cg_trigger || s.cg_count > 0)) {
      cgPendingPath = expected;
      const prev = resolvedCgFilepathAt(engine, s.cg_count - 1);
      cgImageSrc = prev ? cgPublicUrlFromDiskPath(prev) : placeholderPublicPath();
    } else {
      cgImageSrc = placeholderPublicPath();
    }
  }

  const newTitleUnlocks = [...engine.pendingTitleUnlockNames];
  engine.pendingTitleUnlockNames.length = 0;

  const { chapterThemeShort, progressHintLines } = buildPlayerProgressHints(s);
  const flagSummaryLines = buildFlagSummaryForUi(s);

  const world = buildWorldUiBlock(s, engine.config.sceneDir);
  const currentLoc = world.locations.find((l) => l.current);

  // 优先 world_cg_by_time_slot[时段]；否则用**已解析场景**的 world_cg_src（与 resolveScene 别名一致）。
  // 不可仅依赖 currentLoc.cgImageSrc：地图行用 travel_label 精确匹配，state.location 可能是「商店」等别名，会偶发匹配不上导致无图。
  const _sceneReg = getSceneRegistry(engine.config.sceneDir ?? "");
  const _resolvedScene = _sceneReg ? resolveScene(s.location, _sceneReg).scene : null;
  const _sceneBgBySlot = _resolvedScene?.world_cg_by_time_slot;
  const _slotImg = _sceneBgBySlot?.[String(s.time_slot)]?.trim() ?? "";
  const _worldCgDefault = _resolvedScene?.world_cg_src?.trim() ?? "";
  const sceneBackgroundSrc = _slotImg
    ? _slotImg
    : _worldCgDefault
      ? _worldCgDefault
      : currentLoc?.cgImageSrc?.trim()
        ? currentLoc.cgImageSrc
        : null;
  const sceneAffordances = resolveSceneAffordances(world, s.location);
  const portSrc = engine.enableCg
    ? (cgImageSrc && cgImageSrc.trim()) || placeholderPublicPath()
    : standSrc;

  // Build cast from scene_participants (multi-character support)
  const participants = s.world.scene_participants;
  const isMultiChar = participants.length > 1;

  const SLOTS: Array<"left" | "center" | "right"> =
    participants.length === 1
      ? ["left"]
      : participants.length === 2
        ? ["left", "right"]
        : ["left", "center", "right"];

  const cast: GameCastEntry[] = participants.slice(0, 3).map((charId, i) => {
    const char = s.characters.get(charId);
    const charPortSrc = (() => {
      if (!engine.enableCg) {
        return characterStandImageUrl(engine.config.characterJson);
      }
      // For multi-char, try to resolve per-character CG
      if (isMultiChar && char) {
        const charCgCount = char.cg_count;
        if (charCgCount > 0) {
          const charCgPath = path.join(
            engine.config.outputDir,
            charId,
            `cg_${String(s.world.chapter).padStart(2, "0")}_${String(charCgCount).padStart(3, "0")}.png`,
          );
          if (fs.existsSync(charCgPath) && fs.statSync(charCgPath).size > 1000) {
            return cgPublicUrlFromDiskPath(charCgPath);
          }
        }
        return placeholderPublicPath();
      }
      // Single char: use existing cgImageSrc
      return portSrc;
    })();

    return {
      characterId: charId,
      displayName: char?.displayName ?? (charId === DEFAULT_PROTAGONIST_ID ? DEFAULT_PROTAGONIST_DISPLAY_NAME : charId),
      portraitSrc: charPortSrc,
      slot: SLOTS[i] ?? "left",
    };
  });

  // Fallback: if no participants, default to protagonist
  if (cast.length === 0) {
    cast.push({
      characterId: DEFAULT_PROTAGONIST_ID,
      displayName: DEFAULT_PROTAGONIST_DISPLAY_NAME,
      portraitSrc: portSrc,
      slot: "left",
    });
  }

  // Build pendingCgMap for multi-char
  let pendingCgMap: Record<string, string | null> | undefined;
  if (isMultiChar) {
    pendingCgMap = {};
    for (const charId of participants) {
      const char = s.characters.get(charId);
      if (!char || char.cg_count <= 0) {
        pendingCgMap[charId] = null;
        continue;
      }
      const charCgPath = path.join(
        engine.config.outputDir,
        charId,
        `cg_${String(s.world.chapter).padStart(2, "0")}_${String(char.cg_count).padStart(3, "0")}.png`,
      );
      if (!fs.existsSync(charCgPath)) {
        pendingCgMap[charId] = path.basename(charCgPath);
      } else {
        pendingCgMap[charId] = null;
      }
    }
  }

  // Build multi-character UI replies
  let replies: UiCharacterReply[] | undefined;
  let multiChoices: UiMultiChoice[] | undefined;
  if (resp?.replies && isMultiChar) {
    replies = resp.replies.map((r) => {
      const char = s.characters.get(r.speaker);
      return {
        speaker: r.speaker,
        displayName: char?.displayName ?? r.speaker,
        text: r.text,
        narration: r.narration,
      };
    });
  }
  if (resp?.multi_choices && isMultiChar) {
    multiChoices = resp.multi_choices.map((c) => {
      const char = s.characters.get(c.speaker);
      return {
        label: c.label,
        tag: c.tag,
        speaker: c.speaker,
        speakerDisplayName: char?.displayName ?? c.speaker,
      };
    });
  }

  // Build pair relations for present characters
  let pairRelations: UiPairRelation[] | undefined;
  if (isMultiChar && s.pairs.length > 0) {
    pairRelations = s.pairs
      .filter((p) => participants.includes(p.fromId) && participants.includes(p.toId))
      .map((p) => ({
        fromId: p.fromId,
        toId: p.toId,
        fromName: s.characters.get(p.fromId)?.displayName ?? p.fromId,
        toName: s.characters.get(p.toId)?.displayName ?? p.toId,
        trust: p.trust,
        affection: p.affection,
        relationship: p.relationship,
        coldWarRemaining: p.cold_war_remaining,
      }));
  }

  const titleRowsForRoster = titleRowsForUi(s.unlocked_title_ids);
  const characterRoster: CharacterRosterEntry[] = [];
  for (const [charId, char] of s.characters) {
    if (!char.met) continue;
    const charPortSrc = charId === DEFAULT_PROTAGONIST_ID ? portSrc : placeholderPublicPath();
    characterRoster.push({
      id: charId,
      displayName: char.displayName,
      portraitSrc: charPortSrc,
      met: char.met,
      affection: char.affection,
      trust: char.trust,
      intimacy: char.intimacy,
      desire: char.desire,
      relationship: char.relationship,
      mood: char.mood,
      location: char.location,
      coldWarRemaining: char.cold_war_remaining,
      outfit: charId === DEFAULT_PROTAGONIST_ID ? s.outfit : "",
      wear: { ...char.wear },
      wearNsfw: { ...char.wear_nsfw },
      nsfwMode: s.nsfw_mode,
      titleRows: charId === DEFAULT_PROTAGONIST_ID ? titleRowsForRoster : [],
      flagSummaryLines: charId === DEFAULT_PROTAGONIST_ID ? flagSummaryLines : [],
      lastStatDeltas: charId === DEFAULT_PROTAGONIST_ID ? lastStatDeltas : { affection: 0, trust: 0, intimacy: 0, desire: 0, chapter: 0 },
    });
  }
  // Ensure protagonist is first
  characterRoster.sort((a, b) =>
    a.id === DEFAULT_PROTAGONIST_ID ? -1 : b.id === DEFAULT_PROTAGONIST_ID ? 1 : 0,
  );

  const focusCharacterId = participants[0] ?? DEFAULT_PROTAGONIST_ID;

  return {
    storyText,
    narration,
    affection: s.affection,
    trust: s.trust,
    intimacy: s.intimacy,
    desire: s.desire,
    stage: s.stage,
    intimacyStage: s.intimacy_stage,
    desireStage: s.desire_stage,
    chapter: s.chapter,
    relationship: s.relationship,
    timeOfDay: s.time_of_day,
    calendarLine: buildCalendarLine(s),
    calendarDay: s.calendar_day,
    weekdayLabel: weekdayCnForCalendarDay(s.calendar_day),
    timeSlot: s.time_slot,
    timeSlotLabel: timeSlotLabel(s.time_slot),
    playerTurn: engine.playerTurn,
    location: s.location,
    mood: s.mood,
    outfit: s.outfit,
    wear: { ...s.wear },
    wearNsfw: { ...s.wear_nsfw },
    nsfwMode: s.nsfw_mode,
    choices,
    choiceTags,
    riskHint,
    lastStatDeltas,
    endingTitle: s.ending_title,
    endingSummary: s.ending_summary,
    coldWarRemaining: s.cold_war_remaining,
    metaCgSeenCount: s.meta_cg_seen_count,
    cgForceInterval: engine.cgForceInterval,
    enableCg: engine.enableCg,
    cgImageSrc,
    cgPendingPath: cgBasename(cgPendingPath),
    sceneBackgroundSrc,
    sceneAffordances,
    cast,
    focusCharacterId,
    consoleText: engine.consoleText,
    saveLabel: s.save_label,
    flags: { ...s.flags },
    titleRows: titleRowsForRoster,
    newTitleUnlocks,
    slots: listSlots(),
    thinking: opts.thinking,
    chapterThemeShort,
    progressHintLines,
    flagSummaryLines,
    world,
    characterRoster,
    replies,
    multiChoices,
    pendingCgMap,
    pairRelations,
  };
}

export { cgPublicUrlFromDiskPath };
