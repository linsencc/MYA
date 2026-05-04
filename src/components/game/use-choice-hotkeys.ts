"use client";

import { useEffect, type RefObject } from "react";

/** 未聚焦输入框时，数字键 1–4 对应第 1–4 个非空选项 */
export function useChoiceHotkeys(opts: {
  enabled: boolean;
  loading: boolean;
  choices: string[];
  nonEmptyChoiceIndices: number[];
  customInputRef: RefObject<HTMLInputElement | null>;
  onStep: (choice: string) => void;
}): void {
  const { enabled, loading, choices, nonEmptyChoiceIndices, customInputRef, onStep } = opts;

  useEffect(() => {
    if (!enabled || loading) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof Node && customInputRef.current?.contains(el)) return;
      if (el instanceof HTMLElement) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
          return;
        }
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!/^[1-4]$/.test(e.key)) return;
      const slot = parseInt(e.key, 10) - 1;
      const choiceIdx = nonEmptyChoiceIndices[slot];
      if (choiceIdx === undefined) return;
      const c = choices[choiceIdx];
      if (!c?.trim()) return;
      e.preventDefault();
      onStep(c);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, loading, nonEmptyChoiceIndices, choices, customInputRef, onStep]);
}
