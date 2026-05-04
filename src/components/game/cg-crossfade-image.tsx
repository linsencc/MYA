"use client";

import { useCgImageCrossfade } from "@/components/game/use-cg-image-crossfade";

/** CG 连续性：预加载后交叉淡化，避免硬切；与服务端 pending 时保留上一张配合 */
export function CgCrossfadeImage({ src }: { src: string | null }) {
  const { baseSrc, layer, onLayerTransitionEnd } = useCgImageCrossfade(src ?? "");

  return (
    <div className="relative w-full max-h-[min(38vh,320px)] overflow-hidden lg:max-h-none">
      {baseSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={baseSrc}
          alt="CG"
          className="relative z-0 block h-auto w-full max-h-[min(38vh,320px)] object-contain bg-transparent lg:max-h-[min(56vh,600px)]"
        />
      ) : (
        /* 加载前保持同等尺寸的透明占位，避免布局跳动 */
        <div
          aria-hidden
          className="relative z-0 block w-full max-h-[min(38vh,320px)] lg:max-h-[min(56vh,600px)]"
          style={{ aspectRatio: "9 / 16" }}
        />
      )}
      {layer ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={layer.src}
          alt=""
          className="pointer-events-none absolute left-0 top-0 z-10 h-full w-full max-h-[min(38vh,320px)] object-contain bg-transparent transition-opacity duration-500 ease-out lg:max-h-[min(56vh,600px)]"
          style={{ opacity: layer.visible ? 1 : 0 }}
          onTransitionEnd={onLayerTransitionEnd}
        />
      ) : null}
    </div>
  );
}
