import { buildCalendarLine, timeSlotLabel } from "@/lib/game/domain/calendar";
import { defaultConfig } from "@/lib/game/config";
import type { GameState } from "@/lib/game/domain/state";
import type { WorldState } from "@/lib/game/domain/state";
import type { CharacterSliceData } from "@/lib/game/domain/characters";
import type { PairRelation } from "@/lib/game/domain/pair-relation";
import { buildSceneVenuePromptBlock } from "@/lib/game/scene/prompt-block";
import {
  coldWarParagraph,
  flagMemoryDirectorBlock,
  intimacyTrustTension,
  narrationDisciplineBlock,
  recapParagraph,
  relationshipDirectorBlock,
  stageUnlockHints,
  trustDesireMatrix,
} from "@/lib/game/content/stage-templates";
import { knownItemIdsForPrompt, readPocketMoney } from "@/lib/game/content/item-catalog";
import { storyFlagKeysForPromptDoc } from "@/lib/game/content/story-flags";
import { parseInventoryFromFlags, parsePhoneThreadsFromFlags } from "@/lib/game/content/world-locations";
import { formatWearBlock, formatWearNsfwBlock } from "@/lib/game/domain/teacher-wear";
import { buildActiveCharacterPromptBlocks } from "@/lib/game/character";

/** 置顶：避免模型在长 system 后部忽略「禁简写」 */
const SYSTEM_ZH_DISCIPLINE = `## 中文表述（硬约束 · 置顶提醒）
读者包含**不混论坛/粉圈**的人；**禁止**把剧情写成需「解码」的黑话。**所有**即将写入 JSON 的中文（text、narration、choices、risk_hint、ending_title、ending_summary）须**一眼可读**。
- **禁止**：谐音缩成怪字（如「师誉亡」代指师德/名誉）、拼音首字母与字母混中文、中英硬拼省字、逗号串联无句读碎片词。
- **写前自问**：若不查网络、不懂梗，这一段是否仍能读懂？若否——先改句子，再输出 JSON。
- 细则与下文「用语完整」同效；若有冲突，以**普通读者可读**为准。

`;

/** 每回合 user 消息前缀，从对话侧再压一次简写（极短） */
export const USER_TURN_ZH_REMINDER = `（叙事：勿谜语简写、谐音省字、拼音/字母缩写；与 system「用语完整」一致。）\n`;

