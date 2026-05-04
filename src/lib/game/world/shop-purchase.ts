import { mergeInventoryDelta } from "@/lib/game/domain/merge-flag-delta";
import {
  clampPocketMoney,
  getItemCatalogEntry,
  POCKET_MONEY_FLAG,
  readPocketMoney,
} from "@/lib/game/content/item-catalog";
import { getShopListingDef } from "@/lib/game/content/shop-listings";

function cloneFlagsShallow(flags: Record<string, unknown>): Record<string, unknown> {
  const inv = flags.inventory;
  const invCopy = Array.isArray(inv)
    ? inv.filter((x) => x && typeof x === "object" && !Array.isArray(x)).map((x) => ({ ...(x as Record<string, unknown>) }))
    : [];
  return { ...flags, inventory: invCopy };
}

function qtyAfterMerge(flags: Record<string, unknown>, itemId: string): number {
  const raw = flags.inventory;
  if (!Array.isArray(raw)) return 0;
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (String(o.id ?? "").trim() === itemId) {
      return Math.max(0, Math.floor(Number(o.qty ?? 0)));
    }
  }
  return 0;
}

/**
 * 校验并执行购买：扣款 + mergeInventoryDelta。失败不修改 flags。
 */
export function tryApplyShopPurchase(
  flags: Record<string, unknown>,
  listingId: string,
): { ok: true } | { ok: false; error: string } {
  const listing = getShopListingDef(listingId);
  if (!listing) return { ok: false, error: "无效商品。" };
  const cat = getItemCatalogEntry(listing.itemId);
  if (!cat) return { ok: false, error: "商品未在物品目录登记。" };

  const money = readPocketMoney(flags);
  if (money < listing.price) return { ok: false, error: "零花钱不足。" };

  const trial = cloneFlagsShallow(flags);
  mergeInventoryDelta(trial, [
    { id: listing.itemId, qty: listing.qtyPerPurchase, name: cat.displayName, usable: cat.defaultUsable },
  ]);
  const after = qtyAfterMerge(trial, listing.itemId);
  const maxS = cat.maxStack;
  if (typeof maxS === "number" && maxS > 0 && after > maxS) {
    return { ok: false, error: "背包数量已达上限，无法继续购买。" };
  }

  const newMoney = money - listing.price;
  if (newMoney < 0) return { ok: false, error: "零花钱不足。" };

  mergeInventoryDelta(flags, [
    { id: listing.itemId, qty: listing.qtyPerPurchase, name: cat.displayName, usable: cat.defaultUsable },
  ]);
  flags[POCKET_MONEY_FLAG] = newMoney;
  clampPocketMoney(flags);
  return { ok: true };
}
