import path from "path";

import { repoRoot } from "@/lib/paths";

/** 浏览器访问的场景 CG 根路径（对应 `public/scenes/`） */
export const SCENE_CG_PUBLIC_BASE = "/scenes";

export function sceneCgPublicUrl(basename: string): string {
  const safe = basename.replace(/^\/+/, "");
  return `${SCENE_CG_PUBLIC_BASE}/${safe}`;
}

/** 场景静态资源路径构造（纯字符串，客户端/服务端均可）——重导出自 `scene-url.ts` */
export { sceneCgDefaultUrl, sceneCgTimeVariantUrl, sceneCgWeatherUrl } from "@/lib/game/cg/scene-url";

/** 仓库内 `public/scenes` 绝对路径 */
export function publicSceneCgDirAbs(): string {
  return path.join(repoRoot(), "public", "scenes");
}

/** 仓库内 `public/characters` 绝对路径 */
export function publicCharacterCgDirAbs(): string {
  return path.join(repoRoot(), "public", "characters");
}
