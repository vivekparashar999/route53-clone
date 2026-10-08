"use client";

import Button from "@cloudscape-design/components/button";
import CollectionPreferences from "@cloudscape-design/components/collection-preferences";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import PropertyFilter, { type PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import TableEmptyState from "@/components/common/TableEmptyState";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import ConsolePage, { HOSTED_ZONES_CRUMB, InfoLink, ROUTE53_CRUMB } from "@/components/shell/ConsolePage";
import DeleteZoneModal from "@/components/zones/DeleteZoneModal";
import { api, errorMessage, type ZoneListParams } from "@/lib/api";
import { displayName } from "@/lib/records";
import type { HostedZone } from "@/lib/types";
import { usePersistentState } from "@/lib/usePersistentState";
import { useShortcut } from "@/lib/useShortcut";

const FILTERING_PROPERTIES: PropertyFilterProps.FilteringProperty[] = [
  { key: "name", propertyLabel: "Hosted zone name", groupValuesLabel: "Hosted zone name values", operators: [":", "="] },
  { key: "type", propertyLabel: "Type", groupValuesLabel: "Type values", operators: ["="] },
  { key: "comment", propertyLabel: "Description", groupValuesLabel: "Description values", operators: [":"] },
  { key: "id", propertyLabel: "Hosted zone ID", groupValuesLabel: "Hosted zone ID values", operators: [":", "="] },
];

const FILTERING_OPTIONS: PropertyFilterProps.FilteringOption[] = [
  { propertyKey: "type", value: "Public" },
  { propertyKey: "type", value: "Private" },
];

const SORT_FIELDS: Record<string, string> = {
  name: "name",
  type: "type",
  record_count: "record_count",
  comment: "comment",
  id: "id",
};

/** Translate property-filter tokens into backend query parameters. */
function tokensToParams(query: PropertyFilterProps.Query): ZoneListParams {
  const params: ZoneListParams = {};
  const free: string[] = [];
  for (const t of query.tokens) {
    const v = String(t.value ?? "").trim();
    if (!v) continue;
    if (!t.propertyKey || t.propertyKey === "id") free.push(v);
    else if (t.propertyKey === "type") params.type = v.toLowerCase();
    else if (t.propertyKey === "name") params.name = v;
    else if (t.propertyKey === "comment") params.comment = v;
  }
  if (free.length) params.q = free.join(" ");
  return params;
}

interface Prefs {
  pageSize: number;
  wrapLines: boolean;
  stripedRows: boolean;
  visibleContent: string[];
}

const DEFAULT_PREFS: Prefs = {
  pageSize: 10,
  wrapLines: false,
  stripedRows: false,
  visibleContent: ["name", "type", "created_by", "record_count", "comment", "id"],
};

export default function HostedZonesPage() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [prefs, setPrefs] = usePersistentState<Prefs>("r53.zonesTablePrefs", DEFAULT_PREFS);

  const [items, setItems] = useState<HostedZone[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState<PropertyFilterProps.Query>({ tokens: [], operation: "and" });
  const [sorting, setSorting] = useState<{ field: string; descending: boolean }>({ field: "name", descending: false });
  const [selected, setSelected] = useState<HostedZone[]>([]);
  const [toDelete, setToDelete] = useState<HostedZone | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listZones({
        ...tokensToParams(query),
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
        setSelected((sel) => res.items.filter((z) => sel.some((s) => s.id === z.id)));
      })
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, page, prefs.pageSize, sorting, reloadKey]);

  useShortcut("c", () => router.push("/route53/v2/hostedzones/create"));
  useShortcut("r", reload);

  const pagesCount = Math.max(1, Math.ceil(total / prefs.pageSize));
  const zone = selected[0];
  const hasFilter = query.tokens.length > 0;

  const columns: TableProps.ColumnDefinition<HostedZone>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Hosted zone name",
        sortingField: "name",
        isRowHeader: true,
        width: 260,
        cell: (z) => (
          <Link
            href={`/route53/v2/hostedzones/${z.id}`}
            onFollow={(e) => {
              e.preventDefault();
              router.push(`/route53/v2/hostedzones/${z.id}`);
            }}
          >
            {displayName(z.name)}
          </Link>
        ),
      },
      { id: "type", header: "Type", sortingField: "type", cell: (z) => (z.type === "public" ? "Public" : "Private") },
      { id: "created_by", header: "Created by", cell: (z) => z.created_by },
      { id: "record_count", header: "Record count", sortingField: "record_count", cell: (z) => z.record_count },
      { id: "comment", header: "Description", sortingField: "comment", cell: (z) => z.comment || "-" },
      { id: "id", header: "Hosted zone ID", sortingField: "id", cell: (z) => z.id },
    ],
    [router],
  );

  return (
    <ConsolePage breadcrumbs={[ROUTE53_CRUMB, HOSTED_ZONES_CRUMB]} contentType="table">
      <Table
        variant="full-page"
        stickyHeader
        resizableColumns
        loading={loading}
        loadingText="Loading hosted zones"
        items={items}
        columnDefinitions={columns}
        columnDisplay={DEFAULT_PREFS.visibleContent.map((id) => ({ id, visible: prefs.visibleContent.includes(id) }))}
        wrapLines={prefs.wrapLines}
        stripedRows={prefs.stripedRows}
        selectionType="single"
        selectedItems={selected}
        onSelectionChange={({ detail }) => setSelected(detail.selectedItems)}
        trackBy="id"
        ariaLabels={{
          selectionGroupLabel: "Hosted zone selection",
          itemSelectionLabel: (_, z) => displayName(z.name),
          allItemsSelectionLabel: () => "select all",
        }}
        sortingColumn={{ sortingField: sorting.field }}
        sortingDescending={sorting.descending}
        onSortingChange={({ detail }) => {
          const field = detail.sortingColumn.sortingField ?? "name";
          setSorting({ field: SORT_FIELDS[field] ?? "name", descending: detail.isDescending ?? false });
          setPage(1);
        }}
        header={
          <Header
            variant="awsui-h1-sticky"
            counter={loading && !items.length ? undefined : `(${total})`}
            info={
              <InfoLink
                header="Hosted zones"
                body={
                  <>
                    <p>
                      A hosted zone is a container for records, which include information about how you want to route
                      traffic for a domain (such as example.com) and all of its subdomains.
                    </p>
                    <p>
                      <b>Public hosted zones</b> determine how traffic is routed on the internet.{" "}
                      <b>Private hosted zones</b> determine how traffic is routed within an Amazon VPC.
                    </p>
                  </>
                }
              />
            }
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="refresh" ariaLabel="Refresh hosted zones" onClick={reload} />
                <Button disabled={!zone} onClick={() => zone && router.push(`/route53/v2/hostedzones/${zone.id}`)}>
                  View details
                </Button>
                <Button disabled={!zone} onClick={() => zone && router.push(`/route53/v2/hostedzones/${zone.id}/edit`)}>
                  Edit
                </Button>
                <Button disabled={!zone} onClick={() => zone && setToDelete(zone)}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => router.push("/route53/v2/hostedzones/create")}>
                  Create hosted zone
                </Button>
              </SpaceBetween>
            }
          >
            Hosted zones
          </Header>
        }
        filter={
          <div data-shortcut="filter">
            <PropertyFilter
              query={query}
              onChange={({ detail }) => {
                setQuery(detail);
                setPage(1);
              }}
              filteringProperties={FILTERING_PROPERTIES}
              filteringOptions={FILTERING_OPTIONS}
              filteringPlaceholder="Filter hosted zones by property or value"
              filteringAriaLabel="Filter hosted zones"
              countText={`${total} ${total === 1 ? "match" : "matches"}`}
              expandToViewport
              hideOperations
            />
          </div>
        }
        pagination={
          <Pagination
            currentPageIndex={page}
            pagesCount={pagesCount}
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
              contentDisplay: DEFAULT_PREFS.visibleContent.map((id) => ({ id, visible: prefs.visibleContent.includes(id) })),
            }}
            onConfirm={({ detail }) => {
              setPrefs({
                pageSize: detail.pageSize ?? 10,
                wrapLines: detail.wrapLines ?? false,
                stripedRows: detail.stripedRows ?? false,
                visibleContent: (detail.contentDisplay ?? []).filter((c) => c.visible).map((c) => c.id),
              });
              setPage(1);
            }}
            pageSizePreference={{
              title: "Page size",
              options: [
                { value: 10, label: "10 hosted zones" },
                { value: 25, label: "25 hosted zones" },
                { value: 50, label: "50 hosted zones" },
                { value: 100, label: "100 hosted zones" },
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
            <TableEmptyState title="Unable to load hosted zones" subtitle={error} action={<Button onClick={reload}>Retry</Button>} />
          ) : hasFilter ? (
            <TableEmptyState
              title="No matches"
              subtitle="We can't find a match."
              action={<Button onClick={() => setQuery({ tokens: [], operation: "and" })}>Clear filter</Button>}
            />
          ) : (
            <TableEmptyState
              title="No hosted zones"
              subtitle="You don't have any hosted zones."
              action={<Button onClick={() => router.push("/route53/v2/hostedzones/create")}>Create hosted zone</Button>}
            />
          )
        }
      />
      <DeleteZoneModal
        zone={toDelete}
        onDismiss={() => setToDelete(null)}
        onDeleted={(z) => {
          setToDelete(null);
          setSelected([]);
          notify({ type: "success", content: `Hosted zone ${displayName(z.name)} was successfully deleted.` });
          reload();
        }}
      />
    </ConsolePage>
  );
}
