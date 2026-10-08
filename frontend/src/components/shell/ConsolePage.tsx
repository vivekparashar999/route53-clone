"use client";

import AppLayout, { type AppLayoutProps } from "@cloudscape-design/components/app-layout";
import BreadcrumbGroup, { type BreadcrumbGroupProps } from "@cloudscape-design/components/breadcrumb-group";
import Flashbar from "@cloudscape-design/components/flashbar";
import HelpPanel from "@cloudscape-design/components/help-panel";
import Link from "@cloudscape-design/components/link";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useState } from "react";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import Route53SideNav from "./Route53SideNav";

interface HelpContent {
  header: string;
  body: React.ReactNode;
}

const HelpContext = createContext<(content: HelpContent) => void>(() => {});

/** "Info" link that opens the right-hand help panel, like every console header. */
export function InfoLink({ header, body }: HelpContent) {
  const openHelp = useContext(HelpContext);
  return (
    <Link variant="info" onFollow={() => openHelp({ header, body })}>
      Info
    </Link>
  );
}

const DEFAULT_HELP: HelpContent = {
  header: "Amazon Route 53",
  body: (
    <p>
      Amazon Route 53 is a highly available and scalable Domain Name System (DNS) web service. Use hosted zones to
      manage the records that tell Route 53 how to route traffic for a domain and its subdomains.
    </p>
  ),
};

interface ConsolePageProps {
  breadcrumbs: BreadcrumbGroupProps.Item[];
  contentType?: AppLayoutProps.ContentType;
  splitPanel?: React.ReactNode;
  splitPanelOpen?: boolean;
  onSplitPanelToggle?: (open: boolean) => void;
  children: React.ReactNode;
}

export default function ConsolePage({
  breadcrumbs,
  contentType = "default",
  splitPanel,
  splitPanelOpen,
  onSplitPanelToggle,
  children,
}: ConsolePageProps) {
  const router = useRouter();
  const { items } = useNotifications();
  const [navigationOpen, setNavigationOpen] = useState(true);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [help, setHelp] = useState<HelpContent>(DEFAULT_HELP);
  const [splitPanelSize, setSplitPanelSize] = useState(420);
  const [splitPanelPreferences, setSplitPanelPreferences] = useState<AppLayoutProps.SplitPanelPreferences>({
    position: "side",
  });

  const openHelp = useCallback((content: HelpContent) => {
    setHelp(content);
    setToolsOpen(true);
  }, []);

  return (
    <HelpContext.Provider value={openHelp}>
      <AppLayout
        headerSelector="#console-header"
        contentType={contentType}
        navigation={<Route53SideNav />}
        navigationOpen={navigationOpen}
        onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
        tools={<HelpPanel header={<h2>{help.header}</h2>}>{help.body}</HelpPanel>}
        toolsOpen={toolsOpen}
        onToolsChange={({ detail }) => setToolsOpen(detail.open)}
        notifications={<Flashbar items={items} stackItems={items.length > 2} />}
        breadcrumbs={
          <BreadcrumbGroup
            items={breadcrumbs}
            ariaLabel="Breadcrumbs"
            onFollow={(e) => {
              e.preventDefault();
              router.push(e.detail.href);
            }}
          />
        }
        splitPanel={splitPanel}
        // Always controlled: switching from undefined to a boolean is ignored by AppLayout.
        splitPanelOpen={splitPanelOpen ?? false}
        splitPanelSize={splitPanelSize}
        onSplitPanelResize={({ detail }) => setSplitPanelSize(detail.size)}
        onSplitPanelToggle={({ detail }) => onSplitPanelToggle?.(detail.open)}
        splitPanelPreferences={splitPanelPreferences}
        onSplitPanelPreferencesChange={({ detail }) => setSplitPanelPreferences(detail)}
        content={children}
        ariaLabels={{
          navigation: "Route 53 navigation",
          navigationClose: "Close navigation",
          navigationToggle: "Open navigation",
          tools: "Help panel",
          toolsClose: "Close help panel",
          toolsToggle: "Open help panel",
          notifications: "Notifications",
        }}
      />
    </HelpContext.Provider>
  );
}

export const ROUTE53_CRUMB = { text: "Route 53", href: "/route53/v2/dashboard" };
export const HOSTED_ZONES_CRUMB = { text: "Hosted zones", href: "/route53/v2/hostedzones" };
