"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import ContentLayout from "@cloudscape-design/components/content-layout";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ConsolePage, { InfoLink, ROUTE53_CRUMB } from "@/components/shell/ConsolePage";
import { api } from "@/lib/api";
import type { DashboardSummary } from "@/lib/types";

function Counter({ label, value, href }: { label: string; value: number | undefined; href: string }) {
  const router = useRouter();
  return (
    <div>
      <Box variant="awsui-key-label">{label}</Box>
      <Link
        variant="awsui-value-large"
        href={href}
        onFollow={(e) => {
          e.preventDefault();
          router.push(href);
        }}
      >
        {value ?? "-"}
      </Link>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    api.dashboard().then(setSummary).catch(() => setSummary(null));
  }, []);

  return (
    <ConsolePage breadcrumbs={[ROUTE53_CRUMB, { text: "Dashboard", href: "/route53/v2/dashboard" }]}>
      <ContentLayout
        header={
          <Header variant="h1" info={<InfoLink header="Route 53 dashboard" body={<p>An overview of the Route 53 resources in your account.</p>} />}>
            Route 53 Dashboard
          </Header>
        }
      >
        <SpaceBetween size="l">
          <ColumnLayout columns={2}>
            <Container
              header={
                <Header
                  variant="h2"
                  description="Create a hosted zone to route traffic for a domain you own."
                  actions={<Button onClick={() => router.push("/route53/v2/hostedzones/create")}>Create hosted zone</Button>}
                >
                  DNS management
                </Header>
              }
            >
              <ColumnLayout columns={2} variant="text-grid">
                <Counter label="Hosted zones" value={summary?.hosted_zones} href="/route53/v2/hostedzones" />
                <Counter label="Records" value={summary?.records} href="/route53/v2/hostedzones" />
              </ColumnLayout>
            </Container>
            <Container
              header={
                <Header variant="h2" description="Monitor the health of your resources and route traffic away from unhealthy ones.">
                  Availability monitoring
                </Header>
              }
            >
              <Counter label="Health checks" value={summary?.health_checks} href="/route53/v2/healthchecks" />
            </Container>
            <Container
              header={
                <Header variant="h2" description="Create traffic policies to route traffic across complex configurations.">
                  Traffic management
                </Header>
              }
            >
              <Counter label="Traffic policies" value={summary?.traffic_policies} href="/route53/v2/trafficpolicies" />
            </Container>
            <Container
              header={
                <Header variant="h2" description="Register a new domain name or transfer an existing one.">
                  Domain registration
                </Header>
              }
            >
              <Counter label="Registered domains" value={summary?.domains} href="/route53/v2/domains" />
            </Container>
          </ColumnLayout>
        </SpaceBetween>
      </ContentLayout>
    </ConsolePage>
  );
}
