import { defaultConfig } from "@/lib/game/config";
import { getSceneRegistry, SCENE_REGISTRY_FALLBACK_ID } from "@/lib/game/scene/registry";
import type { SceneRecord } from "@/lib/game/scene/types";
import { FALLBACK_TRAVEL_LOCATION_DEFS } from "@/lib/game/content/world-travel-fallback";

export type TravelLocationDefUi = {
  id: string;
  label: string;
  cgImageSrc: string | null;
  cardSummary: string;
};

function travelOrder(scene: SceneRecord): number {
  const n = Number(scene.world_travel_order);
  return Number.isFinite(n) ? n : 100;
}

/**
 * 可「前往」的地点列表：由场景注册表生成（`scenes/<id>/<id>.json` 或根目录 `*.json`；仅服务端 / Node）。
 * `world_travel_id` 可与场景 `id` 不同（如 office → teacher_office）；若省略则使用场景 `id`，便于新场景默认可选。
 */
export function listTravelLocationDefsFromScenes(sceneDir?: string): TravelLocationDefUi[] {
  const dir = sceneDir ?? defaultConfig().sceneDir;
  const reg = getSceneRegistry(dir);
  if (!reg?.scenesById.size) return FALLBACK_TRAVEL_LOCATION_DEFS.map((x) => ({ ...x }));
  const rows: {
    id: string;
    label: string;
    order: number;
    cgImageSrc: string | null;
    cardSummary: string;
    /** 与 `id` 对应的条目是否显式写了 world_travel_id（去重时优先保留） */
    explicitTravelId: boolean;
  }[] = [];
  for (const scene of reg.scenesById.values()) {
    if (scene.id === "default") continue;
    const explicitWid = String(scene.world_travel_id ?? "").trim();
    const wid = explicitWid || String(scene.id ?? "").trim();
    if (!wid) continue;
    const label = String(scene.travel_label ?? scene.display_name ?? wid).trim() || wid;
    const cg = String(scene.world_cg_src ?? "").trim();
    const sum = String(scene.world_card_summary ?? "").trim();
    rows.push({
      id: wid,
      label,
      order: travelOrder(scene),
      cgImageSrc: cg || null,
      cardSummary: sum,
      explicitTravelId: Boolean(explicitWid),
    });
  }
  if (rows.length === 0) return FALLBACK_TRAVEL_LOCATION_DEFS.map((x) => ({ ...x }));
  rows.sort((a, b) => {
    const o = a.order - b.order;
    if (o !== 0) return o;
    if (a.explicitTravelId !== b.explicitTravelId) return a.explicitTravelId ? -1 : 1;
    if (a.id === SCENE_REGISTRY_FALLBACK_ID && b.id !== SCENE_REGISTRY_FALLBACK_ID) return 1;
    if (b.id === SCENE_REGISTRY_FALLBACK_ID && a.id !== SCENE_REGISTRY_FALLBACK_ID) return -1;
    return a.label.localeCompare(b.label, "zh-Hans-CN");
  });
  const seen = new Set<string>();
  const out: TravelLocationDefUi[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push({
      id: r.id,
      label: r.label,
      cgImageSrc: r.cgImageSrc,
      cardSummary: r.cardSummary,
    });
  }
  return out;
}
