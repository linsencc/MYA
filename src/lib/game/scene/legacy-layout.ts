/**
 * 无 content/scenes 或加载失败时的布景与种子回退（与旧版硬编码一致）。
 */
export const LEGACY_LOCATION_LAYOUT_EN: Record<string, string> = {
  教室:
    "fixed anime classroom set: teacher podium front-left corner, large green chalkboard centered on back wall, " +
    "three tall windows only on right wall, wooden floor, four neat rows of student desks facing the board, " +
    "consistent single-point perspective, same wall colors and props every shot",
  放学后的教室:
    "fixed anime classroom set: teacher podium front-left corner, large green chalkboard centered on back wall, " +
    "three tall windows only on right wall, warm sunset light enters from those windows, wooden floor, " +
    "four neat rows of student desks facing the board, room empty and quiet, same geometry as prior classroom CGs",
  办公室:
    "fixed teacher office set: wooden desk centered on back wall, two tall bookshelves left and right, " +
    "frosted glass door on far left, rolling chair behind desk, papers and pen cup on desk, " +
    "overhead fluorescent strip, same layout every shot",
  图书馆:
    "fixed school library set: parallel tall bookshelves forming a central aisle, long reading tables midground, " +
    "large windows on left wall only, warm lamp pools on tables, quiet atmosphere, same aisle geometry",
  走廊:
    "fixed school hallway set: lockers continuous on right wall, classroom doors on left, long vanishing-point corridor, " +
    "linoleum floor with ceiling fluorescent tubes, same wall height and door spacing",
  家:
    "fixed protagonist apartment living set: casual sofa with game or study clutter, low coffee table, bookshelf with manga and textbooks, warm floor lamp, same footprint as player home living room",
  屋外:
    "fixed school grounds exterior: paved path, tree line on left, school building facade on right, " +
    "open sky, natural daylight, same path curve",
};

export const LEGACY_DEFAULT_LOCATION_LAYOUT_EN = "indoor background, soft ambient light";

const LEGACY_KEYS_SORTED = Object.keys(LEGACY_LOCATION_LAYOUT_EN).sort(
  (a, b) => b.length - a.length,
);

export function legacyResolveLayoutEn(location: string): string {
  const loc = location || "";
  for (const key of LEGACY_KEYS_SORTED) {
    if (loc.includes(key)) return LEGACY_LOCATION_LAYOUT_EN[key]!;
  }
  return LEGACY_DEFAULT_LOCATION_LAYOUT_EN;
}

/** 与旧 continuityLayoutSeed 中 location 段语义对齐的稳定标签 */
export function legacyLocationSeedTag(location: string): string {
  const loc = location || "";
  for (const key of LEGACY_KEYS_SORTED) {
    if (loc.includes(key)) return key;
  }
  return "home_living";
}
