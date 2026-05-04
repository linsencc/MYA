import type { WorldShopListingUi } from "@/lib/game/content/world-ui-types";
import { getItemCatalogEntry, readPocketMoney } from "@/lib/game/content/item-catalog";

export type ShopListingDef = {
  listingId: string;
  itemId: string;
  price: number;
  qtyPerPurchase: number;
  /** 展示用；缺省用物品目录 displayName */
  label?: string;
};

export const SHOP_LISTINGS: readonly ShopListingDef[] = [
  {
    listingId: "shop_instant_coffee",
    itemId: "instant_coffee",
    price: 12,
    qtyPerPurchase: 1,
    label: "速溶咖啡（单包）",
  },
  {
    listingId: "shop_sticky_notes",
    itemId: "sticky_notes",
    price: 5,
    qtyPerPurchase: 3,
    label: "便利贴（3 本）",
  },
  {
    listingId: "shop_energy_drink",
    itemId: "energy_drink",
    price: 18,
    qtyPerPurchase: 1,
    label: "能量饮料",
  },
] as const;

export function getShopListingDef(listingId: string): ShopListingDef | undefined {
  const id = String(listingId ?? "").trim();
  return SHOP_LISTINGS.find((l) => l.listingId === id);
}

export function buildShopListingsUi(flags: Record<string, unknown>): WorldShopListingUi[] {
  const money = readPocketMoney(flags);
  return SHOP_LISTINGS.map((l) => {
    const cat = getItemCatalogEntry(l.itemId);
    const label = (l.label ?? cat?.displayName ?? l.itemId).slice(0, 80);
    return {
      listingId: l.listingId,
      label,
      price: l.price,
      affordable: money >= l.price,
      itemId: l.itemId,
      qtyPerPurchase: l.qtyPerPurchase,
    };
  });
}
