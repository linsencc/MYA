import type { GameState } from "@/lib/game/domain/state";
import { buildFlagDirectorPrompt } from "@/lib/game/content/story-flags";
export function recapParagraph(state: GameState): string {
  if (!state.recap_pending) return "";
  const last = [...state.history].reverse().find((m) => m.role === "assistant")?.content;
  const tail = (last || "").replace(/\s+/g, " ").slice(0, 120);
  return (
    `## 读档回顾（本轮叙事须承接）\n` +
    `- 进度：第 ${state.chapter} 章 · ${state.location}\n` +
    `- 最近剧情摘要：${tail || "（无）"}\n`
  );
}

export function coldWarParagraph(state: GameState): string {
  if (state.cold_war_remaining <= 0) return "";
  return (
    `## 冷战 / 回避态\n` +
    `陈悦保持距离，回应宜简短、带刺或礼貌而疏远；若玩家真诚修复关系可逐步缓和。\n` +
    `（剩余约 ${state.cold_war_remaining} 回合的疏离感）\n`
  );
}

export function trustDesireMatrix(state: GameState): string {
  const t = state.trust;
  const d = state.desire;
  if (t < 40 && d >= 55) {
    return (
      `## 剧本张力模板\n` +
      `信任偏低、欲望偏高：强调危险张力、试探、误会与心跳，避免写成已稳定恋人。\n`
    );
  }
  if (t >= 60 && d <= 40) {
    return (
      `## 剧本张力模板\n` +
      `信任高、欲望克制：慢热、细腻、分寸感，以小动作与停顿制造暧昧。\n`
    );
  }
  return "";
}

/** 亲密与信任、欲望的错位（与 trustDesireMatrix 互补，优先写心理边界与节奏） */
export function intimacyTrustTension(state: GameState): string {
  const t = state.trust;
  const i = state.intimacy;
  const d = state.desire;
  if (i >= 42 && t < 38) {
    return (
      `## 亲密×信任张力\n` +
      `身体或心理距离拉近较快，但信任仍薄：台词宜带犹豫、自我保护、试探性收回；` +
      `避免写成毫无保留的恋人，可用 risk_hint 提醒玩家冒险选项伤信任。\n`
    );
  }
  if (t >= 62 && i < 28) {
    return (
      `## 亲密×信任张力\n` +
      `她愿意托付态度与情绪，但肢体亲密仍克制：以细节信任推进，忌突然越界；` +
      `probe 选项宜多于 risk。\n`
    );
  }
  if (i >= 48 && d < 35) {
    return (
      `## 亲密×欲望张力\n` +
      `距离已近而情欲不显：可写温柔克制、「明明很近却仍守着线」的停顿感，别硬写色情。\n`
    );
  }
  return "";
}

/** 随好感阶段提示可用地点/互动（仅 prompt 约束，非硬系统） */
export function stageUnlockHints(state: GameState): string {
  const st = state.stage;
  const locHint =
    st === "陌生" || st === "同学关系"
      ? "地点池：教室、走廊、办公室门口。走廊易遇学生或老师擦肩，可一句带过配角，勿喧宾夺主。"
      : st === "被注意到" || st === "心动"
        ? "地点池：办公室、图书馆、操场边、咖啡厅外。公共场合注意目击者；冒险选项可用 risk 并写清 risk_hint。"
        : "地点池：空教室、办公室深夜、老师住所外、车内（停驶）等（须与 relationship 一致）。高张力地点仍可能有第三人敲门、电话或邻居，不宜写成真空世界。";
  return `## 阶段与场景\n${locHint}\n`;
}

/** 按 relationship 约束称呼、距离与话题，减少字段与台词撕裂 */
export function relationshipDirectorBlock(state: GameState): string {
  const r = (state.relationship || "师生").trim();
  if (r.includes("情人")) {
    return (
      `## 关系导演（情人）\n` +
      `- 私密场合可更直白，但陈悦仍保留自尊与间歇清醒；忌写成单向工具人。\n` +
      `- text 可略放松，narration 可写矛盾与自责。\n`
    );
  }
  if (r.includes("恋人")) {
    return (
      `## 关系导演（恋人）\n` +
      `- 可平等互称，但校园内仍须收敛；公共场合维持师长体面。\n` +
      `- 亲密描写与「仍在学校体系内」的张力并存。\n`
    );
  }
  if (r.includes("暧昧")) {
    return (
      `## 关系导演（暧昧）\n` +
      `- 称呼仍以「你」为主，可偶有破例但立刻收回或自嘲。\n` +
      `- 话题：学习、关心、试探性靠近；忌突然恋人式占有。\n`
    );
  }
  return (
    `## 关系导演（师生为基线）\n` +
    `- 维持称呼与权力距离：她是老师，你是学生；调侃须克制。\n` +
    `- 除非 relationship 已变，否则避免恋人独占语气。\n`
  );
}

/** narration 与 text 分工；高压时强制内心层次 */
export function narrationDisciplineBlock(state: GameState): string {
  const lines: string[] = [
    "## 内心独白纪律",
    "- narration 为「我」的真实心理，禁止只做 text 的同义复述；若无反差可留空。",
    "- **narration 同样禁止**谜语简写、拼音字母缩写；用完整心理短句表达怕、羞、自责、欲望拉扯。",
  ];
  if (state.cold_war_remaining > 0 || state.trust < 25) {
    lines.push("- 本轮 **narration 建议非空**：须写出防御、委屈、犹豫或自我说服，与 text 的冷淡/礼貌可形成反差。");
  } else if (state.intimacy >= 42 && state.trust < 38) {
    lines.push("- 亲密进展与信任错位：narration 宜写害怕、想逃或自我警告，忌内心与 text 同时甜腻。");
  } else if (state.affection >= 60 && state.desire >= 55) {
    lines.push("- 情绪与欲望偏高：narration 可写身体反应与理智拉扯，但须与陈悦底色（克制）相容。");
  }
  return `${lines.join("\n")}\n`;
}

/** 将注册表激活项注入「关系记忆」导演段 */
export function flagMemoryDirectorBlock(state: GameState): string {
  const inner = buildFlagDirectorPrompt(state).trim();
  if (!inner) return "";
  return `## 关系记忆（须承接）\n${inner}\n`;
}