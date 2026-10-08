"use client";

import TopNavigation from "@cloudscape-design/components/top-navigation";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";

function formatAccount(id: string): string {
  return id.replace(/^(\d{4})(\d{4})(\d{4})$/, "$1-$2-$3");
}

export default function ConsoleTopNav({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { mode, setMode, density, setDensity } = useTheme();
  const account = user ? formatAccount(user.account_id) : "";

  return (
    <TopNavigation
      identity={{
        href: "/route53/v2/hostedzones",
        logo: { src: "/aws-logo.svg", alt: "Amazon Web Services" },
        onFollow: (e) => {
          e.preventDefault();
          router.push("/route53/v2/hostedzones");
        },
      }}
      search={
        <input
          aria-label="Search"
          placeholder="Search                                                        [Alt+S]"
          className="console-search"
          style={{
            width: "100%",
            boxSizing: "border-box",
            height: 32,
            borderRadius: 8,
            border: "1px solid #8c8c94",
            background: "#0f141a",
            color: "#fff",
            padding: "0 12px",
            fontSize: 14,
          }}
        />
      }
      utilities={[
        { type: "button", iconName: "script", ariaLabel: "CloudShell", title: "CloudShell" },
        { type: "button", iconName: "notification", ariaLabel: "Notifications", title: "Notifications", badge: false },
        {
          type: "menu-dropdown",
          iconName: "support",
          ariaLabel: "Support",
          title: "Support",
          items: [
            { id: "shortcuts", text: "Keyboard shortcuts" },
            { id: "docs", text: "Documentation", href: "https://docs.aws.amazon.com/route53/", external: true },
          ],
          onItemClick: ({ detail }) => {
            if (detail.id === "shortcuts") onShowShortcuts();
          },
        },
        {
          type: "menu-dropdown",
          iconName: "settings",
          ariaLabel: "Settings",
          title: "Settings",
          items: [
            {
              id: "visual-mode",
              text: "Visual mode",
              items: [
                { id: "mode-light", text: `Light${mode === "light" ? " ✓" : ""}` },
                { id: "mode-dark", text: `Dark${mode === "dark" ? " ✓" : ""}` },
              ],
            },
            {
              id: "density",
              text: "Density",
              items: [
                { id: "density-comfortable", text: `Comfortable${density === "comfortable" ? " ✓" : ""}` },
                { id: "density-compact", text: `Compact${density === "compact" ? " ✓" : ""}` },
              ],
            },
          ],
          onItemClick: ({ detail }) => {
            if (detail.id === "mode-light") setMode("light");
            if (detail.id === "mode-dark") setMode("dark");
            if (detail.id === "density-comfortable") setDensity("comfortable");
            if (detail.id === "density-compact") setDensity("compact");
          },
        },
        { type: "button", text: "Global", ariaLabel: "Region: Global" },
        {
          type: "menu-dropdown",
          text: user ? `${user.username} @ ${account}` : "",
          description: user ? `Account ID: ${account}` : undefined,
          iconName: "user-profile",
          items: [
            { id: "account", text: `Account ID: ${account}`, disabled: true },
            { id: "iam-user", text: `IAM user: ${user?.username ?? ""}`, disabled: true },
            { id: "signout", text: "Sign out" },
          ],
          onItemClick: async ({ detail }) => {
            if (detail.id === "signout") {
              await logout();
              router.replace("/signin");
            }
          },
        },
      ]}
      i18nStrings={{ overflowMenuTriggerText: "More", overflowMenuTitleText: "All" }}
    />
  );
}
