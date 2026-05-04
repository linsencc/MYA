import type { SceneRecord } from "@/lib/game/scene/types";

function joinLayouts(parts: string[]): string {
  return parts.map((p) => p.trim()).filter(Boolean).join(", ");
}

export function pickBackdropEn(
  scene: SceneRecord,
  timeOfDay: string,
  useExplicitVisual: boolean,
): string {
  const base =
    useExplicitVisual && (scene.layout_nsfw_en ?? "").trim()
      ? String(scene.layout_nsfw_en).trim()
      : String(scene.layout_pg_en ?? "").trim();
  const variant = (scene.variants_by_time ?? {})[timeOfDay] ?? "";
  return joinLayouts([base, String(variant).trim()]);
}
