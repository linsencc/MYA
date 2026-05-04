/**
 * 物品目录（SSOT）：展示名、侧栏说明、默认可用、是否消耗、堆叠上限。
 */

export const POCKET_MONEY_FLAG = "pocket_money";
export const MAX_POCKET_MONEY = 999_999;

export type ItemCatalogEntry = {
  id: string;
  displayName: string;
  description?: string;
  defaultUsable: boolean;
  /** false：使用触发效果但不扣 qty（如作业文件夹） */
  consumeOnUse: boolean;
  maxStack?: number;
};

const ENTRIES: readonly ItemCatalogEntry[] = [
  {
    id: "homework_folder",
    displayName: "作业文件夹",
    description: "交作业、表态度；不会在「使用」时被消耗。",
    defaultUsable: true,
    consumeOnUse: false,
  },
  {
    id: "instant_coffee",
    displayName: "速溶咖啡",
    description: "提神；略拉近关系。",
    defaultUsable: true,
    consumeOnUse: true,
    maxStack: 9,
  },
  {
    id: "sticky_notes",
    displayName: "便利贴",
    description: "随手留言；缓和气氛用。",
    defaultUsable: true,
    consumeOnUse: true,
    maxStack: 20,
  },
  {
    id: "energy_drink",
    displayName: "能量饮料",
    description: "糖分与咖啡因；别多喝。",
    defaultUsable: true,
    consumeOnUse: true,
    maxStack: 6,
  },
] as const;

const BY_ID = new Map<string, ItemCatalogEntry>(ENTRIES.map((e) => [e.id, e]));

export function getItemCatalogEntry(id: string): ItemCatalogEntry | undefined {
  return BY_ID.get(String(id ?? "").trim());
}

export function itemCatalogConsumeOnUse(id: string): boolean {
  return getItemCatalogEntry(id)?.consumeOnUse ?? true;
}

export function knownItemIdsForPrompt(maxLen = 200): string {
  const s = ENTRIES.map((e) => e.id).join("、");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

/** 开局默认背包第一行（已规范化） */
export function defaultStarterInventoryRow(): Record<string, unknown> {
  return normalizeInventoryRow({ id: "homework_folder", qty: 1 });
}

function normalizeQty(v: unknown, fallback = 1): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}

/**
 * 单行补全：名称、usable 缺省、maxStack 钳制。
 */
export function normalizeInventoryRow(row: Record<string, unknown>): Record<string, unknown> {
  const id = String(row.id ?? "").trim();
  const cat = id ? getItemCatalogEntry(id) : undefined;
  let name = row.name !== undefined ? String(row.name).slice(0, 120) : "";
  const nameTrim = name.trim();
  if (!nameTrim || nameTrim === id) {
    name = cat?.displayName ?? (id || name);
  }
  const usable =
    row.usable !== undefined ? Boolean(row.usable) : (cat?.defaultUsable ?? true);
  let qty = normalizeQty(row.qty, 1);
  const maxS = cat?.maxStack;
  if (typeof maxS === "number" && maxS > 0) {
    qty = Math.min(qty, maxS);
  }
  return { ...row, id, name, usable, qty };
}

/** 读 flags 中的零花钱并钳制写入 */
export function readPocketMoney(flags: Record<string, unknown>): number {
  const raw = flags[POCKET_MONEY_FLAG];
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(MAX_POCKET_MONEY, Math.floor(n)));
}

export function clampPocketMoney(flags: Record<string, unknown>): void {
  flags[POCKET_MONEY_FLAG] = readPocketMoney(flags);
}

/**
 * 整表修复：去重 id（qty 相加）、strip 非法行、逐行 normalize、删 qty≤0。
 */
export function repairFlagsInventory(flags: Record<string, unknown>): void {
  const raw = flags.inventory;
  if (!Array.isArray(raw)) {
    flags.inventory = [defaultStarterInventoryRow()];
    return;
  }
  const byId = new Map<string, Record<string, unknown>>();
  for (const x of raw) {
    if (!x || typeof x !== "object" || Array.isArray(x)) continue;
    const o = { ...(x as Record<string, unknown>) };
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    const prev = byId.get(id);
    const qAdd = normalizeQty(o.qty, 1);
    if (prev) {
      const q0 = normalizeQty(prev.qty, 1);
      byId.set(id, { ...prev, ...o, id, qty: q0 + qAdd });
    } else {
      byId.set(id, o);
    }
  }
  const rows = Array.from(byId.values())
    .map((r) => normalizeInventoryRow(r))
    .filter((r) => normalizeQty(r.qty, 1) > 0);
  flags.inventory = rows.length > 0 ? rows : [defaultStarterInventoryRow()];
}
