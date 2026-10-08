"use client";

import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import FormField from "@cloudscape-design/components/form-field";
import Input from "@cloudscape-design/components/input";
import Modal from "@cloudscape-design/components/modal";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { displayName } from "@/lib/records";
import type { HostedZone } from "@/lib/types";

const CONFIRM_WORD = "delete";

interface Props {
  zone: HostedZone | null;
  onDismiss: () => void;
  onDeleted: (zone: HostedZone) => void;
}

export default function DeleteZoneModal({ zone, onDismiss, onDeleted }: Props) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConfirm("");
    setError(null);
    setBusy(false);
  }, [zone]);

  const submit = async () => {
    if (!zone) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteZone(zone.id);
      onDeleted(zone);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={zone !== null}
      onDismiss={onDismiss}
      header="Delete hosted zone?"
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} disabled={confirm !== CONFIRM_WORD} onClick={submit}>
              Delete
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      {zone && (
        <SpaceBetween size="m">
          <Box variant="span">
            Delete hosted zone <b>{displayName(zone.name)}</b> permanently? This action cannot be undone.
          </Box>
          <Alert type="warning">
            If you delete a hosted zone that is in use, DNS queries for the domain will stop being answered by Route
            53. You can delete a hosted zone only if it contains no records other than the default NS and SOA
            records.
          </Alert>
          {error && (
            <Alert type="error" header="Error deleting hosted zone">
              {error}
            </Alert>
          )}
          <FormField label={`To confirm deletion, enter "${CONFIRM_WORD}" in the field.`}>
            <Input
              value={confirm}
              placeholder={CONFIRM_WORD}
              ariaLabel="Confirm deletion"
              onChange={({ detail }) => setConfirm(detail.value)}
              onKeyDown={({ detail }) => {
                if (detail.key === "Enter" && confirm === CONFIRM_WORD) void submit();
              }}
            />
          </FormField>
        </SpaceBetween>
      )}
    </Modal>
  );
}
