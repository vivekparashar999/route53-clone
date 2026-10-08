"use client";

import { useEffect, useRef } from "react";

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function modalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}

/**
 * Register a single-key shortcut (e.g. "c", "/", "?"). Two-key sequences such as "g h" are
 * supported by passing the space-separated keys. Ignored while typing or when a modal is open.
 */
export function useShortcut(keys: string, handler: () => void, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const sequence = keys.split(" ");
    let position = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || modalOpen()) return;
      if (e.key === sequence[position]) {
        position += 1;
        clearTimeout(timer);
        if (position === sequence.length) {
          position = 0;
          e.preventDefault();
          handlerRef.current();
        } else {
          timer = setTimeout(() => (position = 0), 1000);
        }
      } else {
        position = e.key === sequence[0] ? 1 : 0;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, [keys, enabled]);
}

/** Focus the first filter input on the page (the one marked with data-shortcut="filter"). */
export function focusFilter() {
  const input = document.querySelector<HTMLInputElement>('[data-shortcut="filter"] input');
  input?.focus();
}

export const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ["/"], description: "Focus the search / filter box" },
  { keys: ["c"], description: "Create a hosted zone or record (on list pages)" },
  { keys: ["r"], description: "Refresh the current table" },
  { keys: ["i"], description: "Import zone file (inside a hosted zone)" },
  { keys: ["g", "h"], description: "Go to Hosted zones" },
  { keys: ["g", "d"], description: "Go to Dashboard" },
  { keys: ["t"], description: "Toggle dark mode" },
  { keys: ["?"], description: "Show keyboard shortcuts" },
];