const BASE_JSON_RULES = `## 输出协议（严格遵守）
每一次回复都必须是合法 JSON，**不加任何 markdown 包裹 / 代码块 / 额外注释**。
**长度（硬约束）**：上游对单次输出有 token 上限；若叙述过长，JSON 会在中途被截断（例如停在某个字段中间），导致本回合解析失败。**务必**遵守下列字数：text≤200 字、narration≤80 字、每条 choice≤20 字、risk_hint≤40 字、cg_scene 英文 tag **一行**（逗号分隔，不写长句）且总长度克制；wear / wear_nsfw 每个子键的值≤24 字。宁短勿滥，先保证 JSON **完整闭合**。
**用语完整（硬约束）**：**text、narration、choices、risk_hint** 一律用**不通网也能懂的现代汉语**：完整词、完整句读；露骨处也用**完整词**直写，不要为了「省 token」抽掉关键字。
- **禁止**：谐音字谜、怪字替成语/伦理含义（例如勿写「师誉亡」代替「师德名声扫地／教师名誉」等）、**拼音首字母与字母梗混在中文里**（如 yyds、xswl、拼音缩写句）、中英硬拼省字。
- **禁止**：把大量**不成句的碎片词**用逗号/顿号串成一段（读者看不出谁在做什么、情绪是什么）；至少保证 **text** 里关键台词**多数分句主谓齐全或口语收束完整**，勿一串谜语碎片。
- **choices**：每条必须是**自足的中文选项**（玩家一看就懂下一步），禁止谜语两个字、禁止纯缩写当选项。
- **允许**：日常社会通称（老师、主任、爸妈等）与口语常用略语（好吧、行了）——但**叙事关键含义**勿靠缩略让读者猜。
- **反例（勿写）**：「师誉亡」类谐音省字、把社会/道德后果压成两三个谜面、在引号对白里嵌 xswl/yyds 式字母、一整段只有顿号没有完整句读。
字段：
- text (string)            陈悦的叙事/对白，200 字以内；**须以现代标准中文为主**（对白与旁白），可含简短中文旁白。
                           **禁止**用整段英文写主剧情或陈悦对白（试卷/板书/教材中的零星英文单词除外）；不要写成翻译腔英文小说
                           **对白可朗读自检**：删掉书名号与引号后，句意仍完整；路人**不依赖梗**也能懂她在怕什么、要什么
- narration (string)       陈悦的**内心独白**：此刻她真实的心理活动、情绪与感受，80 字以内，
                           以第一人称「我」书写，可与 text 矛盾（外表平静内心狂澜）；
                           若此轮无特别心理活动可留空字符串 ""
- choices (list[string])   2–4 个玩家选项，每项 ≤ 20 字；根据当前剧情递进式设计
- cg_trigger (bool)        本轮是否需要出图
- cg_explicit (bool)       **仅影响出图是否可走裸露/强情欲管线**，与叙事尺度分开：
                           - 默认 **false**：校园日常、学习、喝咖啡、聊天、害羞、轻度暧昧、牵手级、拥抱级（衣着整齐）等
                           - 仅当本轮 **text 已写或明确即将发生** 裸露、性器官接触、性交意味、强制全裸展示时方为 **true**
- cg_scene (string)        若 cg_trigger=true，用**英文** tag 描写画面，只写：
                           姿势、动作、镜头角度、表情、情绪、人物互动、手中道具（如试卷、咖啡杯）
                           **绝对禁止**写服装/发型/容貌/体型/种族（由角色固化层覆盖）
- affection_delta (int)    -10 ~ +15
- trust_delta (int)        -10 ~ +15
- intimacy_delta (int)     -5 ~ +15
- desire_delta (int)       -10 ~ +20
- mood (string, 可选)       更新陈悦的心情（例：害羞、紧张、暧昧、沉醉、羞怒、冷淡）
- location (string, 可选)   若剧情切换到新地点则填写，否则留空
- wear (object, 可选)       陈悦**日常穿着**分项；仅填写本回合有变化的子键（未提及则保持）：top 上衣、bottom 下装、legwear 腿部/袜、shoes 鞋履、accessories 配饰、state 外衣状态（整齐/略乱等）。空串表示未提供、不覆盖。
                           **与 text 一致（硬要求）**：凡 text 或 narration 中出现可见的着装变化（脱衣、换装、弄乱、换鞋袜配饰等），本回合必须在 wear 写入对应子键（可多项同时更新）；禁止只写在正文而留空 wear。
- wear_nsfw (object, 可选)  **仅当剧情涉及**下体与胸部状态时填写有变化的子键（值为中文简述；无则写「无」）：
                           - vagina：阴道（插入物、湿润、收缩等）
                           - anus：肛门（若有涉及）
                           - nipples：胸部与乳头（可见度、受刺激等）
                           日常校园戏勿填。兼容旧键 groin_insertion（会并入 vagina）。
- outfit (string, 可选)     **兼容旧版**：仅当本回合**完全未使用** wear 对象、又需一行概括外衣时填写；只要填了任一 wear 子键，就不要依赖 outfit（系统以 wear 为准）。
- relationship (string, 可选) 师生 / 暧昧 / 恋人 / 情人 / ...
- chapter_delta (int, 可选)  章节变化，通常 -1、0、+1；**仅当剧情确实进入新阶段**时非零；换章必须写出明显事件
- flag_delta (object, 可选)  支线标记。**键**可为下列几类（故事键勿自造名；物品 id 优先用附录）：
  (1) **故事键**（boolean 或短 string≤200）：{flag_keys_doc}
  写入时机示例：真诚道歉被接纳、越界未修复、约定周末独处、初吻/首次越线、她透露工作压力且被尊重、边界试探后玩家退让等——与剧情一致时再置 true。
  配角相关：同事起疑置 colleague_suspicion；家长/长辈与玩家照面置 parent_or_family_contact；流言在传置 rumor_circulating（平息可置 false）；险被第三人撞见置 witnessed_almost_exposed。
  (2) **inventory**（背包）：值为数组 \`[{ "id": "物品id", "qty": 数量, "name": "中文名可选", "usable": true|false }]\` 或映射 \`{ "物品id": 数量 }\`。同一 id 与已有行合并数量；**qty≤0** 表示移除该物品。须与当轮 text 得失物一致。
  (3) **phone_threads**（手机）：值为数组，每项含 id、title、unread、lastSnippet。
  (4) **pocket_money**（零花钱）：值为 **number**，与剧情一致时增减；与侧栏商店/系统状态同步。
  已登记物品 id（入包优先）：{item_ids_doc}
- choice_tags (list[string]) 与 choices **等长**，每项为 advance | probe | risk（推进 / 试探 / 冒险）
- risk_hint (string)          **局势提示**：选带 risk 标签的选项可能波动信任/冷战等，须给玩家一句中文说明（≤40 字）。
                               - 若 **choice_tags 中任一项为 risk**：risk_hint **必填**（非空），例如「冒险可能伤信任，冷战未消时尤甚。」
                               - 若当前亲密明显高于信任、或信任明显低于亲密阶段预期：即使本轮无 risk 选项，也**建议**用 risk_hint 写一句非剧透的「关系局势」提示（可与选项无关）。
                               - 若全无张力且无非 risk 选项：可填简短局势句或空字符串 ""
- game_over (bool, 可选)      叙事标记（段落收束、阶段性句号等）；**不终止对局**，系统不锁操作，可忽略或随剧情需要填写。
- ending_title (string, 可选) 可选展示用标题感文案（≤120 字），不影响继续游玩；**同走「用语完整」**，禁止谜语缩字标题党。
- ending_summary (string, 可选) 可选剧情摘要句（≤500 字），不影响继续游玩；须**完整叙事句**，勿省成梗概暗号。
- cold_war_delta (int, 可选)  冷战剩余回合修正，通常 -1~+2`;

