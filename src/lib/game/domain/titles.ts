import type { GameState } from "@/lib/game/domain/state";

/**
 * LLM 可通过 flag_delta 写入、供称号判定的约定键（勿随意改名）。
 * 完整键名、导演句与 UI「关系记忆」文案以 content/story-flags.ts 注册表为单一事实来源；此处仅列与称号强相关的子集：
 * - true_ending_hint (boolean) — 家访/真结局线暗示
 * - extremity_boundaries (boolean) — 叙事已越过师生底线（L4）
 * - agreed_weekend_tutor (boolean) — 约好周末补习/独处等剧情标记
 * - first_kiss_hint (boolean) — 叙事上初吻/首次越线关键节点
 */

export type TitleTier = 1 | 2 | 3 | 4;

export type TitleEntry = {
  id: string;
  name: string;
  tier: TitleTier;
  hint?: string;
  condition: (state: GameState) => boolean;
};

function userTurns(state: GameState): number {
  return state.history.filter((m) => m.role === "user").length;
}

export const TITLE_REGISTRY: readonly TitleEntry[] = [
  {
    id: "first_notice",
    name: "被注意到",
    tier: 1,
    hint: "好感稳步上升",
    condition: (s) => userTurns(s) >= 3 && s.affection >= 38,
  },
  {
    id: "heartbeat",
    name: "心动信号",
    tier: 1,
    hint: "好感进入心动阶段",
    condition: (s) => s.affection >= 56 && userTurns(s) >= 4,
  },
  {
    id: "trust_anchor",
    name: "愿意相信",
    tier: 1,
    hint: "信任积累到一定程度",
    condition: (s) => s.trust >= 55 && userTurns(s) >= 3,
  },
  {
    id: "distance_fades",
    name: "渐行渐远",
    tier: 2,
    hint: "信任与好感长期低迷",
    condition: (s) =>
      userTurns(s) >= 4 && s.trust <= 8 && s.affection <= 18,
  },
  {
    id: "classroom_ambiguity",
    name: "课堂上暧昧",
    tier: 2,
    hint: "仍在教室语境下把亲密与好感拉高",
    condition: (s) =>
      userTurns(s) >= 6 &&
      s.location.includes("教室") &&
      s.intimacy >= 45 &&
      s.affection >= 45,
  },
  {
    id: "heartbeat_lover",
    name: "恋人未满",
    tier: 2,
    hint: "关系文案进入恋人向",
    condition: (s) => /恋人|情人|伴侣/.test(s.relationship),
  },
  {
    id: "steady_bond",
    name: "默契加深",
    tier: 2,
    hint: "信任与亲密同步上升",
    condition: (s) =>
      userTurns(s) >= 6 &&
      s.trust >= 52 &&
      s.intimacy >= 42,
  },
  {
    id: "chapter_runner",
    name: "章节行者",
    tier: 2,
    hint: "剧情章节推进到中段之后",
    condition: (s) => s.chapter >= 4 && userTurns(s) >= 8,
  },
  {
    id: "mutual_addiction",
    name: "彼此沉溺",
    tier: 3,
    hint: "好感、亲密与欲望同时极高",
    condition: (s) =>
      s.affection >= 95 && s.intimacy >= 85 && s.desire >= 70,
  },
  {
    id: "after_home_visit",
    name: "家访之后",
    tier: 3,
    hint: "家访线与章节、好感到位",
    condition: (s) =>
      s.flags["true_ending_hint"] === true &&
      s.chapter >= 7 &&
      s.affection >= 80,
  },
  {
    id: "skin_memory",
    name: "指尖留温",
    tier: 3,
    hint: "亲密推近深层",
    condition: (s) => s.intimacy >= 72 && s.desire >= 55 && userTurns(s) >= 6,
  },
  {
    id: "desire_spike",
    name: "理智断线",
    tier: 3,
    hint: "欲望逼近上限",
    condition: (s) => s.desire >= 88 && s.nsfw_mode === true,
  },
  {
    id: "no_longer_same",
    name: "不再处女老师",
    tier: 3,
    hint: "成人叙事下亲密与欲望越过临界",
    condition: (s) =>
      s.nsfw_mode === true && s.intimacy >= 90 && s.desire >= 75,
  },
  {
    id: "office_afterhours",
    name: "办公室余温",
    tier: 3,
    hint: "在办公室语境里亲密不低",
    condition: (s) =>
      /办公室|教研室/.test(s.location) &&
      s.intimacy >= 40 &&
      userTurns(s) >= 5,
  },
  {
    id: "rope_walk",
    name: "钢丝上的微笑",
    tier: 3,
    hint: "高风险试探仍维持表面体面",
    condition: (s) =>
      userTurns(s) >= 8 &&
      s.trust >= 45 &&
      s.intimacy >= 50 &&
      s.affection >= 60,
  },
  {
    id: "after_class_minute",
    name: "放学两分钟",
    tier: 1,
    hint: "仍在教室语境里把好感养起来",
    condition: (s) =>
      userTurns(s) >= 5 &&
      s.location.includes("教室") &&
      s.affection >= 42 &&
      s.intimacy < 45,
  },
  {
    id: "wrong_problem_bind",
    name: "错题本之交",
    tier: 1,
    hint: "信任与好感都在稳步上来",
    condition: (s) =>
      userTurns(s) >= 5 &&
      s.trust >= 48 &&
      s.affection >= 44 &&
      s.affection < 56,
  },
  {
    id: "hallway_pause",
    name: "走廊停顿",
    tier: 2,
    hint: "在走廊/过道里把距离拉近",
    condition: (s) =>
      userTurns(s) >= 5 &&
      (/走廊|过道/.test(s.location) || s.location.includes("楼梯")) &&
      s.intimacy >= 36 &&
      s.affection >= 40,
  },
  {
    id: "empty_room_echo",
    name: "空教室回声",
    tier: 2,
    hint: "独处空间里的近距离",
    condition: (s) =>
      userTurns(s) >= 6 &&
      (/空教室|活动室|音乐|多功能/.test(s.location)) &&
      s.intimacy >= 40,
  },
  {
    id: "cold_war_thick",
    name: "僵持不降",
    tier: 2,
    hint: "冷战计数堆高时仍在推进剧情",
    condition: (s) =>
      userTurns(s) >= 6 &&
      s.cold_war_remaining >= 7,
  },
  {
    id: "coffee_break",
    name: "课间咖啡",
    tier: 2,
    hint: "咖啡或休息语境里的信任与好感",
    condition: (s) =>
      userTurns(s) >= 5 &&
      (/咖啡|休息室|茶水|咖啡厅/.test(s.location)) &&
      s.trust >= 46 &&
      s.affection >= 46,
  },
  {
    id: "exam_week",
    name: "测验周",
    tier: 2,
    hint: "章节靠后且关系仍在升温",
    condition: (s) =>
      s.chapter >= 5 &&
      s.affection >= 54 &&
      s.trust >= 50 &&
      userTurns(s) >= 10,
  },
  {
    id: "shy_on_record",
    name: "脸红有案",
    tier: 3,
    hint: "心情写在害羞或暧昧里",
    condition: (s) =>
      /害羞|羞涩|脸红|暧昧|紧张/.test(s.mood) &&
      s.intimacy >= 50 &&
      s.affection >= 58,
  },
  {
    id: "roof_wind",
    name: "天台见",
    tier: 3,
    hint: "天台语境下的亲密与欲望张力",
    condition: (s) =>
      s.location.includes("天台") &&
      s.intimacy >= 44 &&
      s.desire >= 44,
  },
  {
    id: "stairs_corner",
    name: "楼梯转角",
    tier: 3,
    hint: "楼梯/楼道里的擦身而过",
    condition: (s) =>
      (/楼梯|楼道|台阶/.test(s.location)) &&
      s.intimacy >= 46 &&
      userTurns(s) >= 7,
  },
  {
    id: "night_light",
    name: "台灯未熄",
    tier: 3,
    hint: "深夜时段仍放不下这段距离",
    condition: (s) =>
      s.time_slot === 5 &&
      s.intimacy >= 48 &&
      s.affection >= 56,
  },
  {
    id: "morning_gate",
    name: "校门清晨",
    tier: 3,
    hint: "清晨或上午到校阶段的好感积累",
    condition: (s) =>
      s.time_slot <= 1 &&
      s.calendar_day >= 5 &&
      s.affection >= 50 &&
      userTurns(s) >= 8,
  },
  {
    id: "weekend_gate",
    name: "周末之约",
    tier: 3,
    hint: "剧情标记 agreed_weekend_tutor",
    condition: (s) => s.flags["agreed_weekend_tutor"] === true,
  },
  {
    id: "paper_stack",
    name: "卷子堆成山",
    tier: 2,
    hint: "班主任语境里信任仍在",
    condition: (s) =>
      (/办公室|教研室|教务/.test(s.location)) &&
      s.trust >= 50 &&
      s.chapter >= 3 &&
      userTurns(s) >= 7,
  },
  {
    id: "twilight_edge",
    name: "暮色边缘",
    tier: 3,
    hint: "傍晚放学后心境与欲望一起升高",
    condition: (s) =>
      s.time_slot === 4 &&
      s.desire >= 62 &&
      s.intimacy >= 58 &&
      s.nsfw_mode === true,
  },
  {
    id: "borrowed_pen",
    name: "借你一支笔",
    tier: 1,
    hint: "信任与好感都在发芽",
    condition: (s) =>
      userTurns(s) >= 4 && s.trust >= 42 && s.affection >= 36,
  },
  {
    id: "library_whisper",
    name: "图书馆分贝",
    tier: 2,
    hint: "安静里仍能听见彼此呼吸",
    condition: (s) =>
      userTurns(s) >= 5 &&
      (/图书|阅览室|图书馆/.test(s.location)) &&
      s.intimacy >= 34 &&
      s.affection >= 40,
  },
  {
    id: "playground_lap",
    name: "操场多跑一圈",
    tier: 2,
    hint: "风把借口吹得很自然",
    condition: (s) =>
      s.location.includes("操场") &&
      s.affection >= 44 &&
      userTurns(s) >= 5,
  },
  {
    id: "ambiguous_named",
    name: "暧昧冠名",
    tier: 2,
    hint: "关系栏里终于出现那两个字",
    condition: (s) => /暧昧/.test(s.relationship),
  },
  {
    id: "rainy_mood",
    name: "雨天滤镜",
    tier: 2,
    hint: "心情与天气一起潮起来",
    condition: (s) =>
      /雨|阴天|潮湿|雷雨/.test(s.mood) &&
      s.affection >= 46 &&
      userTurns(s) >= 5,
  },
  {
    id: "thaw_after_frost",
    name: "解冻之后",
    tier: 2,
    hint: "冷战归零，信任还在",
    condition: (s) =>
      s.cold_war_remaining === 0 &&
      s.trust >= 58 &&
      s.affection >= 52 &&
      userTurns(s) >= 9,
  },
  {
    id: "two_weeks_in",
    name: "两周日记",
    tier: 2,
    hint: "日历翻过足够多页",
    condition: (s) =>
      s.calendar_day >= 14 &&
      s.affection >= 48 &&
      userTurns(s) >= 10,
  },
  {
    id: "deep_chapter",
    name: "章节深处",
    tier: 2,
    hint: "故事后半仍把你写在事件里",
    condition: (s) =>
      s.chapter >= 6 &&
      s.affection >= 56 &&
      userTurns(s) >= 12,
  },
  {
    id: "lunch_hour",
    name: "午休借口",
    tier: 2,
    hint: "中午那一小时不算课时",
    condition: (s) =>
      s.time_slot === 2 &&
      s.intimacy >= 38 &&
      s.affection >= 44 &&
      userTurns(s) >= 6,
  },
  {
    id: "glass_trust",
    name: "玻璃信任",
    tier: 2,
    hint: "嘴硬心软都在数字里",
    condition: (s) =>
      s.trust <= 28 &&
      s.affection >= 42 &&
      userTurns(s) >= 7,
  },
  {
    id: "tower_of_trust",
    name: "信任满格",
    tier: 2,
    hint: "她把后背都亮给你",
    condition: (s) => s.trust >= 92 && s.affection >= 68,
  },
  {
    id: "pg_deep_affection",
    name: "纯爱档深读",
    tier: 2,
    hint: "全年龄叙事里也能把心读穿",
    condition: (s) =>
      s.nsfw_mode === false &&
      s.affection >= 64 &&
      s.trust >= 58 &&
      userTurns(s) >= 8,
  },
  {
    id: "marathon_runner",
    name: "长线玩家",
    tier: 2,
    hint: "陪伴回合磨出真心",
    condition: (s) => userTurns(s) >= 22 && s.affection >= 50,
  },
  {
    id: "four_stat_balance",
    name: "四角均衡",
    tier: 3,
    hint: "好感信任亲密欲望都在线",
    condition: (s) =>
      s.affection >= 68 &&
      s.trust >= 68 &&
      s.intimacy >= 58 &&
      s.desire >= 52 &&
      userTurns(s) >= 10,
  },
  {
    id: "cool_mask",
    name: "冷淡假面",
    tier: 3,
    hint: "嘴上平静，剧情却不配合",
    condition: (s) =>
      /冷淡|克制|羞怒|审视|烦躁/.test(s.mood) &&
      s.intimacy >= 58 &&
      s.affection >= 62 &&
      userTurns(s) >= 8,
  },
  {
    id: "gate_at_dusk",
    name: "校门暮色",
    tier: 3,
    hint: "傍晚离校时人群里的偏爱",
    condition: (s) =>
      s.time_slot === 4 &&
      (/校|门口|门禁/.test(s.location)) &&
      s.affection >= 54 &&
      s.intimacy >= 46,
  },
  {
    id: "midnight_thirst",
    name: "子夜口渴",
    tier: 3,
    hint: "深夜欲望找不到无辜借口",
    condition: (s) =>
      s.nsfw_mode === true &&
      s.time_slot === 5 &&
      s.desire >= 72 &&
      s.intimacy >= 56,
  },
  {
    id: "first_kiss_gate",
    name: "初吻预备式",
    tier: 4,
    hint: "叙事标记 first_kiss_hint",
    condition: (s) => s.flags["first_kiss_hint"] === true,
  },
  {
    id: "forbidden_topic",
    name: "禁区课题",
    tier: 4,
    hint: "叙事标记 extremity_boundaries",
    condition: (s) => s.flags["extremity_boundaries"] === true,
  },
  {
    id: "deep_end",
    name: "沉溺底层",
    tier: 4,
    hint: "四项数值均处于极高区间",
    condition: (s) =>
      s.nsfw_mode === true &&
      s.affection >= 92 &&
      s.trust >= 85 &&
      s.intimacy >= 92 &&
      s.desire >= 88,
  },
];

