/**
 * 场景静态资源 URL 构造（纯字符串，无 Node.js 依赖，客户端/服务端均可用）。
 *
 * 命名约定：`/scenes/<id>/bg_<id>[_time_<token>|_weather_<token>].png`
 * 与磁盘布局 `public/scenes/<id>/bg_<id>.png` 一一对应。
 * 同逻辑见 `src/lib/game/adapters/scene-bg/index.ts` 的 `sceneBgSafeId`（服务端专用）。
 */

const SCENE_BASE = "/scenes";

function safeId(sceneId: string): string {
  return sceneId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "default";
}

/** 场景默认底图 URL：`/scenes/<id>/bg_<id>.png` */
export function sceneCgDefaultUrl(sceneId: string): string {
  const id = safeId(sceneId);
  return `${SCENE_BASE}/${id}/bg_${id}.png`;
}

/** 场景时段变体 URL：`/scenes/<id>/bg_<id>_time_<timeToken>.png` */
export function sceneCgTimeVariantUrl(sceneId: string, timeToken: string): string {
  const id = safeId(sceneId);
  return `${SCENE_BASE}/${id}/bg_${id}_time_${timeToken}.png`;
}

/** 场景天气变体 URL：`/scenes/<id>/bg_<id>_weather_<weatherToken>.png` */
export function sceneCgWeatherUrl(sceneId: string, weatherToken: string): string {
  const id = safeId(sceneId);
  return `${SCENE_BASE}/${id}/bg_${id}_weather_${weatherToken}.png`;
}