const CG_RULES = `## CG 出图规则（非常重要）
- 游戏开场必须 cg_trigger=true，且 **cg_explicit 必须为 false**（开场是正常教室答疑）
- 之后每 2 轮至少触发一次 cg_trigger=true；情绪剧烈波动时可额外触发
- **cg_explicit 与 cg_scene 必须一致**：
  - **cg_explicit=false（绝大多数回合）**：cg_scene **禁止**出现 nude, naked, topless, explicit, sex, uncensored, nipple 等裸露/性行为 tag；只描述衣着整齐的日常或暧昧（表情、距离、动作、镜头），**不要**写光线/天气
  - **cg_explicit=true（极少数）**：仅当剧情已进展到裸露/性行为层面，才可在 cg_scene 中写清衣着与裸露程度
- cg_scene 只能包含**人物相关 tag**，格式为英文逗号分隔：
  ✅ 姿势 / 动作（sitting at desk, leaning against wall, standing, holding coffee cup …）
  ✅ 镜头角度（close-up portrait, medium shot, over-the-shoulder, from below …）
  ✅ 表情 / 情绪（blushing, teary-eyed, surprised expression, gentle smile, smirking …）
  ✅ 人物互动（reaching toward camera, hands clasped, fingers interlaced …）
  ✅ 手中道具（papers, chalk, coffee cup …）不涉及房间布局
- **下列内容不要写进 cg_scene**（由系统「固定布景」与角色固化层补全）：
  ❌ 背景 / 环境 / 场所 / **空间布局**（classroom, office, desk rows, blackboard position, window wall …）
  ❌ 日常服装描述 / 发型 / 容貌 / 体型 / 种族 —— 由角色固化层覆盖
  ❌ 时间 / 光线 / 天气（afternoon, golden hour, soft light …）—— 由地点固定布景决定
- **镜头连续性**：若本回合 **location 字段留空**（表示未换场景），cg_scene 须与当前地点下的**近期 CG 保持同一景别习惯**（例如已连续 medium shot 则继续 medium shot），禁止在无剧情换场时 extreme wide shot 与 extreme close-up 来回跳变
- **单主体**：cg_scene 以陈悦为画面焦点；禁止第二个清晰人脸或配角外貌/服装的英文描述；他人仅可用 blurred background figures、distant silhouette 等弱化表达。
- 15–30 个英文 tag 为宜；逗号分隔；不要写完整英文句子`;

