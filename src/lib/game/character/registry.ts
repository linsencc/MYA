import fs from "fs";
import path from "path";
import { DEFAULT_PROTAGONIST_ID } from "@/lib/game/application/game-cast-constants";

const CHAR_DIR_PREFIX = "char_";

export type CharacterRegistryEntry = {
  id: string;
  displayName: string;
  /** 相对 `characterDir`，如 `char_chen_yue/card.json` */
  cardFile: string;
  /** 新游戏时是否默认已遇见（主线女主） */
  defaultMet: boolean;
  /**
   * 阵容侧栏「服饰/外貌」一行（中文）。
   * 主线女主为 null：面板显示存档内动态 wear，而非固化句。
   */
  rosterLineCn: string | null;
};

const PRIMARY_ID = "chen_yue";
const PRIMARY_FOLDER = `${CHAR_DIR_PREFIX}${PRIMARY_ID}`;
const PRIMARY_CARD_REL = `${PRIMARY_FOLDER}/card.json`;
const PRIMARY_DISPLAY = "陈悦";

function readCardDisplayName(absJson: string): string | null {
  try {
    const raw = fs.readFileSync(absJson, "utf-8");
    const j = JSON.parse(raw) as Record<string, unknown>;
    const n = String(j["名称"] ?? "").trim();
    return n || null;
  } catch {
    return null;
  }
}

function readCardRosterLine(absJson: string): string | null {
  try {
    const raw = fs.readFileSync(absJson, "utf-8");
    const j = JSON.parse(raw) as Record<string, unknown>;
    const v = j["阵容外貌"];
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s ? s.slice(0, 200) : null;
  } catch {
    return null;
  }
}

/** 未在 JSON 写「阵容外貌」时的内置摘要；键为 `characterId` */
const DEFAULT_ROSTER_LINE_BY_ID: Record<string, string> = {
  npc_chen_mu: "酒红开衫、印花衬衫、黑长裤与平底鞋；齐耳烫卷发，家常长辈气质",
  npc_li_laoshi: "奶油开衫、白衬衫与深蓝长裤；金属细框眼镜，低盘发",
  npc_li_mei: "浅蓝衬衫、灰色铅笔裙与丝袜；披肩侧分长发，无眼镜",
  npc_lin_taitai: "米色风衣、浅灰高领与棕色及膝裙；微卷肩发，温和持家",
  npc_lin_zhuren: "深灰西装、白衬衫与领带；短发男性，教务正装",
  npc_wang_taitai: "红色上衣、黑色铅笔裙与高跟鞋；高马尾，爽朗外向",
  npc_xiao_min: "校服套装、灰百褶裙；蓝领结、长发与发卡",
  npc_zhang_laoshi: "海军蓝西装套裙、白衬衫与窄领带；利落短发，无眼镜",
  npc_zhou_xiao: "校服套装、灰百褶裙；红领结、马尾与胸牌绳",
};

function folderNameToId(folder: string): string {
  if (folder === PRIMARY_FOLDER) return PRIMARY_ID;
  if (folder.startsWith(CHAR_DIR_PREFIX)) return folder.slice(CHAR_DIR_PREFIX.length);
  return folder;
}

/** 规范化磁盘目录名：一律 `char_<characterId>` */
function toCanonFolderFromStem(stem: string): string {
  if (stem === "女老师" || stem === PRIMARY_ID) return PRIMARY_FOLDER;
  return `${CHAR_DIR_PREFIX}${stem}`;
}

/**
 * 旧存档 `女老师.json`、`npc_x.json`、`chen_yue/card.json` 等 → `char_<id>/card.json`
 */
export function migrateCardRelativePath(raw: string): string {
  const s = raw.trim().replace(/\\/g, "/");
  if (!s) return PRIMARY_CARD_REL;

  if (s.endsWith("/card.json")) {
    const parts = s.split("/").filter(Boolean);
    if (parts.length < 2 || parts[parts.length - 1] !== "card.json") return s;
    const folder = parts[0]!;
    if (folder.startsWith(CHAR_DIR_PREFIX)) return s;
    if (folder === "chen_yue") return PRIMARY_CARD_REL;
    return `${CHAR_DIR_PREFIX}${folder}/card.json`;
  }

  if (s.includes("/") && !/\.json$/i.test(path.basename(s))) return s;

  const base = path.basename(s).replace(/\.json$/i, "");
  if (base === "女老师") return PRIMARY_CARD_REL;
  if (!base) return PRIMARY_CARD_REL;
  return `${toCanonFolderFromStem(base)}/card.json`;
}

function assertSafeCardRel(rel: string): string[] {
  const segments = rel.split(/[/\\]/).filter(Boolean);
  if (segments.some((x) => x === "..")) throw new Error("invalid character card path");
  return segments;
}

export function resolveCharacterCardAbsPath(characterDir: string, cardRelativePath: string): string {
  const rel = migrateCardRelativePath(cardRelativePath);
  const base = path.resolve(characterDir);
  const full = path.resolve(base, ...assertSafeCardRel(rel));
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;
  if (full !== base && !full.startsWith(prefix)) throw new Error("invalid character card path");
  return full;
}

/**
 * 列出可玩角色注册表：`characterDir/char_<id>/card.json`（排除 `_` 前缀目录，不参与注册）。
 */
export function listCharacterRegistry(characterDir: string): CharacterRegistryEntry[] {
  const abs = path.resolve(characterDir);
  const folders: string[] = [];
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith("_") || ent.name.startsWith(".")) continue;
      const cardPath = path.join(abs, ent.name, "card.json");
      if (!fs.existsSync(cardPath)) continue;
      folders.push(ent.name);
    }
  }
  folders.sort((a, b) => {
    if (a === PRIMARY_FOLDER) return -1;
    if (b === PRIMARY_FOLDER) return 1;
    return a.localeCompare(b);
  });

  const entries: CharacterRegistryEntry[] = [];
  for (const folder of folders) {
    const id = folderNameToId(folder);
    const cardFile = `${folder}/card.json`;
    const cardAbs = path.join(abs, folder, "card.json");
    const displayName = readCardDisplayName(cardAbs) ?? (id === PRIMARY_ID ? PRIMARY_DISPLAY : id.replace(/_/g, " "));
    const rosterLineCn = readCardRosterLine(cardAbs) ?? DEFAULT_ROSTER_LINE_BY_ID[id] ?? null;
    entries.push({
      id,
      displayName,
      cardFile,
      defaultMet: id === PRIMARY_ID,
      rosterLineCn: id === PRIMARY_ID ? null : rosterLineCn,
    });
  }
  return entries;
}

/** 当前聚焦角色出图用绝对路径；主线女主可环境变量覆盖整张卡文件。 */
export function resolvePlayableCharacterCardPath(args: {
  characterDir: string;
  activeCharacterId: string;
  characterJsonOverride: string | null;
  cardRelativePath: string;
}): string {
  if (args.activeCharacterId === DEFAULT_PROTAGONIST_ID && args.characterJsonOverride?.trim()) {
    return path.resolve(args.characterJsonOverride.trim());
  }
  return resolveCharacterCardAbsPath(args.characterDir, args.cardRelativePath || PRIMARY_CARD_REL);
}

export function findRegistryEntry(
  characterDir: string,
  characterId: string,
): CharacterRegistryEntry | undefined {
  return listCharacterRegistry(characterDir).find((e) => e.id === characterId);
}
