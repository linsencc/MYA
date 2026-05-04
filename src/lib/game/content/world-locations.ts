import type { GameState } from "@/lib/game/domain/state";
import { getItemCatalogEntry, readPocketMoney } from "@/lib/game/content/item-catalog";
import { buildShopListingsUi } from "@/lib/game/content/shop-listings";
import { listTravelLocationDefsFromScenes } from "@/lib/game/content/world-travel-from-scenes";
import type { WorldInventoryRowUi, WorldLocationRowUi, WorldPhoneThreadUi, WorldUiBlock } from "@/lib/game/content/world-ui-types";

export type {
  WorldInventoryRowUi,
  WorldLocationRowUi,
  WorldPhoneThreadUi,
  WorldShopListingUi,
  WorldUiBlock,
} from "@/lib/game/content/world-ui-types";

function travelBudgetFromFlags(flags: Record<string, unknown>): { remaining: number | null; max: number | null } {
  const maxRaw = flags.world_travel_max;
  const remRaw = flags.world_travel_remaining;
  if (typeof maxRaw !== "number" || typeof remRaw !== "number") {
    return { remaining: null, max: null };
  }
  const max = Math.max(0, Math.floor(maxRaw));
  const remaining = Math.max(0, Math.floor(remRaw));
  return { remaining, max };
}

/** 当日时段变化时重置；同档内多次移动扣减 world_travel_remaining */
export function initTravelAllowanceForCurrentSlot(state: GameState, maxMoves = 2): void {
  const key = `${state.calendar_day}:${state.time_slot}`;
  if (state.flags.world_travel_slot_marker === key) return;
  state.flags.world_travel_slot_marker = key;
  state.flags.world_travel_max = maxMoves;
  state.flags.world_travel_remaining = maxMoves;
}

/** 成功移动前调用：若本档次数用尽返回 false */
export function consumeTravelMove(state: GameState): boolean {
  initTravelAllowanceForCurrentSlot(state);
  const rem = Math.max(0, Math.floor(Number(state.flags.world_travel_remaining ?? 0)));
  if (rem <= 0) return false;
  state.flags.world_travel_remaining = rem - 1;
  return true;
}

/** 解析 flags.inventory：[{ id, qty }] 或 { id: qty } */
export function parseInventoryFromFlags(flags: Record<string, unknown>): WorldInventoryRowUi[] {
  const raw = flags.inventory;
  const displayNameFor = (id: string) => getItemCatalogEntry(id)?.displayName ?? id;
  const rows: WorldInventoryRowUi[] = [];
  if (Array.isArray(raw)) {
    for (const x of raw) {
      if (!x || typeof x !== "object") continue;
      const o = x as Record<string, unknown>;
      const id = String(o.id ?? "").trim();
      if (!id) continue;
      const qty = Math.max(0, Math.floor(Number(o.qty ?? 1)));
      if (qty <= 0) continue;
      const cat = getItemCatalogEntry(id);
      const name = String(o.name ?? displayNameFor(id));
      const desc = cat?.description?.trim();
      rows.push({
        id,
        name,
        qty,
        usable: Boolean(o.usable ?? true),
        ...(desc ? { description: desc.slice(0, 200) } : {}),
      });
    }
    return rows;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
      const qty = Math.max(0, Math.floor(Number(v)));
      if (qty <= 0) continue;
      const cat = getItemCatalogEntry(id);
      const desc = cat?.description?.trim();
      rows.push({
        id,
        name: displayNameFor(id),
        qty,
        usable: true,
        ...(desc ? { description: desc.slice(0, 200) } : {}),
      });
    }
  }
  return rows;
}

/** 解析 flags.phone_threads */
export function parsePhoneThreadsFromFlags(flags: Record<string, unknown>): WorldPhoneThreadUi[] {
  const raw = flags.phone_threads;
  if (!Array.isArray(raw)) return [];
  const out: WorldPhoneThreadUi[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const id = String(o.id ?? "").trim();
    if (!id) continue;
    out.push({
      id,
      title: String(o.title ?? "消息"),
      unread: Boolean(o.unread),
      lastSnippet: String(o.lastSnippet ?? "").slice(0, 120),
    });
  }
  return out;
}

export function travelLabelForId(locationId: string, sceneDir?: string): string | null {
  const id = String(locationId ?? "").trim();
  const d = listTravelLocationDefsFromScenes(sceneDir).find((x) => x.id === id);
  return d ? d.label : null;
}

export function locationLockReason(
  defLabel: string,
  state: Pick<GameState, "location" | "trust" | "cold_war_remaining">,
): { locked: boolean; reason: string } {
  if (defLabel === state.location) return { locked: true, reason: "当前所在" };
  if (defLabel === "教师办公室" && state.trust < 15) {
    return { locked: true, reason: "信任不足（需≥15）" };
  }
  if (defLabel === "天台" && state.cold_war_remaining >= 3) {
    return { locked: true, reason: "冷战僵持中，不便独处高处" };
  }
  return { locked: false, reason: "" };
}

export function buildWorldUiBlock(state: GameState, sceneDir?: string): WorldUiBlock {
  const { remaining, max } = travelBudgetFromFlags(state.flags);
  const defs = listTravelLocationDefsFromScenes(sceneDir);
  const locations: WorldLocationRowUi[] = defs.map((def) => {
    const { locked, reason } = locationLockReason(def.label, state);
    return {
      id: def.id,
      label: def.label,
      current: def.label === state.location,
      locked,
      lockReason: reason,
      cgImageSrc: def.cgImageSrc,
      cardSummary: def.cardSummary,
    };
  });
  return {
    locations,
    inventory: parseInventoryFromFlags(state.flags),
    phoneThreads: parsePhoneThreadsFromFlags(state.flags),
    travelMovesRemaining: remaining,
    travelMovesMax: max,
    pocketMoney: readPocketMoney(state.flags),
    shopListings: buildShopListingsUi(state.flags),
  };
}