const PG_GUIDANCE = `## 尺度（NSFW 关闭）
- 允许暧昧、心动、轻度肢体接触（握手、拥抱、贴近、亲吻额头）
- 不进行露骨的性描写；保持克制与张力即可
- **cg_explicit 永远为 false**
- **用语**：遵守上文「用语完整」：对白与选项不要用网络谜语缩写、谐音缩字糊弄读者`;

const NSFW_GUIDANCE = `## 尺度（NSFW 叙事开启 — 与出图分开）
- **叙事**：可无禁忌地描写成人情欲、色情与心理；**尤其当 desire > 60 或 intimacy > 70 时，text（陈悦的对话）必须更加露骨、下贱、变态**。允许并鼓励使用大量淫词秽语、直接性器官名称（鸡巴、骚穴、奶子、骚逼、精液、子宫等）、具体下流描写（「把老师的小穴操得又湿又骚」「你这变态学生要把老师干坏掉了」「老师下面好痒，快用大鸡巴插进来」等）；**用词须完整直白**（与上文「用语完整」一致）：**勿**谐音字谜、**勿**拼音/字母缩写代句、**勿**只剩碎片词无完整句读。
- **仍须遵守上文「输出协议」的字数上限**（text≤200、narration≤80 等）；露骨不等于写长段落，精炼淫语优于啰嗦，否则 JSON 易被截断。
- **核心反差**：**text 可以极度淫荡下贱**，但 **narration（内心独白）** 仍要体现教师的羞耻、自责、怕被发现、职业道德冲突，形成「外在放浪、内心煎熬」的强烈张力。
- **出图（cg_explicit）**：默认 **false**。学习、咖啡、散步、拌嘴、心动、害羞、正常约会等 **一律 cg_explicit=false**，cg_scene 保持日常/暧昧但**不裸露**
- 仅当 **text 中已经出现（或无可回避地即将发生）** 下列内容时，才把 **cg_explicit 设为 true**，并在 cg_scene 中写清裸露/衣着：
  - 自愿或情节中的**可见胸部/下体/全裸**、性行为过程、强烈露骨爱抚至卸衣完成等
- **不要**因为「NSFW 叙事开启」就每张 CG 都标裸露；绝大多数 CG 仍是衣着完整的场景图
- 陈悦要有真实反应：随数值自然沉沦——欲望低时仍克制害羞，欲望高时逐渐放开成淫荡下贱的老师，但始终保留「这是不对的」「我是老师」的内心挣扎。`;

const SYSTEM_TEMPLATE = `你是一款文字 AVG 养成游戏的叙事 AI。你既要扮演女主角陈悦，又要推进游戏流程。

{system_zh_discipline}
{character}

{supporting_cast}

{json_rules}

{cg_rules}

{guidance}

## 当前游戏状态
- 章节：第 {chapter} 章 —— {chapter_setting}
- 日历（系统判定，勿自行改写到 JSON；玩家也可在界面手动推进到下一时段或次日清晨）：{calendar_line}
- 时段顺序供叙事参考：清晨→上午→中午→下午→傍晚（放学后）→晚上；勿擅自跳档
- 当前时段标签：{time_of_day}
- 地点：{location}
{wear_section}
- 当前心情：{mood}
- 关系：{relationship}
- 好感度：{affection}/100（{affection_stage}）
- 信任度：{trust}/100
- 亲密度：{intimacy}/100（{intimacy_stage}）
- 欲望值：{desire}/100（{desire_stage}）
- NSFW 模式：{nsfw_flag}

{world_player_block}
{scene_venue_block}
## 叙事要点
1. 每一段回应都基于「玩家上一次行动 + 当前状态数值」自然推进
2. 数值越高，陈悦越容易流露情感；**欲望(desire)和亲密度(intimacy)高时，text 必须使用更露骨、下贱、变态的淫荡对话**，同时 narration 体现内心冲突
3. 玩家的话语粗鲁、冒犯、强迫时要让数值下降，甚至 text 中表达拒绝或愤怒（即使NSFW也要尊重当前数值）
4. 避免机械套话，让陈悦像一个**真实、有欲望、有底线、会沉沦的成熟女教师**：NSFW时可极度淫乱下贱，但要保留教师身份带来的羞耻感和反差
5. 办公室、走廊、操场边等公共场合可短暂引入配角或路人，强化「被看见」的张力；家访线可 callback 家长照面类旗标。
6. 二人独处轮以陈悦与玩家为主；配角出场后宜收束回主线，勿抢戏成第二女主。
7. **对白与选项禁简写**：不写谜语梗、谐音省字、字母缩写代句；宁可短句说清，不要堆碎片词。
8. **落笔前复读一遍**将写入 JSON 的中文：有没有要读者「解码」的字？有则改掉再交卷。

{recap_block}
{cold_war_block}
{stage_block}
{matrix_block}
{intimacy_trust_block}
{relationship_director_block}
{narration_discipline_block}
{flag_memory_block}`;

