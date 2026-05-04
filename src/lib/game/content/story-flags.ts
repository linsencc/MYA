import type { GameState } from "@/lib/game/domain/state";

/** 与含 risk 选项但 LLM 未填 risk_hint 时的兜底句一致（引擎 + 前端可引用） */
export const DEFAULT_RISK_HINT_WHEN_TAGS_RISK =
  "本回合含「冒险」选项：可能明显波动信任或拉长冷战，请谨慎。";

export type StoryFlagEntry = {
  key: string;
  order: number;
  /** 写入 system prompt 的一行导演指令（无激活则不出现） */
  promptWhenActive: string;
  /** 侧栏「关系记忆」标题 */
  playerLabel: string;
};

/**
 * 单一事实来源：约定键名、导演句、UI 标签。
 * 勿随意改名（与称号判定、存档 flags 一致）。
 */
export const STORY_FLAG_REGISTRY: readonly StoryFlagEntry[] = [
  {
    key: "true_ending_hint",
    order: 10,
    promptWhenActive: "叙事须保留家访/真结局线的伏笔与分寸，勿提前剧透终局。",
    playerLabel: "真结局线伏笔",
  },
  {
    key: "extremity_boundaries",
    order: 20,
    promptWhenActive: "师生底线已被叙事越过：陈悦的羞怯、自责与自我保护须可感，忌写成毫无代价的甜宠。",
    playerLabel: "底线已越过",
  },
  {
    key: "agreed_weekend_tutor",
    order: 30,
    promptWhenActive: "已存在「约好周末补习/独处」类约定：后续回合须自然兑现或解释改期，勿当作从未发生。",
    playerLabel: "周末约定",
  },
  {
    key: "colleague_suspicion",
    order: 32,
    promptWhenActive:
      "同事或同科组已起疑或旁敲侧击：陈悦在办公室、走廊须更怕闲话、收敛距离；台词可带防备，勿写成无人看见。",
    playerLabel: "同事起疑",
  },
  {
    key: "parent_or_family_contact",
    order: 34,
    promptWhenActive:
      "家长或长辈已与玩家打过照面：家访、称呼与边界须延续，忌写「从未见过」；陈悦在家与家长同时在场时更拘谨。",
    playerLabel: "家长照面",
  },
  {
    key: "rumor_circulating",
    order: 36,
    promptWhenActive:
      "校园或邻里流言已在传：叙事可偶尔点到压力源（不必每句提）；若剧情已平息可置 false 解除；勿为虐而虐。",
    playerLabel: "流言压力",
  },
  {
    key: "witnessed_almost_exposed",
    order: 38,
    promptWhenActive:
      "曾差点被第三人撞见亲密或越界场面：数回合内宜写后怕、主动避嫌或短暂冷处理，可与 trust/cold_war 一致。",
    playerLabel: "险被撞见",
  },
  {
    key: "first_kiss_hint",
    order: 40,
    promptWhenActive: "初吻或首次越线类节点已在剧情成立：后续称呼与距离感可略松动但仍带犹豫。",
    playerLabel: "首次越线节点",
  },
  {
    key: "player_sincere_apology",
    order: 50,
    promptWhenActive: "玩家曾真诚道歉并被陈悦接纳：她可略软化态度，但仍保留师长分寸，勿瞬间全盘信任。",
    playerLabel: "真诚道歉被接纳",
  },
  {
    key: "she_shared_work_stress",
    order: 60,
    promptWhenActive: "陈悦曾向玩家透露工作压力且被尊重倾听：后续可偶尔callback疲惫与责任，勿滥情诉苦。",
    playerLabel: "工作压力被倾听",
  },
  {
    key: "boundary_respected_after_probe",
    order: 70,
    promptWhenActive: "边界被试探后玩家选择退让：陈悦内心应记下这份尊重，台词可略暖但仍克制。",
    playerLabel: "边界试探后退让",
  },
  {
    key: "player_crossed_line_unrepaired",
    order: 80,
    promptWhenActive: "曾有一次明显越界尚未在叙事中修复：她应保持警惕或疏离，勿无铺垫原谅。",
    playerLabel: "越界未修复",
  },
  {
    key: "trust_repair_moment",
    order: 90,
    promptWhenActive: "出现过关系修复的关键时刻：后续冲突时不应完全失忆，可一句带过「上次你也……」式记忆。",
    playerLabel: "关系修复支点",
  },
  {
    key: "she_showed_vulnerability_once",
    order: 100,
    promptWhenActive: "陈悦曾展露过一次明显脆弱（非调情）：本轮可延续她对外硬、对内慌的层次，勿性格反转。",
    playerLabel: "她曾显露脆弱",
  },
];

const DIRECTOR_MAX_CHARS = 1200;
const UI_MAX_ITEMS = 8;

function isStoryFlagActive(raw: unknown): boolean {
  if (raw === true) return true;
  if (typeof raw === "string" && raw.trim().length > 0) return true;
  return false;
}

/** 供 system prompt：仅激活项，总长度封顶 */
export function buildFlagDirectorPrompt(state: GameState): string {
  const flags = state.flags;
  const lines: string[] = [];
  const sorted = [...STORY_FLAG_REGISTRY].sort((a, b) => a.order - b.order);
  for (const entry of sorted) {
    if (!isStoryFlagActive(flags[entry.key])) continue;
    lines.push(`- ${entry.promptWhenActive}`);
  }
  if (lines.length === 0) return "";
  let body = lines.join("\n");
  if (body.length > DIRECTOR_MAX_CHARS) {
    body = `${body.slice(0, DIRECTOR_MAX_CHARS)}…`;
  }
  return body;
}

export type FlagSummaryRowUi = { id: string; label: string; detail: string };

/** 侧栏白名单摘要：仅注册表键，最多 8 条 */
export function buildFlagSummaryForUi(state: GameState): FlagSummaryRowUi[] {
  const flags = state.flags;
  const sorted = [...STORY_FLAG_REGISTRY].sort((a, b) => a.order - b.order);
  const out: FlagSummaryRowUi[] = [];
  for (const entry of sorted) {
    const v = flags[entry.key];
    if (!isStoryFlagActive(v)) continue;
    let detail: string;
    if (typeof v === "string") {
      const s = v.trim();
      detail = s.length > 48 ? `${s.slice(0, 48)}…` : s || "已记下";
    } else {
      detail = "已发生";
    }
    out.push({ id: entry.key, label: entry.playerLabel, detail });
    if (out.length >= UI_MAX_ITEMS) break;
  }
  return out;
}

/** 生成 flag_delta 说明用键名列表（供 prompts 引用，避免与注册表漂移） */
export function storyFlagKeysForPromptDoc(): string {
  return STORY_FLAG_REGISTRY.map((e) => e.key).join("、");
}
