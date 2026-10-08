"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import SpaceBetween from "@cloudscape-design/components/space-between";
import SplitPanel from "@cloudscape-design/components/split-panel";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { draftFromRecord, draftToInput, type RecordDraft } from "@/lib/recordDraft";
import { differentiator, ROUTING_POLICY_LABEL } from "@/lib/records";
import type { DnsRecord, HostedZone } from "@/lib/types";
import { validateRecord, type RecordErrors } from "@/lib/validation";
import RecordFields from "./RecordFields";

const SPLIT_PANEL_I18N = {
  preferencesTitle: "Split panel preferences",
  preferencesPositionLabel: "Split panel position",
  preferencesPositionDescription: "Choose the default split panel position for the service.",
  preferencesPositionSide: "Side",
  preferencesPositionBottom: "Bottom",
  preferencesConfirm: "Confirm",
  preferencesCancel: "Cancel",
  closeButtonAriaLabel: "Close panel",
  openButtonAriaLabel: "Open panel",
  resizeHandleAriaLabel: "Resize split panel",
};

interface Props {
  zone: HostedZone;
  selected: DnsRecord[];
  zoneRecordNames: string[];
  onSaved: (record: DnsRecord) => void;
  onDelete: (records: DnsRecord[]) => void;
}

/** Right-hand "Record details" panel; switches into an inline edit form like the console. */
export default function RecordDetailsPanel({ zone, selected, zoneRecordNames, onSaved, onDelete }: Props) {
  const record = selected.length === 1 ? selected[0] : null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RecordDraft | null>(null);
  const [errors, setErrors] = useState<RecordErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setErrors({});
    setError(null);
    setDraft(record ? draftFromRecord(record, zone.name) : null);
  }, [record, zone.name]);

  if (selected.length === 0) {
    return (
      <SplitPanel header="Record details" i18nStrings={SPLIT_PANEL_I18N}>
        <Box textAlign="center" color="inherit" padding="l">
          <b>No record selected</b>
          <Box color="text-body-secondary">Select a record to see its details.</Box>
        </Box>
      </SplitPanel>
    );
  }

  if (!record || !draft) {
    return (
      <SplitPanel header={`${selected.length} records selected`} i18nStrings={SPLIT_PANEL_I18N}>
        <SpaceBetween size="m">
          <Box>Select a single record to view or edit its details.</Box>
          <Button onClick={() => onDelete(selected)}>Delete {selected.length} records</Button>
        </SpaceBetween>
      </SplitPanel>
    );
  }

  const save = async () => {
    const input = draftToInput(draft, zone.id);
    const errs = validateRecord(input, draft.prefix);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await api.updateRecord(zone.id, record.id, input);
      setEditing(false);
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const value = record.alias && record.alias_target ? record.alias_target.dns_name : record.values.join("\n");

  return (
    <SplitPanel header="Record details" i18nStrings={SPLIT_PANEL_I18N}>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <SpaceBetween size="l">
            <Header
              variant="h3"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button formAction="none" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" loading={busy}>
                    Save
                  </Button>
                </SpaceBetween>
              }
            >
              Edit record
            </Header>
            {error && (
              <Alert type="error" header="Error saving record">
                {error}
              </Alert>
            )}
            <RecordFields
              compact
              draft={draft}
              zoneName={zone.name}
              errors={errors}
              zoneRecordNames={zoneRecordNames}
              lockIdentity={record.is_default}
              onChange={(patch) => setDraft({ ...draft, ...patch })}
            />
          </SpaceBetween>
        </form>
      ) : (
        <SpaceBetween size="l">
          <Header
            variant="h3"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled={record.is_default} onClick={() => onDelete([record])}>
                  Delete record
                </Button>
                <Button onClick={() => setEditing(true)}>Edit record</Button>
              </SpaceBetween>
            }
          >
            {record.name}
          </Header>
          <KeyValuePairs
            columns={1}
            items={[
              { label: "Record name", value: record.name },
              { label: "Record type", value: record.type },
              { label: record.alias ? "Route traffic to" : "Value", value: <span className="value-cell mono">{value}</span> },
              { label: "Alias", value: record.alias ? "Yes" : "No" },
              ...(record.alias
                ? [{ label: "Evaluate target health", value: record.alias_target?.evaluate_target_health ? "Yes" : "No" }]
                : [{ label: "TTL (seconds)", value: String(record.ttl ?? "-") }]),
              { label: "Routing policy", value: ROUTING_POLICY_LABEL[record.routing_policy] },
              ...(record.routing_policy !== "simple"
                ? [
                    { label: "Differentiator", value: differentiator(record) },
                    { label: "Record ID", value: record.set_identifier ?? "-" },
                    { label: "Health check ID", value: record.health_check_id ?? "-" },
                  ]
                : []),
            ]}
          />
        </SpaceBetween>
      )}
    </SplitPanel>
  );
}
