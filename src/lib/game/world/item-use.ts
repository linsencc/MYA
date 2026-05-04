/**
 * 背包物品使用效果（表驱动）；新物品在此注册 id → 数值与叙事句。
 */

export type ItemUseContext = { itemId: string; displayName: string };

export type ItemUseResult = {
  trustDelta: number;
  coldWarDelta: number;
  paragraph: string;
  affectionDelta?: number;
  intimacyDelta?: number;
  desireDelta?: number;
  /** 仅故事注册表键，经 sanitize 后应用 */
  flagDeltaPatch?: Record<string, unknown>;
};

type ItemHandler = (ctx: ItemUseContext) => ItemUseResult;

const ITEM_HANDLERS: Record<string, ItemHandler> = {
  homework_folder: () => ({
    trustDelta: 1,
    coldWarDelta: 0,
    paragraph: "你把作业文件夹递到她视线里——她眼神稍软了一瞬，像是承认了你的认真。",
  }),
  instant_coffee: () => ({
    trustDelta: 2,
    coldWarDelta: -1,
    paragraph: "一杯速溶的热气升起，她的肩线肉眼可见地松了一点点。",
  }),
  sticky_notes: () => ({
    trustDelta: 1,
    coldWarDelta: 0,
    affectionDelta: 1,
    paragraph: "你在便利贴上写了一行端正的小字递过去——她看了一眼，嘴角极轻地扬了扬。",
  }),
  energy_drink: () => ({
    trustDelta: 0,
    coldWarDelta: 0,
    desireDelta: 2,
    intimacyDelta: 1,
    paragraph: "你把冰凉的罐装饮料放在她手边。她愣了愣，低声说了句「少喝这种」却没推开。",
  }),
};

export function tryResolveItemUse(ctx: ItemUseContext): ItemUseResult | null {
  const id = String(ctx.itemId ?? "").trim();
  const fn = ITEM_HANDLERS[id];
  if (!fn) return null;
  return fn(ctx);
}

export function knownUsableItemIds(): string[] {
  return Object.keys(ITEM_HANDLERS);
}
