/**
 * 固定布景：优先 `content/scenes`（`scenes/<id>/<id>.json` 或根目录 `<id>.json`），失败时回退 {@link legacyResolveLayoutEn}。
 */
import { pickBackdropEn } from "@/lib/game/scene/backdrop";
import {
  LEGACY_DEFAULT_LOCATION_LAYOUT_EN,
  LEGACY_LOCATION_LAYOUT_EN,
  legacyLocationSeedTag,
  legacyResolveLayoutEn,
} from "@/lib/game/scene/legacy-layout";
import { getSceneRegistry, resolveScene } from "@/lib/game/scene/registry";

/** @deprecated 新代码请用 content/scenes；保留导出供脚本或外部引用 */
export const LOCATION_LAYOUT_EN = LEGACY_LOCATION_LAYOUT_EN;
export const DEFAULT_LOCATION_LAYOUT_EN = LEGACY_DEFAULT_LOCATION_LAYOUT_EN;

export type ResolveLocationLayoutOptions = {
  sceneDir?: string;
  timeOfDay?: string;
  useExplicitVisual?: boolean;
};

export function resolveLocationLayoutEn(
  location: string,
  opt?: ResolveLocationLayoutOptions,
): string {
  const sceneDir = opt?.sceneDir?.trim();
  if (sceneDir) {
    const reg = getSceneRegistry(sceneDir);
    if (reg && reg.scenesById.size > 0) {
      const { scene } = resolveScene(location, reg);
      const s = pickBackdropEn(scene, opt?.timeOfDay ?? "", opt?.useExplicitVisual ?? false);
      if (s) return s;
    }
  }
  return legacyResolveLayoutEn(location);
}

export { legacyLocationSeedTag };
