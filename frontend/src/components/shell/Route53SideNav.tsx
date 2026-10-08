"use client";

import SideNavigation, { type SideNavigationProps } from "@cloudscape-design/components/side-navigation";
import { usePathname, useRouter } from "next/navigation";

const BASE = "/route53/v2";

/** Mirrors the Route 53 console's left navigation. Only hosted zones are fully implemented. */
const ITEMS: SideNavigationProps.Item[] = [
  { type: "link", text: "Dashboard", href: `${BASE}/dashboard` },
  { type: "link", text: "Hosted zones", href: `${BASE}/hostedzones` },
  { type: "link", text: "Health checks", href: `${BASE}/healthchecks` },
  { type: "link", text: "Profiles", href: `${BASE}/profiles` },
  {
    type: "section",
    text: "IP-based routing",
    items: [{ type: "link", text: "CIDR collections", href: `${BASE}/cidrcollections` }],
  },
  {
    type: "section",
    text: "Traffic flow",
    items: [
      { type: "link", text: "Traffic policies", href: `${BASE}/trafficpolicies` },
      { type: "link", text: "Policy records", href: `${BASE}/policyrecords` },
    ],
  },
  {
    type: "section",
    text: "Domains",
    items: [
      { type: "link", text: "Registered domains", href: `${BASE}/domains` },
      { type: "link", text: "Requests", href: `${BASE}/domains/requests` },
    ],
  },
  {
    type: "section",
    text: "Resolver",
    items: [
      { type: "link", text: "VPCs", href: `${BASE}/resolver/vpcs` },
      { type: "link", text: "Inbound endpoints", href: `${BASE}/resolver/inbound-endpoints` },
      { type: "link", text: "Outbound endpoints", href: `${BASE}/resolver/outbound-endpoints` },
      { type: "link", text: "Rules", href: `${BASE}/resolver/rules` },
      { type: "link", text: "Query logging", href: `${BASE}/resolver/query-logging` },
    ],
  },
  {
    type: "section",
    text: "DNS Firewall",
    items: [
      { type: "link", text: "Rule groups", href: `${BASE}/firewall/rule-groups` },
      { type: "link", text: "Domain lists", href: `${BASE}/firewall/domain-lists` },
    ],
  },
  { type: "divider" },
  {
    type: "link",
    text: "Application Recovery Controller",
    href: "https://console.aws.amazon.com/route53recovery/home",
    external: true,
  },
];

function activeHref(pathname: string): string {
  if (pathname.startsWith(`${BASE}/hostedzones`)) return `${BASE}/hostedzones`;
  return pathname;
}

export default function Route53SideNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SideNavigation
      header={{ text: "Route 53", href: `${BASE}/dashboard` }}
      activeHref={activeHref(pathname)}
      items={ITEMS}
      onFollow={(e) => {
        if (e.detail.external) return;
        e.preventDefault();
        router.push(e.detail.href);
      }}
    />
  );
}
