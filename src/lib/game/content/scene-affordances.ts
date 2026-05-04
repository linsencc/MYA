/**
 * 按地点 `world_travel_id` 解析**场景能力**（B1 静态表，可扩展，非存盘真相源）
 */
import type { WorldUiBlock } from "@/lib/game/content/world-ui-types";

export { DEFAULT_PROTAGONIST_ID, DEFAULT_PROTAGONIST_DISPLAY_NAME } from "@/lib/game/application/game-cast-constants";

/** 与 `content/scenes` / fallback 的 `id` 对齐，缺省则本地点无能力 */
const AFFORDANCES_BY_LOCATION_ID: Record<string, string[]> = {
  classroom: ["generic"],
  /** 一屏内挂齐 shop / library / cafe 便于联调 */
  teacher_office: ["shop", "library", "cafe"],
  corridor: ["generic"],
  rooftop: ["cafe", "library"],
};

export function resolveSceneAffordances(world: WorldUiBlock, _stateLocationLabel: string): string[] {
  const cur = world.locations.find((l) => l.current);
  const id = cur?.id?.trim() ?? "";
  if (!id) return [];
  const v = AFFORDANCES_BY_LOCATION_ID[id];
  return v ? [...v] : [];
}

export function hasAffordance(world: WorldUiBlock, cap: string, stateLabel: string): boolean {
  return resolveSceneAffordances(world, stateLabel).includes(cap);
}
