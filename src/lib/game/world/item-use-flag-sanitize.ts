import { STORY_FLAG_REGISTRY } from "@/lib/game/content/story-flags";

const ALLOWED = new Set(STORY_FLAG_REGISTRY.map((e) => e.key));

/**
 * 物品使用效果中的 flag 补丁：仅允许故事注册表键，值 boolean | number | string。
 */
export function sanitizeItemUseFlagDelta(raw: Record<string, unknown> | undefined | null): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [k0, v] of Object.entries(raw)) {
    const k = k0.slice(0, 48);
    if (!k || !ALLOWED.has(k)) continue;
    if (typeof v === "boolean" || typeof v === "number") {
      out[k] = v;
    } else if (typeof v === "string") {
      out[k] = v.slice(0, 200);
    }
  }
  return out;
}
