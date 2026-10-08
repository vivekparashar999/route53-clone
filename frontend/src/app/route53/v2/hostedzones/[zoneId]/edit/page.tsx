"use client";

import Box from "@cloudscape-design/components/box";
import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Spinner from "@cloudscape-design/components/spinner";
import Textarea from "@cloudscape-design/components/textarea";
import Tiles from "@cloudscape-design/components/tiles";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import ConsolePage, { HOSTED_ZONES_CRUMB, InfoLink, ROUTE53_CRUMB } from "@/components/shell/ConsolePage";
import VpcEditor from "@/components/zones/VpcEditor";
import ZoneTagsEditor from "@/components/zones/ZoneTagsEditor";
import { api, errorMessage } from "@/lib/api";
import { displayName } from "@/lib/records";
import type { HostedZone, Tag, Vpc } from "@/lib/types";

/** Edit hosted zone: like Route 53, the name and type are fixed; description, VPCs and tags can change. */
export default function EditHostedZonePage() {
  const { zoneId } = useParams<{ zoneId: string }>();
  const router = useRouter();
  const { notify } = useNotifications();
  const [zone, setZone] = useState<HostedZone | null>(null);
  const [comment, setComment] = useState("");
  const [tags, setTags] = useState<Tag[]>([]);
  const [vpcs, setVpcs] = useState<Vpc[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getZone(zoneId)
      .then((z) => {
        setZone(z);
        setComment(z.comment);
        setTags(z.tags);
        setVpcs(z.vpcs);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [zoneId]);

  const detailHref = `/route53/v2/hostedzones/${zoneId}`;
  const commentError = comment.length > 256 ? "Description must be 256 characters or fewer." : null;

  const submit = async () => {
    if (!zone || commentError) return;
    setBusy(true);
    setError(null);
    try {
      await api.updateZone(zone.id, {
        comment: comment.trim(),
        tags: tags.filter((t) => t.key.trim()),
        ...(zone.type === "private" ? { vpcs: vpcs.filter((v) => v.vpc_id) } : {}),
      });
      notify({ type: "success", content: `Hosted zone ${displayName(zone.name)} was successfully updated.` });
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
        { text: "Edit hosted zone", href: `${detailHref}/edit` },
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
              <Header variant="h1" info={<InfoLink header="Edit hosted zone" body={<p>You can change the description and tags of a hosted zone. The domain name and type can&apos;t be changed after creation.</p>} />}>
                Edit hosted zone
              </Header>
            }
            errorText={error}
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button formAction="none" variant="link" onClick={() => router.push(detailHref)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={busy} disabled={!zone}>
                  Save changes
                </Button>
              </SpaceBetween>
            }
          >
            {zone && (
              <SpaceBetween size="l">
                <Container header={<Header variant="h2">Hosted zone configuration</Header>}>
                  <SpaceBetween size="l">
                    <FormField label="Domain name" description="You can't change the domain name of a hosted zone.">
                      <Input value={displayName(zone.name)} disabled />
                    </FormField>
                    <FormField
                      label={
                        <span>
                          Description <i>- optional</i>
                        </span>
                      }
                      description="This value lets you distinguish hosted zones that have the same name."
                      constraintText={`The description can have up to 256 characters. ${256 - comment.length}/256`}
                      errorText={commentError}
                    >
                      <Textarea value={comment} rows={3} onChange={({ detail }) => setComment(detail.value)} />
                    </FormField>
                    <FormField label="Type" description="You can't change the type of a hosted zone." stretch>
                      <Tiles
                        value={zone.type}
                        columns={2}
                        items={[
                          { value: "public", label: "Public hosted zone", disabled: true },
                          { value: "private", label: "Private hosted zone", disabled: true },
                        ]}
                      />
                    </FormField>
                  </SpaceBetween>
                </Container>
                {zone.type === "private" && (
                  <Container header={<Header variant="h2">VPCs to associate with the hosted zone</Header>}>
                    <VpcEditor vpcs={vpcs} onChange={setVpcs} showErrors />
                  </Container>
                )}
                <Container header={<Header variant="h2">Tags</Header>}>
                  <ZoneTagsEditor tags={tags} onChange={setTags} />
                </Container>
              </SpaceBetween>
            )}
          </Form>
        </form>
      )}
    </ConsolePage>
  );
}
