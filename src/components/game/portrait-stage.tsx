"use client";

import type { GameCastEntry } from "@/lib/game/contracts/game-ui";
import { useCgImageCrossfade } from "@/components/game/use-cg-image-crossfade";

/** 单角色立绘槽，独立持有 crossfade 状态 */
function PortraitSlot({
  entry,
  pending,
}: {
  entry: GameCastEntry;
  pending: string | null | undefined;
}) {
  const { baseSrc, layer, onLayerTransitionEnd } = useCgImageCrossfade(entry.portraitSrc ?? "");

  return (
    <div className="relative w-full min-h-[20vh] max-w-[min(50vw,420px)] lg:max-w-[min(32vw,480px)]">
      <div className="relative w-full" style={{ maxHeight: "min(50vh, 480px)" }}>
        {baseSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={baseSrc}
            alt={entry.displayName}
            className="mx-auto h-auto w-full object-contain object-bottom drop-shadow-2xl"
          />
        ) : (
          <div aria-hidden style={{ aspectRatio: "9 / 16" }} />
        )}
        {layer ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={layer.src}
            alt=""
            className="pointer-events-none absolute bottom-0 left-0 h-full w-full object-contain object-bottom transition-opacity duration-500 ease-out"
            style={{ opacity: layer.visible ? 1 : 0 }}
            onTransitionEnd={onLayerTransitionEnd}
          />
        ) : null}
      </div>
      {pending ? (
        <p className="mt-1 rounded bg-slate-950/70 px-1 py-0.5 text-center text-[10px] text-sky-300/85">
          {entry.displayName} CG 生成中…
        </p>
      ) : null}
    </div>
  );
}

/**
 * 三格立绘舞台；cast 中每个角色占一个 slot（left/center/right）。
 * 每个槽独立持有 crossfade 状态，互不干扰。
 */
export function PortraitStage({
  cast,
  cgPendingPath,
  pendingCgMap,
}: {
  cast: GameCastEntry[];
  cgPendingPath: string | null;
  pendingCgMap?: Record<string, string | null>;
}) {
  const slots: Array<"left" | "center" | "right"> = ["left", "center", "right"];

  return (
    <div className="pointer-events-none relative z-[2] flex min-h-[32vh] w-full flex-1 select-none items-end justify-center lg:min-h-0 lg:flex-[1.1]">
      <div className="grid w-full max-w-4xl grid-cols-3 items-end justify-items-center gap-2 px-2">
        {slots.map((slot) => {
          const entry = cast.find((c) => c.slot === slot);
          if (!entry) {
            return <div key={slot} className="hidden w-full max-w-[16vw] lg:block" aria-hidden />;
          }
          const pending = pendingCgMap
            ? pendingCgMap[entry.characterId]
            : slot === "left"
              ? cgPendingPath
              : null;
          return <PortraitSlot key={entry.characterId} entry={entry} pending={pending} />;
        })}
      </div>
      {/* Legacy single-char pending indicator (backward compat) */}
      {!pendingCgMap && cgPendingPath ? (
        <p className="pointer-events-auto absolute bottom-1 left-1/2 z-[3] w-[min(100%,20rem)] -translate-x-1/2 rounded-md border border-sky-800/60 bg-slate-950/80 px-2 py-1 text-center text-xs text-sky-300/90">
          新 CG 生成中…
        </p>
      ) : null}
    </div>
  );
}
