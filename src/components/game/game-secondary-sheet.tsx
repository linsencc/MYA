"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function GameSecondarySheet({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      el?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="关闭"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={`relative z-10 max-h-[min(90dvh,720px)] w-full overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-600/80 bg-slate-900/95 p-4 shadow-2xl ring-1 ring-white/[0.06] ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-base font-semibold text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            className="rounded border border-slate-600/80 bg-slate-800/80 px-2.5 py-1 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