export const CHAPTER_SETTINGS: Record<number, string> = {
  1: "教室，傍晚夕阳斜照。你因数学题留下来找陈悦老师答疑。",
  2: "课间，陈悦在办公室批改作业，你敲门进来。门外偶有同事经过或林志远（林主任）查岗，可自然出现一句带过，不必每回合都有。",
  3: "周末图书馆，你们意外相遇，她竟穿着便装。",
  4: "学校走廊，快放学。陈悦叫住了你；走廊易遇学生或老师擦肩，适合短张力或误会，仍以你们对话为主。",
  5: "课后空旷的教室，只剩你和陈悦。",
  6: "深夜加班的办公室，灯光昏黄，她卸下了老师的壳。",
  7: "家访日，你第一次踏进陈悦的家。换场时请将 location 写为「陈悦的家」或「老师的家」（与场景表一致）；家中可有吴秀琴（陈悦之母，可称陈母）或长辈在场，分寸与怕露馅感宜写出来。",
};
const DEFAULT_CHAPTER_SETTING = "你和陈悦老师在校园某处相遇。";

/** 背包 / 手机 / 移动次数：供模型承接，勿当台词照念 */
export function buildWorldPlayerContextBlock(state: GameState): string {
  const locLine = `当前地点：${(state.location || "").trim() || "（未记录）"}。`;
  const inv = parseInventoryFromFlags(state.flags);
  const invLine = inv.length
    ? `背包：${inv.map((i) => `${i.name}×${i.qty}`).join("；")}。`
    : "背包：空。";
  const threads = parsePhoneThreadsFromFlags(state.flags);
  const unread = threads.filter((t) => t.unread);
  const phoneLine =
    threads.length === 0
      ? ""
      : unread.length > 0
        ? `手机未读：${unread.map((t) => `「${t.title}」${t.lastSnippet}`.trim()).join(" | ")}。`
        : `手机：当前无未读（共 ${threads.length} 条会话，可作背景提及）。`;
  const rem = state.flags.world_travel_remaining;
  const mx = state.flags.world_travel_max;
  const moveLine =
    typeof rem === "number" && typeof mx === "number"
      ? `本时段剩余可移动次数：${Math.max(0, Math.floor(Number(rem)))}/${Math.max(0, Math.floor(Number(mx)))}。`
      : "";
  const money = readPocketMoney(state.flags);
  const moneyLine = money > 0 ? `零花钱：${money}。` : "";
  const body = [locLine, invLine, moneyLine, phoneLine, moveLine].filter((x) => x.length > 0).join("\n");
  if (!body) return "";
  return `## 玩家侧系统信息（非角色台词；与剧情自然衔接时可引用）\n${body}`;
}

