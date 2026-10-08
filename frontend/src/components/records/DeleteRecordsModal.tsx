"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Table from "@cloudscape-design/components/table";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { recordValueText } from "@/lib/records";
import type { DnsRecord } from "@/lib/types";

interface Props {
  zoneId: string;
  records: DnsRecord[];
  visible: boolean;
  onDismiss: () => void;
  onDeleted: (count: number) => void;
}

export default function DeleteRecordsModal({ zoneId, records, visible, onDismiss, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const protectedRecords = records.filter((r) => r.is_default);

  useEffect(() => {
    if (visible) {
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (records.length === 1) await api.deleteRecord(zoneId, records[0].id);
      else await api.deleteRecords(zoneId, records.map((r) => r.id));
      onDeleted(records.length);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  const plural = records.length === 1 ? "record" : "records";

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      size="large"
      header={`Delete ${plural}?`}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={protectedRecords.length > 0} onClick={submit}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box>
          Are you sure that you want to delete the following {records.length === 1 ? "" : `${records.length} `}
          {plural}? This action can&apos;t be undone.
        </Box>
        {protectedRecords.length > 0 && (
          <Alert type="error" header="You can't delete the NS and SOA records for the hosted zone">
            Route 53 creates these records automatically when you create a hosted zone. Clear them from the selection
            to continue.
          </Alert>
        )}
        {error && (
          <Alert type="error" header="Error deleting records">
            {error}
          </Alert>
        )}
        <Table
          variant="embedded"
          items={records}
          trackBy="id"
          columnDefinitions={[
            { id: "name", header: "Record name", cell: (r) => r.name },
            { id: "type", header: "Type", cell: (r) => r.type },
            { id: "value", header: "Value", cell: (r) => <span className="value-cell">{recordValueText(r)}</span> },
          ]}
        />
      </SpaceBetween>
    </Modal>
  );
}
