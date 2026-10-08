"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useParams, useRouter } from "next/navigation";
import ConsolePage, { ROUTE53_CRUMB } from "@/components/shell/ConsolePage";

/** Titles for the sections that are placeholders in this clone. */
const SECTIONS: Record<string, string> = {
  healthchecks: "Health checks",
  profiles: "Profiles",
  cidrcollections: "CIDR collections",
  trafficpolicies: "Traffic policies",
  policyrecords: "Policy records",
  domains: "Registered domains",
  "domains/requests": "Requests",
  "resolver/vpcs": "Resolver VPCs",
  "resolver/inbound-endpoints": "Inbound endpoints",
  "resolver/outbound-endpoints": "Outbound endpoints",
  "resolver/rules": "Rules",
  "resolver/query-logging": "Query logging",
  "firewall/rule-groups": "Rule groups",
  "firewall/domain-lists": "Domain lists",
};

export default function ComingSoonPage() {
  const { section } = useParams<{ section: string[] }>();
  const router = useRouter();
  const path = section.join("/");
  const title = SECTIONS[path] ?? "Page not found";

  return (
    <ConsolePage breadcrumbs={[ROUTE53_CRUMB, { text: title, href: `/route53/v2/${path}` }]}>
      <ContentLayout header={<Header variant="h1">{title}</Header>}>
        <Container>
          <Box textAlign="center" padding={{ vertical: "xxxl" }}>
            <SpaceBetween size="m">
              <Box variant="h2" fontSize="heading-l">
                {SECTIONS[path] ? "Coming soon" : "This page doesn't exist"}
              </Box>
              <Box color="text-body-secondary">
                {SECTIONS[path]
                  ? `${title} isn't available in this Route 53 clone yet. Hosted zones and DNS records are fully supported.`
                  : "Check the URL, or go back to your hosted zones."}
              </Box>
              <Button variant="primary" onClick={() => router.push("/route53/v2/hostedzones")}>
                Go to hosted zones
              </Button>
            </SpaceBetween>
          </Box>
        </Container>
      </ContentLayout>
    </ConsolePage>
  );
}