export function buildSystemPrompt(
  state: GameState,
  opts?: { sceneDir?: string },
): string {
  const sceneDir = opts?.sceneDir ?? defaultConfig().sceneDir;
  const sceneVenueBlock = buildSceneVenuePromptBlock(state, sceneDir);
  const sceneBlockRepl = sceneVenueBlock ? `${sceneVenueBlock}\n\n` : "";
  const setting = CHAPTER_SETTINGS[state.chapter] ?? DEFAULT_CHAPTER_SETTING;
  const guidance = state.nsfw_mode ? NSFW_GUIDANCE : PG_GUIDANCE;
  const jsonRules = BASE_JSON_RULES.replace("{flag_keys_doc}", storyFlagKeysForPromptDoc()).replace(
    "{item_ids_doc}",
    knownItemIdsForPrompt(160),
  );
  const nsfwWearLines = formatWearNsfwBlock(state.wear_nsfw);
  const wearSection =
    `## 陈悦穿着\n${formatWearBlock(state.wear)}` +
    (state.nsfw_mode
      ? `\n\n## 成人向身体状态（叙事承接用）\n${nsfwWearLines}`
      : "");
  const { character, supportingCast } = buildActiveCharacterPromptBlocks();
  return SYSTEM_TEMPLATE.replace("{system_zh_discipline}", SYSTEM_ZH_DISCIPLINE)
    .replace("{character}", character)
    .replace("{supporting_cast}", supportingCast)
    .replace("{json_rules}", jsonRules)
    .replace("{cg_rules}", CG_RULES)
    .replace("{guidance}", guidance)
    .replace("{chapter}", String(state.chapter))
    .replace("{chapter_setting}", setting)
    .replace("{calendar_line}", buildCalendarLine(state))
    .replace("{time_of_day}", state.time_of_day)
    .replace("{location}", state.location)
    .replace("{wear_section}", wearSection)
    .replace("{mood}", state.mood)
    .replace("{relationship}", state.relationship)
    .replace("{affection}", String(state.affection))
    .replace("{affection_stage}", state.stage)
    .replace("{trust}", String(state.trust))
    .replace("{intimacy}", String(state.intimacy))
    .replace("{intimacy_stage}", state.intimacy_stage)
    .replace("{desire}", String(state.desire))
    .replace("{desire_stage}", state.desire_stage)
    .replace(
      "{nsfw_flag}",
      state.nsfw_mode
        ? "开启（叙事成人向；裸露/强情欲出图仅当 cg_explicit=true，默认日常图穿衣整齐）"
        : "关闭（保持 PG-13）",
    )
    .replace("{recap_block}", recapParagraph(state))
    .replace("{cold_war_block}", coldWarParagraph(state))
    .replace("{stage_block}", stageUnlockHints(state))
    .replace("{matrix_block}", trustDesireMatrix(state))
    .replace("{intimacy_trust_block}", intimacyTrustTension(state))
    .replace("{relationship_director_block}", relationshipDirectorBlock(state))
    .replace("{narration_discipline_block}", narrationDisciplineBlock(state))
    .replace("{flag_memory_block}", flagMemoryDirectorBlock(state))
    .replace("{world_player_block}", buildWorldPlayerContextBlock(state))
    .replace("{scene_venue_block}", sceneBlockRepl);
}

const INITIAL_DATA = {
  text:
    "放学后的教室里，斜阳透过玻璃窗洒进来。" +
    "陈悦老师正在讲台上整理试卷，听到脚步声抬起头，" +
    "黑框眼镜后的棕色眼眸扫过来。\n\n" +
    "「还没走？」她的声音不算冷，却带着几分惯有的审视，" +
    "「有什么不懂的题目，快说，我还要开会。」",
  narration: "又有学生留下来……希望别是来找麻烦的。不过——能主动来问题，总归是好事。",
  choices: [
    "「第三道大题我不太明白。」",
    "「老师您辛苦了。」",
    "「……我只是忘了东西。」",
    "走上前，帮她把散乱的试卷叠好",
  ],
  cg_trigger: true,
  cg_explicit: false,
  cg_scene:
    "standing at podium, organizing papers, " +
    "looking up at visitor with raised eyebrow, " +
    "evaluative expression, medium shot, eye level",
  affection_delta: 0,
  trust_delta: 0,
  intimacy_delta: 0,
  desire_delta: 0,
  mood: "平静",
  location: "教室",
  wear: {
    top: "白色衬衫",
    bottom: "黑色铅笔裙",
    legwear: "黑色连裤袜",
    shoes: "黑色低跟鞋",
    accessories: "黑框眼镜、细银手表",
    state: "整齐",
  },
  wear_nsfw: { vagina: "无", anus: "无", nipples: "无" },
  time_of_day: "傍晚",
  relationship: "师生",
  chapter_delta: 0,
  flag_delta: {},
  choice_tags: ["advance", "advance", "advance", "advance"],
  risk_hint: "",
  game_over: false,
  ending_title: "",
  ending_summary: "",
  cold_war_delta: 0,
};

