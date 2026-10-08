"use client";

import Autosuggest from "@cloudscape-design/components/autosuggest";
import Button from "@cloudscape-design/components/button";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import FormField from "@cloudscape-design/components/form-field";
import Grid from "@cloudscape-design/components/grid";
import Input from "@cloudscape-design/components/input";
import Select from "@cloudscape-design/components/select";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Textarea from "@cloudscape-design/components/textarea";
import Toggle from "@cloudscape-design/components/toggle";
import { InfoLink } from "@/components/shell/ConsolePage";
import { supportsAlias, type RecordDraft } from "@/lib/recordDraft";
import {
  ALIAS_ENDPOINTS,
  AWS_REGIONS,
  displayName,
  GEO_LOCATIONS,
  RECORD_TYPE_OPTIONS,
  RECORD_TYPES,
  ROUTING_POLICIES,
  TTL_PRESETS,
} from "@/lib/records";
import type { RecordType, RoutingPolicy } from "@/lib/types";
import type { RecordErrors } from "@/lib/validation";

interface Props {
  draft: RecordDraft;
  zoneName: string;
  onChange: (patch: Partial<RecordDraft>) => void;
  errors?: RecordErrors;
  /** Names of existing records in the zone - suggestions for "Alias to another record". */
  zoneRecordNames?: string[];
  /** Name and type can't change on an existing default NS/SOA record. */
  lockIdentity?: boolean;
  /** Narrow layout for the split panel. */
  compact?: boolean;
}

function aliasSuggestions(endpoint: string, region: string, zoneRecordNames: string[]) {
  switch (endpoint) {
    case "record":
      return zoneRecordNames;
    case "cloudfront":
      return ["d111111abcdef8.cloudfront.net", "d2oxqriwljg696.cloudfront.net"];
    case "s3":
      return [`s3-website-${region}.amazonaws.com`];
    case "apigw":
      return [`d-abcde12345.execute-api.${region}.amazonaws.com`];
    case "eb":
      return [`my-env.${region}.elasticbeanstalk.com`];
    case "vpce":
      return [`vpce-0a1b2c3d4e5f6a7b8-abcdefgh.vpce-svc-0123456789abcdef0.${region}.vpce.amazonaws.com`];
    case "nlb":
      return [`my-nlb-net-1a2b3c4d5e6f7a8b.elb.${region}.amazonaws.com`];
    default:
      return [`dualstack.my-alb-1234567890.${region}.elb.amazonaws.com`];
  }
}

