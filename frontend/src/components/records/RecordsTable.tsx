"use client";

import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import Select, { type SelectProps } from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import TextFilter from "@cloudscape-design/components/text-filter";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TableEmptyState from "@/components/common/TableEmptyState";
import { InfoLink } from "@/components/shell/ConsolePage";
import { api } from "@/lib/api";
import { differentiator, RECORD_TYPES, ROUTING_POLICIES, ROUTING_POLICY_LABEL } from "@/lib/records";
import type { DnsRecord, HostedZone } from "@/lib/types";
import { usePersistentState } from "@/lib/usePersistentState";
import { useShortcut } from "@/lib/useShortcut";

const ALL_TYPES: SelectProps.Option = { value: "", label: "Type" };
const ALL_POLICIES: SelectProps.Option = { value: "", label: "Routing policy" };
const ALL_ALIAS: SelectProps.Option = { value: "", label: "Alias" };

const TYPE_OPTIONS: SelectProps.Option[] = [
  { value: "", label: "All record types" },
  ...[...RECORD_TYPES.map((t) => t.value), "SOA"].sort().map((t) => ({ value: t, label: t })),
];
const POLICY_OPTIONS: SelectProps.Option[] = [
  { value: "", label: "All routing policies" },
  ...ROUTING_POLICIES.map((p) => ({ value: p.value, label: ROUTING_POLICY_LABEL[p.value] })),
];
const ALIAS_OPTIONS: SelectProps.Option[] = [
  { value: "", label: "All aliases" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

const COLUMN_IDS = [
  "name",
  "type",
  "routing_policy",
  "differentiator",
  "alias",
  "value",
  "ttl",
  "health_check_id",
  "evaluate_target_health",
  "set_identifier",
];

interface Prefs {
  pageSize: number;
  wrapLines: boolean;
  stripedRows: boolean;
  visibleContent: string[];
}

const DEFAULT_PREFS: Prefs = {
  pageSize: 25,
  wrapLines: true,
  stripedRows: false,
  visibleContent: COLUMN_IDS,
};

interface Props {
  zone: HostedZone;
  reloadKey: number;
  selected: DnsRecord[];
  onSelectionChange: (records: DnsRecord[]) => void;
  onDelete: (records: DnsRecord[]) => void;
  onOpenDetails: (record: DnsRecord) => void;
  onTotalChange: (total: number) => void;
  onReload: () => void;
  onExport: (format: "json" | "bind") => void;
}

export default function RecordsTable({
  zone,
  reloadKey,
  selected,
  onSelectionChange,
  onDelete,
  onOpenDetails,
  onTotalChange,
  onReload,
  onExport,
}: Props) {
  const router = useRouter();
  const [prefs, setPrefs] = usePersistentState<Prefs>("r53.recordsTablePrefs", DEFAULT_PREFS);
  const [items, setItems] = useState<DnsRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filterText, setFilterText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [type, setType] = useState<SelectProps.Option>(ALL_TYPES);
  const [policy, setPolicy] = useState<SelectProps.Option>(ALL_POLICIES);
  const [alias, setAlias] = useState<SelectProps.Option>(ALL_ALIAS);
  const [sorting, setSorting] = useState<{ field?: string; descending: boolean }>({ descending: false });

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(filterText.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filterText]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listRecords(zone.id, {
        q: debounced,
        type: type.value,
        routing_policy: policy.value,
        alias: alias.value,
        page,
        page_size: prefs.pageSize,
        sort: sorting.field,
        order: sorting.descending ? "desc" : "asc",
      })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
        setError(null);
        // Keep the selection pointing at fresh objects (so the details panel shows saved values).
        onSelectionChange(res.items.filter((r) => selected.some((s) => s.id === r.id)));
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // `selected` is deliberately excluded: re-fetching on every selection change would be wasteful.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.id, debounced, type, policy, alias, page, prefs.pageSize, sorting, reloadKey]);

  useEffect(() => {
    // The tab counter shows the unfiltered total.
    if (!debounced && !type.value && !policy.value && !alias.value) onTotalChange(total);
  }, [total, debounced, type, policy, alias, onTotalChange]);

  const createHref = `/route53/v2/hostedzones/${zone.id}/records/create`;
  const importHref = `/route53/v2/hostedzones/${zone.id}/import`;
  useShortcut("c", () => router.push(createHref));
  useShortcut("i", () => router.push(importHref));
  useShortcut("r", onReload);

  const filtered = Boolean(debounced || type.value || policy.value || alias.value);
  const clearFilters = () => {
    setFilterText("");
    setDebounced("");
    setType(ALL_TYPES);
    setPolicy(ALL_POLICIES);
    setAlias(ALL_ALIAS);
    setPage(1);
  };

  const columns: TableProps.ColumnDefinition<DnsRecord>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Record name",
        sortingField: "name",
        isRowHeader: true,
        width: 240,
        cell: (r) => (
          <Link onFollow={() => onOpenDetails(r)} ariaLabel={`Record details for ${r.name} ${r.type}`}>
            {r.name}
          </Link>
        ),
      },
      { id: "type", header: "Type", sortingField: "type", width: 90, cell: (r) => r.type },
      {
        id: "routing_policy",
        header: "Routing policy",
        sortingField: "routing_policy",
        width: 150,
        cell: (r) => ROUTING_POLICY_LABEL[r.routing_policy],
      },
      { id: "differentiator", header: "Differentiator", width: 140, cell: differentiator },
      { id: "alias", header: "Alias", width: 90, cell: (r) => (r.alias ? "Yes" : "No") },
      {
        id: "value",
        header: "Value/Route traffic to",
        width: 340,
        minWidth: 200,
        cell: (r) => <span className="value-cell">{r.alias && r.alias_target ? r.alias_target.dns_name : r.values.join("\n")}</span>,
      },
      { id: "ttl", header: "TTL (seconds)", sortingField: "ttl", width: 140, cell: (r) => r.ttl ?? "-" },
      { id: "health_check_id", header: "Health check ID", width: 170, cell: (r) => r.health_check_id ?? "-" },
      {
        id: "evaluate_target_health",
        header: "Evaluate target health",
        width: 190,
        cell: (r) => (r.alias && r.alias_target ? (r.alias_target.evaluate_target_health ? "Yes" : "No") : "-"),
      },
      { id: "set_identifier", header: "Record ID", width: 160, cell: (r) => r.set_identifier ?? "-" },
    ],
    [onOpenDetails],
  );

  const columnDisplay = COLUMN_IDS.map((id) => ({ id, visible: prefs.visibleContent.includes(id) }));

  return (
    <Table
      variant="container"
      resizableColumns
      loading={loading}
      loadingText="Loading records"
      items={items}
      trackBy="id"
      columnDefinitions={columns}
      columnDisplay={columnDisplay}
      wrapLines={prefs.wrapLines}
      stripedRows={prefs.stripedRows}
      selectionType="multi"
      selectedItems={selected}
      onSelectionChange={({ detail }) => onSelectionChange(detail.selectedItems)}
      ariaLabels={{
        selectionGroupLabel: "Record selection",
        allItemsSelectionLabel: () => "Select all records on this page",
        itemSelectionLabel: (_, r) => `${r.name} ${r.type}`,
      }}
      sortingColumn={sorting.field ? { sortingField: sorting.field } : undefined}
      sortingDescending={sorting.descending}
      onSortingChange={({ detail }) => {
        setSorting({ field: detail.sortingColumn.sortingField, descending: detail.isDescending ?? false });
        setPage(1);
      }}
      header={
        <Header
          variant="h2"
          counter={selected.length ? `(${selected.length}/${total})` : `(${total})`}
          info={
            <InfoLink
              header="Records"
              body={
                <p>
                  Each record contains information about how you want to route traffic for a specific domain, such as
                  example.com, or a subdomain, such as www.example.com.
                </p>
              }
            />
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button iconName="refresh" ariaLabel="Refresh records" onClick={onReload} />
              <Button disabled={selected.length === 0} onClick={() => onDelete(selected)}>
                Delete record{selected.length > 1 ? "s" : ""}
              </Button>
              <Button onClick={() => router.push(importHref)}>Import zone file</Button>
              <ButtonDropdown
                items={[
                  { id: "bind", text: "BIND zone file (.txt)" },
                  { id: "json", text: "JSON (.json)" },
                ]}
                onItemClick={({ detail }) => onExport(detail.id as "json" | "bind")}
              >
                Export
              </ButtonDropdown>
              <Button variant="primary" onClick={() => router.push(createHref)}>
                Create record
              </Button>
            </SpaceBetween>
          }
        >
          Records
        </Header>
      }
      filter={
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
          <div data-shortcut="filter" style={{ flex: "1 1 260px", maxWidth: 520 }}>
            <TextFilter
              filteringText={filterText}
              filteringPlaceholder="Filter records by property or value"
              filteringAriaLabel="Filter records"
              countText={filtered ? `${total} ${total === 1 ? "match" : "matches"}` : undefined}
              onChange={({ detail }) => setFilterText(detail.filteringText)}
            />
          </div>
          <div style={{ minWidth: 150 }}>
            <Select
              selectedOption={type}
              options={TYPE_OPTIONS}
              ariaLabel="Filter by type"
              expandToViewport
              onChange={({ detail }) => {
                setType(detail.selectedOption.value ? detail.selectedOption : ALL_TYPES);
                setPage(1);
              }}
            />
          </div>
          <div style={{ minWidth: 170 }}>
            <Select
              selectedOption={policy}
              options={POLICY_OPTIONS}
              ariaLabel="Filter by routing policy"
              expandToViewport
              onChange={({ detail }) => {
                setPolicy(detail.selectedOption.value ? detail.selectedOption : ALL_POLICIES);
                setPage(1);
              }}
            />
          </div>
          <div style={{ minWidth: 120 }}>
            <Select
              selectedOption={alias}
              options={ALIAS_OPTIONS}
              ariaLabel="Filter by alias"
              expandToViewport
              onChange={({ detail }) => {
                setAlias(detail.selectedOption.value ? detail.selectedOption : ALL_ALIAS);
                setPage(1);
              }}
            />
          </div>
          {filtered && <Button onClick={clearFilters}>Clear filters</Button>}
        </div>
      }
      pagination={
        <Pagination
          currentPageIndex={page}
          pagesCount={Math.max(1, Math.ceil(total / prefs.pageSize))}
          onChange={({ detail }) => setPage(detail.currentPageIndex)}
        />
      }
      preferences={
        <CollectionPreferences
          title="Preferences"
          confirmLabel="Confirm"
          cancelLabel="Cancel"
          preferences={{
            pageSize: prefs.pageSize,
            wrapLines: prefs.wrapLines,
            stripedRows: prefs.stripedRows,
            contentDisplay: columnDisplay,
          }}
          onConfirm={({ detail }) => {
            setPrefs({
              pageSize: detail.pageSize ?? 25,
              wrapLines: detail.wrapLines ?? true,
              stripedRows: detail.stripedRows ?? false,
              visibleContent: (detail.contentDisplay ?? []).filter((c) => c.visible).map((c) => c.id),
            });
            setPage(1);
          }}
          pageSizePreference={{
            title: "Page size",
            options: [
              { value: 10, label: "10 records" },
              { value: 25, label: "25 records" },
              { value: 50, label: "50 records" },
              { value: 100, label: "100 records" },
            ],
          }}
          wrapLinesPreference={{ label: "Wrap lines", description: "Select to see all the text and wrap the lines" }}
          stripedRowsPreference={{ label: "Striped rows", description: "Select to add alternating shaded rows" }}
          contentDisplayPreference={{
            title: "Column preferences",
            options: columns.map((c) => ({ id: c.id!, label: String(c.header), alwaysVisible: c.id === "name" })),
          }}
        />
      }
      empty={
        error ? (
          <TableEmptyState title="Unable to load records" subtitle={error} action={<Button onClick={onReload}>Retry</Button>} />
        ) : filtered ? (
          <TableEmptyState title="No matches" subtitle="We can't find a match." action={<Button onClick={clearFilters}>Clear filters</Button>} />
        ) : (
          <TableEmptyState
            title="No records"
            subtitle="This hosted zone doesn't have any records."
            action={<Button onClick={() => router.push(createHref)}>Create record</Button>}
          />
        )
      }
    />
  );
}