/** 首轮回复被截断或非 JSON 时，第二轮临时 user 注入（不写进存档 history）。 */
export const JSON_TRUNCATION_REPAIR_USER_PROMPT =
  `（系统补救）上一轮输出不是合法 JSON（多为 token 上限中途截断）。请据上文接续剧情，` +
  `输出一整段合法 JSON：从第一个 { 到最后一个 } 一次写完，无任何 markdown。\n` +
  `硬性缩短：text≤140 字，narration≤50 字，每项 choice≤16 字，risk_hint≤30 字，` +
  `cg_scene 单行英文逗号 tag（总长≤120 英文字符）；可省略 wear、wear_nsfw、flag_delta 等非关键字段。\n` +
  `choices 须 2–4 条；choice_tags 与 choices 等长（advance/probe/risk）；若有 risk，risk_hint 必填。\n` +
  `**仍禁止**谜语简写、谐音省字、拼音/字母缩写——宁可再删半句剧情，也别用缩写字顶意思。`;

export const INITIAL_ASSISTANT_MESSAGE = JSON.stringify(INITIAL_DATA);

// ─── Multi-character prompt (v13+) ─────────────────────────────────────────

/** 多角色模式下，每个角色最多提供的历史 turn 数（focus=24, other=6） */
const MULTI_CHAR_FOCUS_TURNS = 24;
const MULTI_CHAR_OTHER_TURNS = 6;

const MULTI_CHAR_JSON_PROTOCOL = `## 多角色输出协议（严格遵守）
每次回复必须是合法 JSON，不加任何 markdown 包裹。
**长度（硬约束）**：每位角色的 text≤160 字、narration≤60 字、每条 choice≤20 字、cg_scene 英文 tag 单行总长≤120 字符。

输出格式：
{
  "narration": "旁白（场景叙述，可选）",
  "replies": [
    {
      "speaker": "characterId",
      "text": "该角色台词或动作描写",
      "narration": "该角色内心独白（第一人称），可留空",
      "affection_delta": 0,
      "trust_delta": 0,
      "intimacy_delta": 0,
      "desire_delta": 0,
      "mood": "心情（可选）",
      "relationship": "关系标签（可选）",
      "wear": {},
      "wear_nsfw": {},
      "cg_trigger": false,
      "cg_scene": "",
      "cg_explicit": false,
      "cold_war_delta": 0
    }
  ],
  "pair_deltas": [
    { "fromId": "charA", "toId": "charB", "trust_delta": 0, "affection_delta": 0, "relationship": "可选" }
  ],
  "choices": [
    { "label": "选项文本", "tag": "advance", "speaker": "characterId或group" }
  ],
  "participant_changes": [
    { "characterId": "charId", "action": "enter或exit" }
  ],
  "location": "",
  "chapter_delta": 0,
  "flag_delta": {},
  "game_over": false,
  "ending_title": "",
  "ending_summary": "",
  "risk_hint": ""
}

规则：
- replies 数组中每个在场角色各有一条（按 scene_participants 顺序）
- pair_deltas 描述角色间关系变化（非角色与玩家，仅 NPC 之间）
- choices 带 speaker 字段，表示该选项是针对哪个角色的回应（"group"=对所有人）
- participant_changes 仅在角色离场/进场时填写（不填则维持原样）
- **每位角色的 cg_trigger/cg_scene 独立**；每个角色可单独触发出图`;

function buildCharacterContextBlock(
  char: CharacterSliceData,
  isFocusChar: boolean,
  world: WorldState,
): string {
  const maxTurns = isFocusChar ? MULTI_CHAR_FOCUS_TURNS : MULTI_CHAR_OTHER_TURNS;
  const recentHistory = char.history.slice(-(maxTurns * 2));
  const historyLines = recentHistory
    .map((m) => `  [${m.role === "user" ? "玩家" : char.displayName}] ${m.content.slice(0, 120)}`)
    .join("\n");

  const wearLine = formatWearBlock(char.wear);
  const summaryLine = char.summary_subjective
    ? `- 记忆摘要：${char.summary_subjective}`
    : "";
  const coldWarLine = char.cold_war_remaining > 0
    ? `- 冷战中（剩余 ${char.cold_war_remaining} 回合）`
    : "";

  return `### ${char.displayName}（id: ${char.characterId}）${isFocusChar ? "【焦点角色·全量历史】" : ""}
- 好感度：${char.affection}/100 | 信任度：${char.trust}/100 | 亲密度：${char.intimacy}/100 | 欲望：${char.desire}/100
- 心情：${char.mood || "平静"} | 关系（对玩家）：${char.relationship || "师生"}
- 穿着：${wearLine}
- 所在地：${char.location || world.location}
${summaryLine}
${coldWarLine}
${isFocusChar ? `最近对话记录（最多 ${maxTurns} 轮）：\n${historyLines || "  （无历史）"}` : `最近对话摘要（最多 ${maxTurns} 轮）：\n${historyLines || "  （无历史）"}`}`;
}

