import type { WorldUiBlock } from "@/lib/game/content/world-ui-types";
import { FALLBACK_TRAVEL_LOCATION_DEFS } from "@/lib/game/content/world-travel-fallback";

/** 客户端首屏占位（不 import world-locations / scene registry，避免打包 fs） */
export function emptyWorldUiBlock(): WorldUiBlock {
  return {
    locations: FALLBACK_TRAVEL_LOCATION_DEFS.map((def) => ({
      id: def.id,
      label: def.label,
      current: def.label === "教室",
      locked: false,
      lockReason: "",
      cgImageSrc: def.cgImageSrc,
      cardSummary: def.cardSummary,
    })),
    inventory: [],
    phoneThreads: [],
    travelMovesRemaining: null,
    travelMovesMax: null,
    pocketMoney: 0,
    shopListings: [],
  };
}
