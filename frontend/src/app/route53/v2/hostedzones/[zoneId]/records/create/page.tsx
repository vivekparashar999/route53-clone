"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import RecordFields from "@/components/records/RecordFields";
import ConsolePage, { HOSTED_ZONES_CRUMB, InfoLink, ROUTE53_CRUMB } from "@/components/shell/ConsolePage";
import { api, errorMessage } from "@/lib/api";
import { draftToInput, newDraft, type RecordDraft } from "@/lib/recordDraft";
import { displayName } from "@/lib/records";
import type { HostedZone } from "@/lib/types";
import { validateRecord, type RecordErrors } from "@/lib/validation";

/** "Quick create record": one or more records submitted as a single atomic change batch. */
export default function CreateRecordsPage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [recordNames, setRecordNames] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<RecordDraft[]>([newDraft()]);
  const [errors, setErrors] = useState<Record<string, RecordErrors>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getZone(zoneId).then(setZone).catch((err) => setError(errorMessage(err)));
    api
      .listRecords(zoneId, { page_size: 300 })
      .then((res) => setRecordNames([...new Set(res.items.map((r) => r.name))]))
      .catch(() => undefined);
  }, [zoneId]);

  const detailHref = `/route53/v2/hostedzones/${zoneId}`;

  const update = (key: string, patch: Partial<RecordDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const submit = async () => {
    if (!zone) return;
    const inputs = drafts.map((d) => draftToInput(d, zone.id));
    const errs: Record<string, RecordErrors> = {};
    drafts.forEach((d, i) => {
      const e = validateRecord(inputs[i], d.prefix);
      if (Object.keys(e).length) errs[d.key] = e;
    });
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setError(null);
    try {
      const res = await api.createRecords(zone.id, inputs);
      const n = res.items.length;
      notify({
        type: "success",
        header: `${n === 1 ? "Record" : `${n} records`} for ${displayName(zone.name)} ${n === 1 ? "was" : "were"} successfully created.`,
        content: "Route 53 propagates your changes to all of the Route 53 authoritative DNS servers within 60 seconds.",
      });
      router.push(detailHref);
    } catch (err) {
      setError(errorMessage(err));
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
        { text: "Create record", href: `${detailHref}/records/create` },
      ]}
    >
      {!zone && !error ? (
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      ) : (
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
                info={
                  <InfoLink
                    header="Create record"
                    body={
                      <p>
                        Create one or more records in this hosted zone. All records are created in a single change
                        batch: if any record is invalid, none are created.
                      </p>
                    }
                  />
                }
              >
                Create record
              </Header>
            }
            errorText={error}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button formAction="none" variant="link" onClick={() => router.push(detailHref)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={busy} disabled={!zone}>
                  Create records
                </Button>
              </SpaceBetween>
            }
          >
            {zone && (
              <Container
                header={
                  <Header
                    variant="h2"
                    info={<InfoLink header="Quick create record" body={<p>Quickly create records with the settings you use most often.</p>} />}
                    actions={
                      <Link
                        onFollow={() =>
                          notify({ type: "info", content: "The step-by-step wizard isn't part of this clone; quick create supports every routing policy." })
                        }
                      >
                        Switch to wizard
                      </Link>
                    }
                  >
                    Quick create record
                  </Header>
                }
              >
                <SpaceBetween size="l">
                  {drafts.map((d, i) => (
                    <Container
                      key={d.key}
                      header={
                        <Header
                          variant="h3"
                          actions={
                            drafts.length > 1 && (
                              <Button formAction="none" onClick={() => setDrafts((prev) => prev.filter((x) => x.key !== d.key))}>
                                Delete
                              </Button>
                            )
                          }
                        >
                          Record {i + 1}
                        </Header>
                      }
                    >
                      <RecordFields
                        draft={d}
                        zoneName={zone.name}
                        errors={errors[d.key]}
                        zoneRecordNames={recordNames}
                        onChange={(patch) => update(d.key, patch)}
                      />
                    </Container>
                  ))}
                  <Button formAction="none" iconName="add-plus" onClick={() => setDrafts((prev) => [...prev, newDraft()])}>
                    Add another record
                  </Button>
                </SpaceBetween>
              </Container>
            )}
          </Form>
        </form>
      )}
    </ConsolePage>
  );
}
