import { ALIAS_ENDPOINTS, relativeName } from "./records";
import type { DnsRecord, RecordInput, RecordType, RoutingPolicy } from "./types";
import { parseValues } from "./validation";

/** Form state for one record. Strings for numeric fields so users can type freely. */
export interface RecordDraft {
  key: string;
  prefix: string;
  type: RecordType;
  alias: boolean;
  aliasEndpoint: string;
  aliasRegion: string;
  aliasDnsName: string;
  evaluateTargetHealth: boolean;
  valuesText: string;
  ttl: string;
  routingPolicy: RoutingPolicy;
  setIdentifier: string;
  weight: string;
  region: string;
  failover: "PRIMARY" | "SECONDARY";
  geoLocation: string;
  healthCheckId: string;
}

let draftCounter = 0;

export function newDraft(): RecordDraft {
  return {
    key: `draft-${++draftCounter}`,
    prefix: "",
    type: "A",
    alias: false,
    aliasEndpoint: "elb",
    aliasRegion: "us-east-1",
    aliasDnsName: "",
    evaluateTargetHealth: true,
    valuesText: "",
    ttl: "300",
    routingPolicy: "simple",
    setIdentifier: "",
    weight: "",
    region: "us-east-1",
    failover: "PRIMARY",
    geoLocation: "Default",
    healthCheckId: "",
  };
}

/** Guess which alias endpoint a stored alias target belongs to, from its DNS name. */
function endpointFor(dns: string): string {
  if (dns.includes("cloudfront.net")) return "cloudfront";
  if (dns.includes("s3-website")) return "s3";
  if (dns.includes("execute-api")) return "apigw";
  if (dns.includes("elasticbeanstalk")) return "eb";
  if (dns.includes("vpce")) return "vpce";
  if (dns.includes(".elb.")) return dns.includes("-net-") ? "nlb" : "elb";
  return "record";
}

export function draftFromRecord(r: DnsRecord, zoneName: string): RecordDraft {
  const d = newDraft();
  const dns = r.alias_target?.dns_name ?? "";
  const regionMatch = dns.match(/(us|eu|ap|sa|ca|me|af)-[a-z]+-\d/);
  return {
    ...d,
    prefix: relativeName(r.name, zoneName),
    type: r.type,
    alias: r.alias,
    aliasEndpoint: r.alias ? endpointFor(dns) : d.aliasEndpoint,
    aliasRegion: regionMatch?.[0] ?? d.aliasRegion,
    aliasDnsName: dns,
    evaluateTargetHealth: r.alias_target?.evaluate_target_health ?? true,
    valuesText: r.values.join("\n"),
    ttl: r.ttl === null ? "300" : String(r.ttl),
    routingPolicy: r.routing_policy,
    setIdentifier: r.set_identifier ?? "",
    weight: r.weight === null ? "" : String(r.weight),
    region: r.region ?? d.region,
    failover: r.failover ?? "PRIMARY",
    geoLocation: r.geo_location ?? "Default",
    healthCheckId: r.health_check_id ?? "",
  };
}

const S3_ZONE_IDS: Record<string, string> = {
  "us-east-1": "Z3AQBSTGFYJSTF",
  "us-west-2": "Z3BJ6K6RIION7M",
  "ap-south-1": "Z11RGJOFQNVJUP",
  "eu-west-1": "Z1BKCTXD74EZPE",
};

function aliasHostedZoneId(d: RecordDraft, zoneId: string): string {
  const endpoint = ALIAS_ENDPOINTS.find((e) => e.value === d.aliasEndpoint);
  if (d.aliasEndpoint === "record") return zoneId;
  if (endpoint?.hostedZoneId) return endpoint.hostedZoneId;
  if (d.aliasEndpoint === "s3") return S3_ZONE_IDS[d.aliasRegion] ?? "Z3AQBSTGFYJSTF";
  return d.aliasEndpoint === "nlb" ? "Z26RNL4JYFTOTI" : "Z35SXDOTRQ7X7K";
}

const ALIAS_TYPES: RecordType[] = ["A", "AAAA", "CNAME"];

export function supportsAlias(type: RecordType): boolean {
  return ALIAS_TYPES.includes(type);
}

export function draftToInput(d: RecordDraft, zoneId: string): RecordInput {
  const alias = d.alias && supportsAlias(d.type);
  const policy = d.routingPolicy;
  const ttl = Number(d.ttl);
  return {
    name: d.prefix.trim().replace(/\.$/, ""),
    type: d.type,
    ttl: alias ? null : d.ttl.trim() === "" || Number.isNaN(ttl) ? NaN : Math.trunc(ttl),
    values: alias ? [] : parseValues(d.valuesText),
    routing_policy: policy,
    set_identifier: policy === "simple" ? null : d.setIdentifier.trim() || null,
    weight: policy === "weighted" ? (d.weight.trim() === "" ? null : Number(d.weight)) : null,
    region: policy === "latency" ? d.region : null,
    failover: policy === "failover" ? d.failover : null,
    geo_location: policy === "geolocation" ? d.geoLocation : null,
    health_check_id: policy === "simple" ? null : d.healthCheckId.trim() || null,
    alias,
    alias_target: alias
      ? {
          dns_name: d.aliasDnsName.trim(),
          hosted_zone_id: aliasHostedZoneId(d, zoneId),
          evaluate_target_health: d.evaluateTargetHealth,
        }
      : null,
  };
}
