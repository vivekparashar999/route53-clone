"use client";

import Alert from "@cloudscape-design/components/alert";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import FileUpload from "@cloudscape-design/components/file-upload";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import ConsolePage, { HOSTED_ZONES_CRUMB, InfoLink, ROUTE53_CRUMB } from "@/components/shell/ConsolePage";
import { api, errorMessage, type ImportResult } from "@/lib/api";
import { displayName } from "@/lib/records";
import type { HostedZone } from "@/lib/types";

function sampleZoneFile(zone: string): string {
  return `$ORIGIN ${zone}.
$TTL 300
; Records outside ${zone} and the zone's own SOA/NS records are skipped.
api        IN  A      192.0.2.10
api        IN  AAAA   2001:db8::10
blog       IN  CNAME  www.${zone}
@          IN  MX     10 mail1.${zone}
@          IN  TXT    "v=spf1 include:amazonses.com ~all"
_sip._tcp  IN  SRV    10 60 5060 sip.${zone}
@          IN  CAA    0 issue "amazon.com"`;
}

export default function ImportZoneFilePage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    api.getZone(zoneId).then(setZone).catch((err) => setError(errorMessage(err)));
  }, [zoneId]);

  const detailHref = `/route53/v2/hostedzones/${zoneId}`;

  const loadFile = async (selected: File[]) => {
    setFiles(selected);
    if (selected[0]) setText(await selected[0].text());
  };

  const submit = async () => {
    if (!text.trim()) {
      setError("Paste a zone file or choose a file to import.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.importZoneFile(zoneId, text);
      setResult(res);
      if (res.created > 0) {
        notify({
          type: res.errors.length ? "warning" : "success",
          content: `Imported ${res.created} ${res.created === 1 ? "record" : "records"} into ${displayName(zone?.name ?? "")}${
            res.skipped ? `, skipped ${res.skipped}` : ""
          }.`,
        });
        if (!res.errors.length) router.push(detailHref);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConsolePage
      contentType="form"
      breadcrumbs={[
        ROUTE53_CRUMB,
        HOSTED_ZONES_CRUMB,
        { text: zone ? displayName(zone.name) : zoneId, href: detailHref },
        { text: "Import zone file", href: `${detailHref}/import` },
      ]}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Form
          header={
            <Header
              variant="h1"
              description="Import records from a BIND-formatted zone file. Records are added to the existing records in the hosted zone."
              info={
                <InfoLink
                  header="Import zone file"
                  body={
                    <p>
                      Supported syntax: $ORIGIN, $TTL, @, relative and fully-qualified names, comments, and
                      parenthesised multi-line records.
                    </p>
                  }
                />
              }
            >
              Import zone file
            </Header>
          }
          errorText={error}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={() => router.push(detailHref)}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy} disabled={!zone}>
                Import
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {result && (result.errors.length > 0 || result.created === 0) && (
              <Alert
                type={result.created ? "warning" : "error"}
                header={`Imported ${result.created}, skipped ${result.skipped}`}
                action={result.created ? <Button onClick={() => router.push(detailHref)}>View records</Button> : undefined}
              >
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {result.errors.slice(0, 20).map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <Container header={<Header variant="h2">Zone file</Header>}>
              <SpaceBetween size="l">
                <FormField label="Upload a zone file - optional" description="Choose a .txt or .zone file, or paste the contents below.">
                  <FileUpload
                    value={files}
                    onChange={({ detail }) => void loadFile(detail.value)}
                    accept=".txt,.zone,.db,text/plain"
                    constraintText="BIND zone file, plain text"
                    i18nStrings={{
                      uploadButtonText: (multiple) => (multiple ? "Choose files" : "Choose file"),
                      dropzoneText: (multiple) => (multiple ? "Drop files to upload" : "Drop file to upload"),
                      removeFileAriaLabel: (i) => `Remove file ${i + 1}`,
                      limitShowFewer: "Show fewer files",
                      limitShowMore: "Show more files",
                      errorIconAriaLabel: "Error",
                    }}
                  />
                </FormField>
                <FormField
                  label="Zone file"
                  stretch
                  secondaryControl={
                    zone && (
                      <Button formAction="none" onClick={() => setText(sampleZoneFile(displayName(zone.name)))}>
                        Insert example
                      </Button>
                    )
                  }
                >
                  <Textarea
                    value={text}
                    rows={18}
                    spellcheck={false}
                    placeholder={zone ? sampleZoneFile(displayName(zone.name)) : ""}
                    onChange={({ detail }) => setText(detail.value)}
                  />
                </FormField>
              </SpaceBetween>
            </Container>
          </SpaceBetween>
        </Form>
      </form>
    </ConsolePage>
  );
}
