import fs from "fs";
import path from "path";

/**
 * 固化角色目录下 `cg_stand.png` 的公开 URL（相对 `public/characters/<folder>/`）。
 * `characterJson` 为磁盘上的 `card.json` 绝对路径。
 */
export function characterStandImageUrl(characterJsonAbs: string): string {
  const folder = path.basename(path.dirname(path.resolve(characterJsonAbs)));
  const rel = `/characters/${encodeURIComponent(folder)}/cg_stand.png`;
  const standAbs = path.join(path.dirname(path.resolve(characterJsonAbs)), "cg_stand.png");
  let v = 0;
  try {
    v = Math.floor(fs.statSync(standAbs).mtimeMs);
  } catch {
    /* ignore */
  }
  return v ? `${rel}?v=${v}` : rel;
}

/** 带 v=mtime 破坏缓存：同一路径文件被覆盖后 URL 变化，浏览器会重新拉取 */
export function cgPublicUrlFromDiskPath(absPath: string): string {
  const n = path.basename(absPath);
  let v = 0;
  try {
    v = Math.floor(fs.statSync(absPath).mtimeMs);
  } catch {
    /* ignore */
  }
  return `/api/cg-file?n=${encodeURIComponent(n)}&v=${v}`;
}