export default function RecordFields({
  draft,
  zoneName,
  onChange,
  errors = {},
  zoneRecordNames = [],
  lockIdentity = false,
  compact = false,
}: Props) {
  const typeMeta = RECORD_TYPES.find((t) => t.value === draft.type) ?? RECORD_TYPES[0];
  const zone = displayName(zoneName);
  const aliasAllowed = supportsAlias(draft.type);
  const alias = draft.alias && aliasAllowed;
  const endpoint = ALIAS_ENDPOINTS.find((e) => e.value === draft.aliasEndpoint) ?? ALIAS_ENDPOINTS[0];
  const typeOptions = draft.type === "SOA" ? [{ value: "SOA", label: "SOA", description: "Start of authority" }] : RECORD_TYPE_OPTIONS;

  const nameField = (
    <FormField
      label="Record name"
      info={
        <InfoLink
          header="Record name"
          body={<p>Enter the subdomain name, or leave blank to create a record for the root domain ({zone}).</p>}
        />
      }
      errorText={errors.name}
      constraintText="Keep blank to create a record for the root domain."
      stretch
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input
            value={draft.prefix}
            placeholder="subdomain"
            disabled={lockIdentity}
            onChange={({ detail }) => onChange({ prefix: detail.value })}
            ariaLabel="Record name"
          />
        </div>
        <span style={{ whiteSpace: "nowrap", wordBreak: "break-all" }}>.{zone}</span>
      </div>
    </FormField>
  );

  const typeField = (
    <FormField label="Record type" info={<InfoLink header="Record type" body={<p>{typeMeta.description}.</p>} />} stretch>
      <Select
        selectedOption={typeOptions.find((o) => o.value === draft.type) ?? null}
        options={typeOptions}
        triggerVariant="option"
        disabled={lockIdentity}
        expandToViewport
        onChange={({ detail }) => onChange({ type: detail.selectedOption.value as RecordType })}
      />
    </FormField>
  );

  return (
    <SpaceBetween size="l">
      {compact ? (
        <SpaceBetween size="l">
          {nameField}
          {typeField}
        </SpaceBetween>
      ) : (
        <Grid gridDefinition={[{ colspan: { default: 12, s: 6 } }, { colspan: { default: 12, s: 6 } }]}>
          {nameField}
          {typeField}
        </Grid>
      )}

      {aliasAllowed && (
        <Toggle checked={draft.alias} onChange={({ detail }) => onChange({ alias: detail.checked })}>
          Alias
        </Toggle>
      )}

      {alias ? (
        <FormField
          label="Route traffic to"
          info={
            <InfoLink
              header="Route traffic to"
              body={<p>Choose the AWS resource or another record in this hosted zone that you want to route traffic to.</p>}
            />
          }
          errorText={errors.alias}
          stretch
        >
          <SpaceBetween size="xs">
            <Select
              selectedOption={{ value: endpoint.value, label: endpoint.label }}
              options={ALIAS_ENDPOINTS.map((e) => ({ value: e.value, label: e.label }))}
              expandToViewport
              onChange={({ detail }) => onChange({ aliasEndpoint: detail.selectedOption.value!, aliasDnsName: "" })}
            />
            {endpoint.needsRegion && (
              <Select
                selectedOption={AWS_REGIONS.find((r) => r.value === draft.aliasRegion) ?? null}
                options={AWS_REGIONS}
                placeholder="Choose Region"
                expandToViewport
                onChange={({ detail }) => onChange({ aliasRegion: detail.selectedOption.value! })}
              />
            )}
            <Autosuggest
              value={draft.aliasDnsName}
              placeholder={endpoint.value === "record" ? "Choose record" : "Choose endpoint"}
              enteredTextLabel={(v) => `Use: "${v}"`}
              empty="No endpoints found"
              expandToViewport
              options={aliasSuggestions(endpoint.value, draft.aliasRegion, zoneRecordNames).map((v) => ({ value: v }))}
              onChange={({ detail }) => onChange({ aliasDnsName: detail.value })}
              ariaLabel="Alias target"
            />
          </SpaceBetween>
        </FormField>
      ) : (
        <FormField
          label="Value"
          info={<InfoLink header="Value" body={<p>Enter the value that is appropriate for the record type.</p>} />}
          description={`${typeMeta.description}.`}
          constraintText="Enter multiple values on separate lines."
          errorText={errors.values}
          stretch
        >
          <Textarea
            value={draft.valuesText}
            rows={3}
            placeholder={typeMeta.placeholder}
            onChange={({ detail }) => onChange({ valuesText: detail.value })}
            ariaLabel="Value"
            spellcheck={false}
          />
        </FormField>
      )}

      <ColumnLayout columns={compact ? 1 : 2}>
        {alias ? (
          <FormField label="Evaluate target health">
            <Toggle
              checked={draft.evaluateTargetHealth}
              onChange={({ detail }) => onChange({ evaluateTargetHealth: detail.checked })}
            >
              {draft.evaluateTargetHealth ? "Yes" : "No"}
            </Toggle>
          </FormField>
        ) : (
          <FormField
            label="TTL (seconds)"
            info={
              <InfoLink
                header="TTL (seconds)"
                body={<p>The amount of time, in seconds, that you want DNS recursive resolvers to cache information about this record.</p>}
              />
            }
            constraintText="Recommended values: 60 to 172800 (two days)"
            errorText={errors.ttl}
          >
            <SpaceBetween direction="horizontal" size="xs">
              <Input
                type="number"
                inputMode="numeric"
                value={draft.ttl}
                onChange={({ detail }) => onChange({ ttl: detail.value })}
                ariaLabel="TTL (seconds)"
              />
              {TTL_PRESETS.map((p) => (
                <Button key={p.label} formAction="none" onClick={() => onChange({ ttl: String(p.value) })}>
                  {p.label}
                </Button>
              ))}
            </SpaceBetween>
          </FormField>
        )}

        <FormField
          label="Routing policy"
          info={
            <InfoLink
              header="Routing policy"
              body={<p>The routing policy determines how Amazon Route 53 responds to queries.</p>}
            />
          }
        >
          <Select
            selectedOption={ROUTING_POLICIES.map((p) => ({ value: p.value, label: p.label })).find(
              (o) => o.value === draft.routingPolicy,
            ) ?? null}
            options={ROUTING_POLICIES.map((p) => ({ value: p.value, label: p.label, description: p.description }))}
            disabled={lockIdentity}
            expandToViewport
            onChange={({ detail }) => onChange({ routingPolicy: detail.selectedOption.value as RoutingPolicy })}
          />
        </FormField>
      </ColumnLayout>

      {draft.routingPolicy !== "simple" && (
        <ColumnLayout columns={compact ? 1 : 2}>
          {draft.routingPolicy === "weighted" && (
            <FormField label="Weight" constraintText="Range 0 - 255" errorText={errors.weight}>
              <Input
                type="number"
                value={draft.weight}
                placeholder="10"
                onChange={({ detail }) => onChange({ weight: detail.value })}
              />
            </FormField>
          )}
          {draft.routingPolicy === "latency" && (
            <FormField label="Region">
              <Select
                selectedOption={AWS_REGIONS.find((r) => r.value === draft.region) ?? null}
                options={AWS_REGIONS}
                expandToViewport
                onChange={({ detail }) => onChange({ region: detail.selectedOption.value! })}
              />
            </FormField>
          )}
          {draft.routingPolicy === "failover" && (
            <FormField label="Failover record type">
              <Select
                selectedOption={{ value: draft.failover, label: draft.failover === "PRIMARY" ? "Primary" : "Secondary" }}
                options={[
                  { value: "PRIMARY", label: "Primary" },
                  { value: "SECONDARY", label: "Secondary" },
                ]}
                onChange={({ detail }) => onChange({ failover: detail.selectedOption.value as "PRIMARY" | "SECONDARY" })}
              />
            </FormField>
          )}
          {draft.routingPolicy === "geolocation" && (
            <FormField label="Location">
              <Select
                selectedOption={GEO_LOCATIONS.find((g) => g.value === draft.geoLocation) ?? null}
                options={GEO_LOCATIONS}
                filteringType="auto"
                expandToViewport
                onChange={({ detail }) => onChange({ geoLocation: detail.selectedOption.value! })}
              />
            </FormField>
          )}
          <FormField label="Health check - optional">
            <Input
              value={draft.healthCheckId}
              placeholder="Choose health check"
              onChange={({ detail }) => onChange({ healthCheckId: detail.value })}
            />
          </FormField>
          <FormField
            label="Record ID"
            description="Enter a value that uniquely identifies this record among the records with the same name and type."
            errorText={errors.set_identifier}
          >
            <Input
              value={draft.setIdentifier}
              placeholder="Enter record ID"
              onChange={({ detail }) => onChange({ setIdentifier: detail.value })}
            />
          </FormField>
        </ColumnLayout>
      )}
    </SpaceBetween>
  );
}
