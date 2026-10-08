"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { FlashbarProps } from "@cloudscape-design/components/flashbar";

export interface Notification {
  type: "success" | "error" | "info" | "warning" | "in-progress";
  header?: React.ReactNode;
  content?: React.ReactNode;
  /** Auto-dismiss after this many ms. Errors stay until dismissed. */
  timeout?: number;
}

interface NotificationsState {
  items: FlashbarProps.MessageDefinition[];
  notify: (n: Notification) => void;
  clear: () => void;
}

const NotificationsContext = createContext<NotificationsState | null>(null);
let counter = 0;

/**
 * Flash messages live above the page content (like the console) and survive client-side
 * navigation, so "Hosted zone created" still shows after redirecting to the new zone.
 */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([]);

  const dismiss = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), []);

  const notify = useCallback(
    (n: Notification) => {
      const id = `flash-${++counter}`;
      const item: FlashbarProps.MessageDefinition = {
        id,
        type: n.type,
        header: n.header,
        content: n.content,
        dismissible: true,
        dismissLabel: "Dismiss message",
        loading: n.type === "in-progress",
        onDismiss: () => dismiss(id),
      };
      setItems((prev) => [item, ...prev].slice(0, 5));
      const timeout = n.timeout ?? (n.type === "error" ? 0 : 8000);
      if (timeout > 0) setTimeout(() => dismiss(id), timeout);
    },
    [dismiss],
  );

  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, notify, clear }), [items, notify, clear]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsState {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationsProvider");
  return ctx;
}
