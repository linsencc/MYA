import type { CharacterRegistryEntry } from "@/lib/game/character/registry";
import { DEFAULT_PROTAGONIST_ID } from "@/lib/game/application/game-cast-constants";
import {
  defaultTeacherWear,
  sliceWearField,
  type TeacherWear,
} from "@/lib/game/domain/teacher-wear";

/** 与 `content/characters/char_<characterId>/card.json`「阵容外貌」一致；剧情中随回合 wear 合并而更新 */
const NPC_INITIAL_WEAR: Record<string, TeacherWear> = {
  npc_chen_mu: {
    top: "酒红针织开衫、印花衬衫",
    bottom: "黑色直筒长裤",
    legwear: "黑色短袜",
    shoes: "黑色平底乐福鞋",
    accessories: "金婚戒、玉镯、帆布手提袋",
    state: "整齐",
  },
  npc_li_laoshi: {
    top: "奶油针织开衫、白衬衫",
    bottom: "深蓝色九分长裤",
    legwear: "黑色打底裤",
    shoes: "棕色乐福鞋",
    accessories: "金属细框眼镜、细手链、珍珠耳钉",
    state: "整齐",
  },
  npc_li_mei: {
    top: "浅蓝色衬衫",
    bottom: "灰色铅笔裙",
    legwear: "黑色连裤袜",
    shoes: "黑色低跟鞋",
    accessories: "细银手表、小银耳钉",
    state: "整齐",
  },
  npc_lin_taitai: {
    top: "米色风衣、浅灰高领毛衣",
    bottom: "棕色及膝 A 字裙",
    legwear: "肤色丝袜",
    shoes: "棕色短靴低跟",
    accessories: "金婚戒、小圈耳环、皮包",
    state: "整齐",
  },
  npc_lin_zhuren: {
    top: "深灰西装、白衬衫、深色领带",
    bottom: "深色西装长裤",
    legwear: "黑色正装袜",
    shoes: "黑色牛津皮鞋",
    accessories: "皮带、腕表",
    state: "整齐",
  },
  npc_wang_taitai: {
    top: "红色丝质上衣暗花",
    bottom: "黑色高腰铅笔裙",
    legwear: "黑色丝袜",
    shoes: "红色尖头高跟鞋",
    accessories: "细金项链、手拿包",
    state: "整齐",
  },
  npc_xiao_min: {
    top: "校服西装、白衬衫",
    bottom: "灰色百褶裙",
    legwear: "白色短袜",
    shoes: "棕色制服皮鞋",
    accessories: "蓝领结、发卡、挂绳",
    state: "整齐",
  },
  npc_zhang_laoshi: {
    top: "海军蓝西装、白衬衫、窄领带",
    bottom: "海军蓝铅笔裙",
    legwear: "肤色薄丝袜",
    shoes: "黑色尖头低跟鞋",
    accessories: "小耳钉、细腕表",
    state: "整齐",
  },
  npc_zhou_xiao: {
    top: "校服西装、白衬衫",
    bottom: "灰色百褶裙",
    legwear: "黑色及膝袜",
    shoes: "棕色制服皮鞋",
    accessories: "红领结、胸牌绳、小发卡",
    state: "整齐",
  },
};

/** 「阵容外貌」分号前半拆进 TeacherWear（兜底） */
function rosterSummaryToWear(line: string): TeacherWear {
  const outfit = line.split("；")[0]?.trim() ?? line.trim();
  const parts = outfit
    .split(/[、，,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const d = defaultTeacherWear();
  if (parts.length >= 1) d.top = sliceWearField(parts[0]!);
  if (parts.length >= 2) d.bottom = sliceWearField(parts[1]!);
  if (parts.length >= 3) d.legwear = sliceWearField(parts[2]!);
  if (parts.length >= 4) d.shoes = sliceWearField(parts[3]!);
  if (parts.length >= 5) d.accessories = sliceWearField(parts[4]!);
  if (parts.length >= 6) d.state = sliceWearField(parts[5]!);
  return d;
}

/** 新档 / 注册表种子：每人独立初始着装 */
export function initialWearForCharacterEntry(entry: CharacterRegistryEntry): TeacherWear {
  if (entry.id === DEFAULT_PROTAGONIST_ID) return defaultTeacherWear();
  const fixed = NPC_INITIAL_WEAR[entry.id];
  if (fixed) return { ...fixed };
  if (entry.rosterLineCn?.trim()) return rosterSummaryToWear(entry.rosterLineCn.trim());
  return defaultTeacherWear();
}

/** 存档迁移等：仅按 id，不配 roster 行 */
export function initialWearForCharacterId(characterId: string): TeacherWear {
  if (characterId === DEFAULT_PROTAGONIST_ID) return defaultTeacherWear();
  const fixed = NPC_INITIAL_WEAR[characterId];
  if (fixed) return { ...fixed };
  return defaultTeacherWear();
}
