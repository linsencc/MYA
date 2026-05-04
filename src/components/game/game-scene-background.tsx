"use client";

import { useCgImageCrossfade } from "@/components/game/use-cg-image-crossfade";

function SceneGradient() {
  return (
    <div
      className="fixed inset-0 z-0 min-h-100dvh w-full"
      style={{
        backgroundColor: "#0d1117",
        backgroundImage: [
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3CfeBlend in='SourceGraphic' mode='multiply'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E\")",
          "linear-gradient(165deg, #121820 0%, #0d1117 45%, #151c24 100%)",
        ].join(", "),
      }}
      aria-hidden
    />
  );
}

function SceneWithUrl({ src }: { src: string }) {
  const { baseSrc, layer, onLayerTransitionEnd } = useCgImageCrossfade(src);
  return (
    <div className="pointer-events-none fixed inset-0 z-0 h-dvh w-full min-h-100dvh max-w-none overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-slate-950" />
      {baseSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- 公开 URL 场景图
        <img
          src={baseSrc}
          alt=""
          className="absolute left-0 top-0 h-full w-full min-h-full min-w-full object-cover object-center"
          decoding="async"
        />
      ) : null}
      {layer ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={layer.src}
          alt=""
          className="absolute left-0 top-0 h-full w-full min-h-full min-w-full object-cover object-center transition-opacity duration-500 ease-out"
          style={{ opacity: layer.visible ? 1 : 0 }}
          onTransitionEnd={onLayerTransitionEnd}
          decoding="async"
        />
      ) : null}
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-transparent to-slate-950/80"
        aria-hidden
      />
    </div>
  );
}

/**
 * 全屏场景底图，object-fit: cover；`src` 为 null/空 时用深色渐变（不拉占位图）
 */
export function GameSceneBackground({ src }: { src: string | null }) {
  const u = src?.trim() ?? "";
  if (!u) return <SceneGradient />;
  return <SceneWithUrl key={u} src={u} />;
}