export type TitleRowUi = {
  id: string;
  name: string;
  tier: TitleTier;
  unlocked: boolean;
  hint?: string;
  /** 称号短描述（悬浮、图鉴） */
  description: string;
  /** 人类可读的解锁条件说明 */
  conditionText: string;
};

/** 与 TITLE_REGISTRY id 一一对应，供 UI 展示描述与条件 */
const TITLE_UI_COPY: Record<
  string,
  { description: string; conditionText: string }
> = {
  first_notice: {
    description: "陈悦的目光开始在你背上多停半秒——你还不知道这意味着什么。",
    conditionText: "玩家回合≥3，且好感≥38。",
  },
  heartbeat: {
    description: "心跳漏拍的那一刻，教室的粉笔灰都像变慢了。",
    conditionText: "好感≥56，且玩家回合≥4。",
  },
  trust_anchor: {
    description: "她把最难堪的错题也摊在你面前，信任有了重量。",
    conditionText: "信任≥55，且玩家回合≥3。",
  },
  distance_fades: {
    description: "走廊里擦肩都像刻意回避，话题只剩作业与分数。",
    conditionText: "玩家回合≥4，且信任≤8、好感≤18。",
  },
  classroom_ambiguity: {
    description: "讲台与课桌之间，空气里多了不必点破的东西。",
    conditionText: "地点含「教室」，玩家回合≥6，亲密≥45，好感≥45。",
  },
  heartbeat_lover: {
    description: "称呼与距离都已越界，只差一句捅破窗户纸的话。",
    conditionText: "关系字段含「恋人」「情人」或「伴侣」。",
  },
  steady_bond: {
    description: "不必说话也能接上下半句——你们有了秘密的默契。",
    conditionText: "玩家回合≥6，信任≥52，亲密≥42。",
  },
  chapter_runner: {
    description: "章节翻页时，她的故事也开始绕着你转。",
    conditionText: "章节≥4，且玩家回合≥8。",
  },
  mutual_addiction: {
    description: "彼此都知道再退一步就安全，却谁都不先松手。",
    conditionText: "好感≥95，亲密≥85，欲望≥70。",
  },
  after_home_visit: {
    description: "家访的门在身后合上，界线从那一声锁响开始改写。",
    conditionText: "标记 true_ending_hint 为真，章节≥7，好感≥80。",
  },
  skin_memory: {
    description: "触碰像余温，散场了也还在皮肤上。",
    conditionText: "亲密≥72，欲望≥55，玩家回合≥6。",
  },
  desire_spike: {
    description: "理智的弦绷到极限，再多一寸就会出声。",
    conditionText: "成人叙事开启（NSFW），且欲望≥88。",
  },
  no_longer_same: {
    description: "师生之名仍在耳边，身体却只记得另一种语法。",
    conditionText: "成人叙事开启，亲密≥90，欲望≥75。",
  },
  office_afterhours: {
    description: "办公室里只剩台灯与纸张声，谁也装不了碰巧路过。",
    conditionText: "地点含「办公室」或「教研室」，亲密≥40，玩家回合≥5。",
  },
  rope_walk: {
    description: "每一步都像踩在钢丝上笑，台下却是万丈深渊。",
    conditionText: "玩家回合≥8，信任≥45，亲密≥50，好感≥60。",
  },
  after_class_minute: {
    description: "放学铃后的两分钟，教室只剩你们与尘埃在光里。",
    conditionText: "地点含「教室」，玩家回合≥5，好感≥42，亲密＜45。",
  },
  wrong_problem_bind: {
    description: "橡皮与红笔蹭过同一页纸，错题也成了借口。",
    conditionText: "玩家回合≥5，信任≥48，好感在 44～55 之间。",
  },
  hallway_pause: {
    description: "走廊的人流里突然驻足——那一秒对视很长。",
    conditionText:
      "地点含「走廊」「过道」或「楼梯」，玩家回合≥5，亲密≥36，好感≥40。",
  },
  empty_room_echo: {
    description: "空荡教室里回响的不止是脚步，还有压低的呼吸。",
    conditionText: "地点含「空教室」「活动室」「音乐」或「多功能」，玩家回合≥6，亲密≥40。",
  },
  cold_war_thick: {
    description: "冷战像湿毛巾裹住脸，越想呼吸越烫。",
    conditionText: "冷战剩余回合≥7，且玩家回合≥6。",
  },
  coffee_break: {
    description: "纸杯沿上同一侧的唇印，谁也没说破。",
    conditionText:
      "地点含「咖啡」「休息室」「茶水」或「咖啡厅」，玩家回合≥5，信任≥46，好感≥46。",
  },
  exam_week: {
    description: "测验周的紧张里，她把唯一泄压的缝隙留给你。",
    conditionText: "章节≥5，好感≥54，信任≥50，玩家回合≥10。",
  },
  shy_on_record: {
    description: "心情写在脸上，教案都遮不住那一截红。",
    conditionText:
      "心情含「害羞」「羞涩」「脸红」「暧昧」或「紧张」，亲密≥50，好感≥58。",
  },
  roof_wind: {
    description: "天台的风把话都吹碎，只剩衣角猎猎如心跳。",
    conditionText: "地点含「天台」，亲密≥44，欲望≥44。",
  },
  stairs_corner: {
    description: "台阶错身时袖口相擦，比拥抱还响。",
    conditionText: "地点含「楼梯」「楼道」或「台阶」，玩家回合≥7，亲密≥46。",
  },
  night_light: {
    description: "夜深了，台灯下的人还在等一条不会来的已读。",
    conditionText: "系统时段为「晚上」（time_slot=5），亲密≥48，好感≥56。",
  },
  morning_gate: {
    description: "校门口晨光里，她把「老师」二字叫得格外轻。",
    conditionText: "时段为清晨或上午，游戏内第≥5 天，好感≥50，玩家回合≥8。",
  },
  weekend_gate: {
    description: "周末不在课表上，却被写进两个人的默契里。",
    conditionText: "剧情通过 flag_delta 写入 agreed_weekend_tutor: true。",
  },
  paper_stack: {
    description: "卷子堆成山，她仍从山顶先看见你。",
    conditionText:
      "地点含「办公室」「教研室」或「教务」，信任≥50，章节≥3，玩家回合≥7。",
  },
  twilight_edge: {
    description: "暮色把五官磨得柔和，也把欲望磨得锋利。",
    conditionText: "时段为傍晚，欲望≥62，亲密≥58，且为成人叙事。",
  },
  borrowed_pen: {
    description: "一支笔递过去，顺带递出去半天的借口。",
    conditionText: "玩家回合≥4，信任≥42，好感≥36。",
  },
  library_whisper: {
    description: "书架隔开了世界，只留下两个人的分贝。",
    conditionText:
      "地点含「图书」「阅览室」或「图书馆」，玩家回合≥5，亲密≥34，好感≥40。",
  },
  playground_lap: {
    description: "跑道多一圈，心率可以用「锻炼」糊弄过去。",
    conditionText: "地点含「操场」，好感≥44，玩家回合≥5。",
  },
  ambiguous_named: {
    description: "关系那一栏写着暧昧——像盖章，又像留白。",
    conditionText: "关系字段含有「暧昧」。",
  },
  rainy_mood: {
    description: "天气把心事淋湿，雨伞下的距离刚好够犯规。",
    conditionText:
      "心情含「雨」「阴天」「潮湿」或「雷雨」，好感≥46，玩家回合≥5。",
  },
  thaw_after_frost: {
    description: "冷战退场，热气回到对话里，假装刚才没僵持过。",
    conditionText:
      "冷战剩余为 0，信任≥58，好感≥52，玩家回合≥9。",
  },
  two_weeks_in: {
    description: "两周后的日历折角，折的都是同一个人的名字。",
    conditionText: "游戏内天数≥14，好感≥48，玩家回合≥10。",
  },
  deep_chapter: {
    description: "后半程章节里，路人退场，只剩你们还在剧情里。",
    conditionText: "章节≥6，好感≥56，玩家回合≥12。",
  },
  lunch_hour: {
    description: "午休铃像赦免令，食堂与天台都成了合法外遇。",
    conditionText:
      "系统时段为中午（time_slot=2），亲密≥38，好感≥44，玩家回合≥6。",
  },
  glass_trust: {
    description: "信任数值薄得像玻璃，好感却又烫手——别扭得刚好。",
    conditionText: "信任≤28，好感≥42，玩家回合≥7。",
  },
  tower_of_trust: {
    description: "她把最难开的口都信任给你接。",
    conditionText: "信任≥92，且好感≥68。",
  },
  pg_deep_affection: {
    description: "全年龄叙事里照样能把心动写满纸页。",
    conditionText:
      "关闭成人叙事（全年龄），好感≥64，信任≥58，玩家回合≥8。",
  },
  marathon_runner: {
    description: "长线陪伴本身，就是一种告白。",
    conditionText: "玩家回合≥22，且好感≥50。",
  },
  four_stat_balance: {
    description: "四条曲线一起抬头时，谁也骗不了谁。",
    conditionText:
      "好感≥68、信任≥68、亲密≥58、欲望≥52，且玩家回合≥10。",
  },
  cool_mask: {
    description: "语气越平静，底下越沸腾——她擅长这种反差。",
    conditionText:
      "心情含「冷淡」「克制」「羞怒」「审视」或「烦躁」，亲密≥58，好感≥62，玩家回合≥8。",
  },
  gate_at_dusk: {
    description: "校门把人潮筛成背景，只留下你们擦肩而过时的停顿。",
    conditionText:
      "时段为傍晚，地点含「校」「门口」或「门禁」，好感≥54，亲密≥46。",
  },
  midnight_thirst: {
    description: "夜深了，欲望不必解释成别的情绪。",
    conditionText:
      "成人叙事开启，时段为晚上，欲望≥72，亲密≥56。",
  },
  first_kiss_gate: {
    description: "再往前一寸，叙事就要给「第一次」记账了。",
    conditionText: "剧情通过 flag_delta 写入 first_kiss_hint: true。",
  },
  forbidden_topic: {
    description: "课堂上不能讲的内容，你们在别处讲完。",
    conditionText: "剧情通过 flag_delta 写入 extremity_boundaries: true。",
  },
  deep_end: {
    description: "四面数字都涨到顶格，只剩本能还叫得出对方名字。",
    conditionText:
      "成人叙事下，好感≥92、信任≥85、亲密≥92、欲望≥88 同时满足。",
  },
};

function uiCopyFor(id: string): { description: string; conditionText: string } {
  const c = TITLE_UI_COPY[id];
  if (c) return c;
  return {
    description: "（暂无简介）",
    conditionText: "参见游戏内数值与剧情标记。",
  };
}

/** 解锁新称号 id，返回本帧新解锁的展示名列表 */
export function unlockNewTitles(state: GameState): string[] {
  const seen = new Set(state.unlocked_title_ids);
  const newly: string[] = [];
  for (const t of TITLE_REGISTRY) {
    if (seen.has(t.id)) continue;
    if (t.condition(state)) {
      state.unlocked_title_ids.push(t.id);
      seen.add(t.id);
      newly.push(t.name);
    }
  }
  return newly;
}

export function titleRowsForUi(unlockedIds: readonly string[]): TitleRowUi[] {
  const set = new Set(unlockedIds);
  return TITLE_REGISTRY.map((t) => {
    const copy = uiCopyFor(t.id);
    return {
      id: t.id,
      name: t.name,
      tier: t.tier,
      unlocked: set.has(t.id),
      hint: t.hint,
      description: copy.description,
      conditionText: copy.conditionText,
    };
  });
}