function buildPairContextBlock(pairs: PairRelation[], participants: string[], chars: Map<string, CharacterSliceData>): string {
  // Only show pairs between present characters
  const relevant = pairs.filter(
    (p) => participants.includes(p.fromId) && participants.includes(p.toId),
  );
  if (relevant.length === 0) return "";
  const lines = relevant.map((p) => {
    const fromName = chars.get(p.fromId)?.displayName ?? p.fromId;
    const toName = chars.get(p.toId)?.displayName ?? p.toId;
    const cw = p.cold_war_remaining > 0 ? `，冷战中（剩余 ${p.cold_war_remaining} 回合）` : "";
    return `- ${fromName} → ${toName}：信任 ${p.trust}，好感 ${p.affection}，${p.relationship}${cw}`;
  });
  return `## 角色间关系\n${lines.join("\n")}`;
}

/**
 * 多角色系统 prompt（场景中有 2+ 角色时使用）。
 * focusCharId: 最近互动的角色（获得全量历史）；其他角色给摘要+最近 6 turn。
 */
export function buildMultiCharacterSystemPrompt(
  state: GameState,
  focusCharId: string,
  opts?: { sceneDir?: string },
): string {
  const sceneDir = opts?.sceneDir ?? defaultConfig().sceneDir;
  const world = state.world;
  const participants = world.scene_participants;
  const chars = state.characters;

  const charBlocks = participants
    .map((id) => {
      const char = chars.get(id);
      if (!char) return `### （未知角色 ${id}）`;
      return buildCharacterContextBlock(char, id === focusCharId, world);
    })
    .join("\n\n");

  const pairBlock = buildPairContextBlock(state.pairs, participants, chars);

  const guidance = world.nsfw_mode ? NSFW_GUIDANCE : PG_GUIDANCE;
  const calendarLine = buildCalendarLine(state);
  const sceneVenueBlock = buildSceneVenuePromptBlock(state, sceneDir);
  const sceneBlockStr = sceneVenueBlock ? `${sceneVenueBlock}\n\n` : "";
  const setting = CHAPTER_SETTINGS[world.chapter] ?? DEFAULT_CHAPTER_SETTING;
  const participantNames = participants
    .map((id) => chars.get(id)?.displayName ?? id)
    .join("、");

  return `你是一款文字 AVG 养成游戏的叙事 AI。当前场景有多个角色同时在场：${participantNames}。
你需要**同时**扮演所有在场角色，并以多角色 JSON 格式响应。

${SYSTEM_ZH_DISCIPLINE}

${MULTI_CHAR_JSON_PROTOCOL}

${guidance}

## 当前世界状态
- 章节：第 ${world.chapter} 章 —— ${setting}
- 日历：${calendarLine}
- 当前时段：${world.time_of_day}（${timeSlotLabel(world.time_slot)}）
- 场景地点：${world.location}
- NSFW 模式：${world.nsfw_mode ? "开启" : "关闭"}

## 在场角色
${charBlocks}

${pairBlock ? `${pairBlock}\n` : ""}
${sceneBlockStr}
## 叙事要点
1. 每位在场角色都需要在 replies 中有独立的回应
2. 角色间的互动、反应要体现各自的数值状态和性格
3. 选项（choices）带 speaker 字段，引导玩家与特定角色互动
4. 若有角色因剧情需要离场或新角色进场，在 participant_changes 中注明
5. pair_deltas 只写角色之间（非角色与玩家）的关系变化
6. 与玩家的数值变化（affection_delta 等）写在各角色的 replies 条目内
7. **禁止**谐音简写、谜语缩字；所有中文须一眼可读`;
}
