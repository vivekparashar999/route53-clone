"use client";

import Box from "@cloudscape-design/components/box";
import Modal from "@cloudscape-design/components/modal";
import Spinner from "@cloudscape-design/components/spinner";
import Table from "@cloudscape-design/components/table";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import ConsoleTopNav from "@/components/shell/ConsoleTopNav";
import { focusFilter, SHORTCUTS, useShortcut } from "@/lib/useShortcut";

/** Authenticated console shell: guards the session, renders the top nav and global shortcuts. */
export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { mode, setMode } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace(`/signin?redirect=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);

  useShortcut("?", () => setShortcutsOpen(true));
  useShortcut("/", focusFilter);
  useShortcut("g h", () => router.push("/route53/v2/hostedzones"));
  useShortcut("g d", () => router.push("/route53/v2/dashboard"));
  useShortcut("t", () => setMode(mode === "dark" ? "light" : "dark"));

  if (loading || !user) {
    return (
      <Box textAlign="center" padding={{ top: "xxxl" }}>
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <>
      <div id="console-header">
        <ConsoleTopNav onShowShortcuts={() => setShortcutsOpen(true)} />
      </div>
      {children}
      <Modal visible={shortcutsOpen} onDismiss={() => setShortcutsOpen(false)} header="Keyboard shortcuts">
        <Table
          variant="embedded"
          items={SHORTCUTS}
          columnDefinitions={[
            {
              id: "keys",
              header: "Shortcut",
              cell: (s) => (
                <span>
                  {s.keys.map((k, i) => (
                    <span key={k + i}>
                      {i > 0 && " then "}
                      <kbd className="shortcut">{k}</kbd>
                    </span>
                  ))}
                </span>
              ),
            },
            { id: "description", header: "Action", cell: (s) => s.description },
          ]}
        />
      </Modal>
    </>
  );
}
