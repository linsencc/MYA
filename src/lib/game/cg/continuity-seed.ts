/**
 * 同章节 + 同场景 id 复用噪声种子，配合固定布景文案拉齐连续镜头。
 */
export function continuityLayoutSeed(chapter: number, sceneId: string): number {
  const s = `${chapter}::${sceneId.trim()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = h >>> 0;
  return u % 0x7fffffff || 1;
}
