"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import CopyToClipboard from "@cloudscape-design/components/copy-to-clipboard";
import ExpandableSection from "@cloudscape-design/components/expandable-section";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import StatusIndicator from "@cloudscape-design/components/status-indicator";
import Table from "@cloudscape-design/components/table";
import Tabs from "@cloudscape-design/components/tabs";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import TableEmptyState from "@/components/common/TableEmptyState";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import DeleteRecordsModal from "@/components/records/DeleteRecordsModal";
import RecordDetailsPanel from "@/components/records/RecordDetailsPanel";
import RecordsTable from "@/components/records/RecordsTable";
import TestRecordModal from "@/components/records/TestRecordModal";
import ConsolePage, { HOSTED_ZONES_CRUMB, InfoLink, ROUTE53_CRUMB } from "@/components/shell/ConsolePage";
import DeleteZoneModal from "@/components/zones/DeleteZoneModal";
import { api, errorMessage } from "@/lib/api";
import { displayName } from "@/lib/records";
import type { DnsRecord, HostedZone } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });
}

export default function HostedZoneDetailPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();

  const [zone, setZone] = useState<HostedZone | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("records");
  const [recordTotal, setRecordTotal] = useState<number | null>(null);
  const [selected, setSelected] = useState<DnsRecord[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const [toDelete, setToDelete] = useState<DnsRecord[]>([]);
  const [deleteZoneOpen, setDeleteZoneOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [recordNames, setRecordNames] = useState<string[]>([]);

  const loadZone = useCallback(() => {
    api
      .getZone(zoneId)
      .then((z) => {
        setZone(z);
        setLoadError(null);
      })
      .catch((err) => setLoadError(errorMessage(err)));
  }, [zoneId]);

  useEffect(loadZone, [loadZone, reloadKey]);

  // Names for "Alias to another record in this hosted zone" suggestions.
  useEffect(() => {
    api
      .listRecords(zoneId, { page_size: 300 })
      .then((res) => setRecordNames([...new Set(res.items.map((r) => r.name))]))
      .catch(() => setRecordNames([]));
  }, [zoneId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const onSelectionChange = useCallback((records: DnsRecord[]) => {
    setSelected((prev) => {
      if (records.length > 0 && prev.length === 0) setSplitOpen(true);
      return records;
    });
  }, []);

  const openDetails = useCallback((record: DnsRecord) => {
    setSelected([record]);
    setSplitOpen(true);
  }, []);

  const exportZone = (format: "json" | "bind") => {
    const a = document.createElement("a");
    a.href = api.exportUrl(zoneId, format);
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    notify({ type: "success", content: `Exporting ${displayName(zone?.name ?? "")} as ${format === "bind" ? "a BIND zone file" : "JSON"}.` });
  };

  const breadcrumbs = [ROUTE53_CRUMB, HOSTED_ZONES_CRUMB, { text: zone ? displayName(zone.name) : zoneId, href: `/route53/v2/hostedzones/${zoneId}` }];

  if (loadError) {
    return (
      <ConsolePage breadcrumbs={breadcrumbs}>
        <Alert
          type="error"
          header="Hosted zone not found"
          action={<Button onClick={() => router.push("/route53/v2/hostedzones")}>Go to hosted zones</Button>}
        >
          {loadError}
        </Alert>
      </ConsolePage>
    );
  }

  if (!zone) {
    return (
      <ConsolePage breadcrumbs={breadcrumbs}>
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </ConsolePage>
    );
  }

  const name = displayName(zone.name);
  const count = recordTotal ?? zone.record_count;

  return (
    <ConsolePage
      breadcrumbs={breadcrumbs}
      contentType="default"
      splitPanelOpen={activeTab === "records" && splitOpen}
      onSplitPanelToggle={setSplitOpen}
      splitPanel={
        activeTab === "records" ? (
          <RecordDetailsPanel
            zone={zone}
            selected={selected}
            zoneRecordNames={recordNames}
            onDelete={setToDelete}
            onSaved={(r) => {
              notify({ type: "success", content: `Record ${r.name} was successfully updated.` });
              reload();
            }}
          />
        ) : undefined
      }
    >
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description={zone.type === "public" ? "Public hosted zone" : "Private hosted zone"}
          info={
            <InfoLink
              header="Hosted zone"
              body={<p>Use this page to view and manage the records in the {name} hosted zone.</p>}
            />
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button onClick={() => setDeleteZoneOpen(true)}>Delete zone</Button>
              <Button onClick={() => setTestOpen(true)}>Test record</Button>
              <Button
                onClick={() =>
                  notify({
                    type: "info",
                    header: "Query logging",
                    content: "Configuring query logging requires CloudWatch Logs, which this clone mocks. Coming soon.",
                  })
                }
              >
                Configure query logging
              </Button>
            </SpaceBetween>
          }
        >
          {name}
        </Header>

        <ExpandableSection
          variant="container"
          defaultExpanded={false}
          headerText="Hosted zone details"
          headerActions={<Button onClick={() => router.push(`/route53/v2/hostedzones/${zone.id}/edit`)}>Edit hosted zone</Button>}
        >
          <KeyValuePairs
            columns={3}
            items={[
              { label: "Hosted zone name", value: name },
              {
                label: "Hosted zone ID",
                value: (
                  <CopyToClipboard
                    variant="inline"
                    textToCopy={zone.id}
                    copySuccessText="Hosted zone ID copied"
                    copyErrorText="Failed to copy"
                  />
                ),
              },
              { label: "Description", value: zone.comment || "-" },
              { label: "Type", value: zone.type === "public" ? "Public hosted zone" : "Private hosted zone" },
              { label: "Record count", value: String(count) },
              { label: "Query log", value: "-" },
              {
                label: "Name servers",
                value: zone.name_servers.length ? (
                  <Box variant="span">
                    {zone.name_servers.map((ns) => (
                      <div key={ns}>{ns}</div>
                    ))}
                  </Box>
                ) : (
                  "-"
                ),
              },
              ...(zone.type === "private"
                ? [{ label: "VPCs", value: zone.vpcs.map((v) => `${v.vpc_id} (${v.region})`).join(", ") || "-" }]
                : []),
              { label: "Created by", value: zone.created_by },
              { label: "Created", value: formatDate(zone.created_at) },
            ]}
          />
        </ExpandableSection>

        <Tabs
          activeTabId={activeTab}
          onChange={({ detail }) => setActiveTab(detail.activeTabId)}
          tabs={[
            {
              id: "records",
              label: `Records (${count})`,
              content: (
                <RecordsTable
                  zone={zone}
                  reloadKey={reloadKey}
                  selected={selected}
                  onSelectionChange={onSelectionChange}
                  onDelete={setToDelete}
                  onOpenDetails={openDetails}
                  onTotalChange={setRecordTotal}
                  onReload={reload}
                  onExport={exportZone}
                />
              ),
            },
            {
              id: "dnssec",
              label: "DNSSEC signing",
              content: (
                <Container
                  header={
                    <Header
                      variant="h2"
                      actions={
                        <Button disabled={zone.type === "private"} onClick={() => notify({ type: "info", content: "DNSSEC signing is mocked in this clone. Coming soon." })}>
                          Enable DNSSEC signing
                        </Button>
                      }
                    >
                      DNSSEC signing
                    </Header>
                  }
                >
                  <KeyValuePairs
                    columns={2}
                    items={[
                      { label: "DNSSEC signing status", value: <StatusIndicator type="stopped">Not signing</StatusIndicator> },
                      { label: "Key-signing keys (KSKs)", value: "-" },
                    ]}
                  />
                </Container>
              ),
            },
            {
              id: "tags",
              label: `Hosted zone tags (${zone.tags.length})`,
              content: (
                <Table
                  variant="container"
                  items={zone.tags}
                  trackBy="key"
                  header={
                    <Header
                      variant="h2"
                      counter={`(${zone.tags.length})`}
                      actions={<Button onClick={() => router.push(`/route53/v2/hostedzones/${zone.id}/edit`)}>Manage tags</Button>}
                    >
                      Tags
                    </Header>
                  }
                  columnDefinitions={[
                    { id: "key", header: "Key", cell: (t) => t.key },
                    { id: "value", header: "Value", cell: (t) => t.value || "-" },
                  ]}
                  empty={<TableEmptyState title="No tags" subtitle="No tags associated with the resource." />}
                />
              ),
            },
          ]}
        />
      </SpaceBetween>

      <DeleteRecordsModal
        zoneId={zone.id}
        records={toDelete}
        visible={toDelete.length > 0}
        onDismiss={() => setToDelete([])}
        onDeleted={(n) => {
          setToDelete([]);
          setSelected([]);
          notify({ type: "success", content: `${n} ${n === 1 ? "record was" : "records were"} successfully deleted.` });
          reload();
        }}
      />
      <DeleteZoneModal
        zone={deleteZoneOpen ? zone : null}
        onDismiss={() => setDeleteZoneOpen(false)}
        onDeleted={(z) => {
          notify({ type: "success", content: `Hosted zone ${displayName(z.name)} was successfully deleted.` });
          router.push("/route53/v2/hostedzones");
        }}
      />
      <TestRecordModal zone={zone} visible={testOpen} onDismiss={() => setTestOpen(false)} />
    </ConsolePage>
  );
}
