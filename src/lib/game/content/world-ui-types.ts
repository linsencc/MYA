/** 世界侧栏 UI 协议（无 Node/fs，客户端与服务器共用） */

export type WorldLocationRowUi = {
  id: string;
  label: string;
  current: boolean;
  locked: boolean;
  lockReason: string;
  /** 地点卡 CG（`/scenes/...`）；缺失时为 null */
  cgImageSrc: string | null;
  /** 一句地点氛围说明 */
  cardSummary: string;
};

export type WorldInventoryRowUi = {
  id: string;
  name: string;
  qty: number;
  usable: boolean;
  /** 来自物品目录的一句说明 */
  description?: string;
};

export type WorldPhoneThreadUi = {
  id: string;
  title: string;
  unread: boolean;
  lastSnippet: string;
};

export type WorldShopListingUi = {
  listingId: string;
  label: string;
  price: number;
  affordable: boolean;
  itemId: string;
  qtyPerPurchase: number;
};

export type WorldUiBlock = {
  locations: WorldLocationRowUi[];
  inventory: WorldInventoryRowUi[];
  phoneThreads: WorldPhoneThreadUi[];
  travelMovesRemaining: number | null;
  travelMovesMax: number | null;
  /** 当前零花钱（与 flags.pocket_money 一致） */
  pocketMoney: number;
  shopListings: WorldShopListingUi[];
};
