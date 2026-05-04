"use client";

import { useEffect } from "react";

const CLS = "mya-doc-scroll-y";

/** 仅在文档实际需要纵向滚动时为 html 启用 scrollbar-gutter: stable，避免无滚动时右侧空槽突兀。 */
export function DocScrollGutter() {
  useEffect(() => {
    const html = document.documentElement;
    let raf = 0;

    const update = () => {
      const sh = html.scrollHeight;
      const ch = html.clientHeight;
      const needsY = sh > ch + 0.5;
      html.classList.toggle(CLS, needsY);
    };

    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };

    schedule();
    const ro = new ResizeObserver(schedule);
    ro.observe(document.body);
    window.addEventListener("resize", schedule);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      html.classList.remove(CLS);
    };
  }, []);

  return null;
}
