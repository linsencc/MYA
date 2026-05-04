"use client";

const LABEL: Record<string, string> = {
  shop: "购买",
  library: "图书馆",
  cafe: "咖啡",
  classroom: "课堂",
  generic: "行动",
};

export function SceneActionBar({
  affordanceIds,
  onAffordance,
  disabled,
}: {
  affordanceIds: string[];
  onAffordance: (id: string) => void;
  disabled: boolean;
}) {
  if (!affordanceIds.length) return null;
  return (
    <div
      className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 px-2 py-1.5"
      role="toolbar"
      aria-label="场景能力"
    >
      {affordanceIds.map((id) => {
        const isShop = id === "shop";
        const isPlaceholder = !isShop;
        return (
          <button
            key={id}
            type="button"
            disabled={disabled || isPlaceholder}
            title={isPlaceholder ? "即将开放" : undefined}
            className="rounded-lg border border-slate-600/80 bg-slate-900/75 px-3 py-1.5 text-xs font-medium text-slate-100 shadow-sm backdrop-blur-sm transition hover:border-sky-500/45 hover:bg-slate-800/80 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => onAffordance(id)}
          >
            {LABEL[id] ?? id}
          </button>
        );
      })}
    </div>
  );
}
