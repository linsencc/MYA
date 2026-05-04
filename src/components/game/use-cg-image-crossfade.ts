"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type TransitionEvent } from "react";

/** 预载后交叉淡入；与 CgCrossfadeImage 同逻辑，供全屏/立绘等多处复用 */
export function useCgImageCrossfade(targetSrc: string) {
  const isPlaceholder = !targetSrc?.trim() || targetSrc.includes("/api/game/placeholder");
  const target = isPlaceholder ? null : targetSrc.trim();
  const committedRef = useRef<string | null | undefined>(undefined);
  /** null = 尚未加载完任何图，显示透明占位；string = 已显示的真实图 */
  const [baseSrc, setBaseSrc] = useState<string | null>(null);
  const [layer, setLayer] = useState<{ src: string; visible: boolean } | null>(null);
  const loadGen = useRef(0);

  useEffect(() => {
    // target 未变 → 无需处理
    if (committedRef.current !== undefined && target === committedRef.current) return;
    // target 为 null（占位）→ 什么都不显示，清掉 layer
    if (target === null) {
      committedRef.current = null;
      setLayer(null);
      return;
    }
    const g = ++loadGen.current;
    const im = new Image();
    im.onload = () => {
      if (loadGen.current !== g) return;
      committedRef.current = target;
      if (baseSrc === null) {
        // 首次：直接淡入（从透明 → 不透明），不需要 crossfade layer
        setBaseSrc(target);
      } else {
        setLayer({ src: target, visible: false });
        requestAnimationFrame(() => {
          if (loadGen.current !== g) return;
          setLayer({ src: target, visible: true });
        });
      }
    };
    im.onerror = () => {
      if (loadGen.current !== g) return;
      committedRef.current = target;
      setBaseSrc(target);
      setLayer(null);
    };
    im.src = target;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const onLayerTransitionEnd = useCallback((e: TransitionEvent<HTMLImageElement>) => {
    if (e.propertyName !== "opacity") return;
    setLayer((cur) => {
      if (!cur?.visible) return cur;
      setBaseSrc(cur.src);
      return null;
    });
  }, []);

  return { baseSrc, layer, onLayerTransitionEnd, committedTarget: target };
}

export function crossfadeImageStyle(visible: boolean, extra: CSSProperties = {}): CSSProperties {
  return { ...extra, opacity: visible ? 1 : 0 };
}
