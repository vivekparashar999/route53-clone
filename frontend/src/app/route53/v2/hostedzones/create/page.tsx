"use client";

import Button from "@cloudscape-design/components/button";
import Container from "@cloudscape-design/components/container";
import Form from "@cloudscape-design/components/form";
import FormField from "@cloudscape-design/components/form-field";
import Header from "@cloudscape-design/components/header";
import Input from "@cloudscape-design/components/input";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Tiles from "@cloudscape-design/components/tiles";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useNotifications } from "@/components/providers/NotificationsProvider";
import ConsolePage, { HOSTED_ZONES_CRUMB, InfoLink, ROUTE53_CRUMB } from "@/components/shell/ConsolePage";
import VpcEditor from "@/components/zones/VpcEditor";
import ZoneTagsEditor from "@/components/zones/ZoneTagsEditor";
import { api, errorMessage } from "@/lib/api";
import { displayName } from "@/lib/records";
import { validateDomain } from "@/lib/validation";
import type { Tag, Vpc, ZoneType } from "@/lib/types";

export default function CreateHostedZonePage() {
  const router = useRouter();
  const { notify } = useNotifications();
  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [type, setType] = useState<ZoneType>("public");
  const [vpcs, setVpcs] = useState<Vpc[]>([{ region: "us-east-1", vpc_id: "" }]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = submitted ? validateDomain(name) : null;
  const commentError = comment.length > 256 ? "Description must be 256 characters or fewer." : null;

  const submit = async () => {
    setSubmitted(true);
    if (validateDomain(name) || commentError) return;
    if (type === "private" && vpcs.some((v) => !v.vpc_id)) {
      setError("Choose a VPC for each Region you want to associate with the private hosted zone.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const zone = await api.createZone({
        name: name.trim(),
        comment: comment.trim(),
        type,
        vpcs: type === "private" ? vpcs : [],
        tags: tags.filter((t) => t.key.trim()),
      });
      notify({
        type: "success",
        header: `${displayName(zone.name)} was successfully created.`,
        content: "Now you can create records in the hosted zone to specify how you want Route 53 to route traffic for your domain.",
      });
      router.push(`/route53/v2/hostedzones/${zone.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <ConsolePage
      breadcrumbs={[ROUTE53_CRUMB, HOSTED_ZONES_CRUMB, { text: "Create hosted zone", href: "/route53/v2/hostedzones/create" }]}
      contentType="form"
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
              info={
                <InfoLink
                  header="Create hosted zone"
                  body={
                    <p>
                      A hosted zone tells Route 53 how to respond to DNS queries for a domain such as example.com. When
                      you create a hosted zone, Route 53 automatically creates a name server (NS) record and a start of
                      authority (SOA) record for the zone.
                    </p>
                  }
                />
              }
            >
              Create hosted zone
            </Header>
          }
          errorText={error}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" variant="link" onClick={() => router.push("/route53/v2/hostedzones")}>
                Cancel
              </Button>
              <Button variant="primary" loading={busy}>
                Create hosted zone
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <Container
              header={
                <Header
                  variant="h2"
                  description="A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains."
                >
                  Hosted zone configuration
                </Header>
              }
            >
              <SpaceBetween size="l">
                <FormField
                  label="Domain name"
                  info={<InfoLink header="Domain name" body={<p>The name of the domain that you want to route traffic for.</p>} />}
                  description="This is the name of the domain that you want to route traffic for."
                  constraintText="Valid characters: a-z, 0-9, ! &quot; # $ % & ' ( ) * + , - / : ; < = > ? @ [ \ ] ^ _ ` { | } . ~"
                  errorText={nameError}
                >
                  <Input
                    value={name}
                    placeholder="example.com"
                    autoFocus
                    onChange={({ detail }) => setName(detail.value)}
                    ariaRequired
                  />
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
                  <Textarea
                    value={comment}
                    rows={3}
                    placeholder="The hosted zone is used for..."
                    onChange={({ detail }) => setComment(detail.value)}
                  />
                </FormField>
                <FormField
                  label="Type"
                  info={
                    <InfoLink
                      header="Hosted zone type"
                      body={
                        <p>
                          A public hosted zone determines how traffic is routed on the internet. A private hosted zone
                          determines how traffic is routed within one or more Amazon VPCs.
                        </p>
                      }
                    />
                  }
                  description="The type indicates whether you want to route traffic on the internet or in an Amazon VPC."
                  stretch
                >
                  <Tiles
                    value={type}
                    onChange={({ detail }) => setType(detail.value as ZoneType)}
                    columns={2}
                    items={[
                      {
                        value: "public",
                        label: "Public hosted zone",
                        description: "A public hosted zone determines how traffic is routed on the internet.",
                      },
                      {
                        value: "private",
                        label: "Private hosted zone",
                        description: "A private hosted zone determines how traffic is routed within an Amazon VPC.",
                      },
                    ]}
                  />
                </FormField>
              </SpaceBetween>
            </Container>

            {type === "private" && (
              <Container
                header={
                  <Header
                    variant="h2"
                    description="To use this hosted zone to resolve DNS queries for one or more VPCs, choose the VPCs. To associate a VPC with a hosted zone when the VPC was created using a different AWS account, you must use a programmatic method."
                  >
                    VPCs to associate with the hosted zone
                  </Header>
                }
              >
                <VpcEditor vpcs={vpcs} onChange={setVpcs} showErrors={submitted} />
              </Container>
            )}

            <Container
              header={
                <Header
                  variant="h2"
                  description="Apply tags to hosted zones to help organize and identify them."
                  info={<InfoLink header="Tags" body={<p>A tag is a label that you assign to an AWS resource.</p>} />}
                >
                  Tags
                </Header>
              }
            >
              <ZoneTagsEditor tags={tags} onChange={setTags} />
            </Container>
          </SpaceBetween>
        </Form>
      </form>
    </ConsolePage>
  );
}
