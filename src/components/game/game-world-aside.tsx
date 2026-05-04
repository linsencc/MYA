"use client";

import { useEffect, useState } from "react";
import type { GameUiPayload } from "@/lib/game/contracts/game-ui";
import { CgCrossfadeImage } from "@/components/game/cg-crossfade-image";

function useLgBreakpoint(): boolean {
  const [lg, setLg] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setLg(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return lg;
}

const asideCardClass =
  "overflow-hidden rounded-2xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 to-slate-950/95 shadow-lg shadow-black/25 ring-1 ring-white/[0.04]";

export function GameWorldAside({ ui }: { ui: GameUiPayload }) {
  const lg = useLgBreakpoint();

  const inner = (
    <>
      <CgCrossfadeImage src={ui.cgImageSrc} />
      {ui.cgPendingPath ? (
        <p className="border-t border-slate-800/80 bg-slate-950/60 px-3 py-2 text-center text-xs text-sky-300/85">
          新 CG 生成中…
        </p>
      ) : null}
    </>
  );

  return (
    <aside className="order-2 flex min-w-0 flex-col gap-3 lg:order-1 lg:col-span-6 lg:col-start-1 lg:self-start lg:sticky lg:top-4">
      {lg ? (
        <div className={asideCardClass}>{inner}</div>
      ) : (
        <details className={asideCardClass}>
          <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-slate-200 marker:hidden [&::-webkit-details-marker]:hidden">
            <span className="text-sky-300/90">立绘</span>
            <span className="ml-2 text-xs font-normal text-slate-500">（点按展开 / 收起）</span>
          </summary>
          {inner}
        </details>
      )}
    </aside>
  );
}
