"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Container from "@cloudscape-design/components/container";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import KeyValuePairs from "@cloudscape-design/components/key-value-pairs";
import Modal from "@cloudscape-design/components/modal";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { displayName, RECORD_TYPE_OPTIONS } from "@/lib/records";
import type { HostedZone } from "@/lib/types";

interface Answer {
  name: string;
  type: string;
  code: "NOERROR" | "NXDOMAIN";
  values: string[];
}

/** "Test record" - answers a query from the stored records (no real DNS resolution). */
export default function TestRecordModal({ zone, visible, onDismiss }: { zone: HostedZone; visible: boolean; onDismiss: () => void }) {
  const [prefix, setPrefix] = useState("");
  const [type, setType] = useState("A");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fqdn = `${prefix ? `${prefix.replace(/\.$/, "")}.` : ""}${zone.name}`.toLowerCase();

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      // Every record set at this name, any type (the LIKE filter may also return longer names).
      const res = await api.listRecords(zone.id, { q: fqdn, page_size: 300 });
      const atName = res.items.filter((r) => r.name === fqdn);
      const exact = atName.filter((r) => r.type === type);
      // Like a resolver, answer with the CNAME when the name has one and no record of the asked type.
      const match = exact.length ? exact : atName.filter((r) => r.type === "CNAME");
      const values = match.flatMap((r) =>
        r.alias && r.alias_target ? [`ALIAS ${r.alias_target.dns_name}`] : r.values.map((v) => (r.type === type ? v : `${r.type} ${v}`)),
      );
      setAnswer({ name: fqdn, type, code: atName.length ? "NOERROR" : "NXDOMAIN", values });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onDismiss}
      size="large"
      header="Test record"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Close
            </Button>
            <Button variant="primary" loading={busy} onClick={run}>
              Get response
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="l">
        <Box color="text-body-secondary">
          Check how Route 53 responds to DNS queries for a record in {displayName(zone.name)}. Responses are simulated
          from the records stored in this hosted zone.
        </Box>
        <ColumnLayout columns={2}>
          <FormField label="Record name" constraintText={`.${displayName(zone.name)}`}>
            <Input value={prefix} placeholder="www" onChange={({ detail }) => setPrefix(detail.value)} />
          </FormField>
          <FormField label="Type">
            <Select
              selectedOption={RECORD_TYPE_OPTIONS.find((o) => o.value === type) ?? null}
              options={[...RECORD_TYPE_OPTIONS, { value: "SOA", label: "SOA", description: "Start of authority" }]}
              expandToViewport
              onChange={({ detail }) => setType(detail.selectedOption.value!)}
            />
          </FormField>
        </ColumnLayout>
        {error && <Box color="text-status-error">{error}</Box>}
        {answer && (
          <Container header={<Header variant="h3">Response returned by Route 53</Header>}>
            <KeyValuePairs
              columns={2}
              items={[
                { label: "DNS query sent to Route 53", value: `${answer.name} ${answer.type}` },
                { label: "DNS response code", value: answer.code === "NOERROR" ? "No error (NOERROR)" : "Non-existent domain (NXDOMAIN)" },
                { label: "Protocol", value: "UDP" },
                {
                  label: "Response returned by Route 53",
                  value: answer.values.length ? <span className="value-cell mono">{answer.values.join("\n")}</span> : "-",
                },
              ]}
            />
          </Container>
        )}
      </SpaceBetween>
    </Modal>
  );
}
