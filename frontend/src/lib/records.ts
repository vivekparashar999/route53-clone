import type { DnsRecord, RecordInput, RecordType, RoutingPolicy } from "./types";

/** Record types offered in the "Record type" select, with the console's descriptions. */
export const RECORD_TYPES: { value: RecordType; description: string; placeholder: string }[] = [
  { value: "A", description: "Routes traffic to an IPv4 address and some AWS resources", placeholder: "192.0.2.235" },
  { value: "AAAA", description: "Routes traffic to an IPv6 address and some AWS resources", placeholder: "2001:0db8:85a3:0:0:8a2e:0370:7334" },
  { value: "CAA", description: "Restricts CAs that can create SSL/TLS certifications for the domain", placeholder: '0 issue "amazon.com"' },
  { value: "CNAME", description: "Routes traffic to another domain name and to some AWS resources", placeholder: "www.example.com" },
  { value: "DS", description: "Delegation Signer, used to establish a chain of trust for DNSSEC", placeholder: "2371 13 2 1F987CC6583E92DF0890718C42" },
  { value: "MX", description: "Specifies mail servers", placeholder: "10 mailserver.example.com" },
  { value: "NAPTR", description: "Is used by Dynamic Delegation Discovery System (DDDS) applications to convert one value to another", placeholder: '100 100 "U" "E2U+sip" "!^.*$!sip:info@example.com!" .' },
  { value: "NS", description: "Name servers for a hosted zone", placeholder: "ns-1.example.com" },
  { value: "PTR", description: "Maps an IP address to a domain name", placeholder: "hostname.example.com" },
  { value: "SPF", description: "Lists the servers that are authorized to send email from a domain", placeholder: '"v=spf1 ip4:192.168.0.1/16 -all"' },
  { value: "SRV", description: "Application-specific values that identify servers", placeholder: "1 10 5269 xmpp-server.example.com" },
  { value: "TXT", description: "Verifies email senders and application-specific values", placeholder: '"Sample Text Entries"' },
];

export const RECORD_TYPE_OPTIONS = RECORD_TYPES.map((t) => ({
  value: t.value,
  label: t.value,
  description: t.description,
}));

export const ROUTING_POLICIES: { value: RoutingPolicy; label: string; description: string }[] = [
  { value: "simple", label: "Simple routing", description: "Use for a single resource that performs a given function for your domain" },
  { value: "weighted", label: "Weighted", description: "Use to route traffic to multiple resources in proportions that you specify" },
  { value: "geolocation", label: "Geolocation", description: "Use when you want to route traffic based on the location of your users" },
  { value: "latency", label: "Latency", description: "Use when you have resources in multiple AWS Regions and you want to route traffic to the region that provides the best latency" },
  { value: "failover", label: "Failover", description: "Use when you want to configure active-passive failover" },
  { value: "multivalue", label: "Multivalue answer", description: "Use when you want Route 53 to respond to DNS queries with up to eight healthy records selected at random" },
];

export const ROUTING_POLICY_LABEL: Record<RoutingPolicy, string> = {
  simple: "Simple",
  weighted: "Weighted",
  geolocation: "Geolocation",
  latency: "Latency",
  failover: "Failover",
  multivalue: "Multivalue answer",
};

export const AWS_REGIONS: { value: string; label: string }[] = [
  ["us-east-1", "US East (N. Virginia)"],
  ["us-east-2", "US East (Ohio)"],
  ["us-west-1", "US West (N. California)"],
  ["us-west-2", "US West (Oregon)"],
  ["ap-south-1", "Asia Pacific (Mumbai)"],
  ["ap-southeast-1", "Asia Pacific (Singapore)"],
  ["ap-southeast-2", "Asia Pacific (Sydney)"],
  ["ap-northeast-1", "Asia Pacific (Tokyo)"],
  ["ca-central-1", "Canada (Central)"],
  ["eu-central-1", "Europe (Frankfurt)"],
  ["eu-west-1", "Europe (Ireland)"],
  ["eu-west-2", "Europe (London)"],
  ["sa-east-1", "South America (São Paulo)"],
].map(([value, label]) => ({ value, label: `${label} [${value}]` }));

export const GEO_LOCATIONS = [
  "Default",
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
  "India",
  "United States",
  "United Kingdom",
  "Germany",
  "Japan",
].map((v) => ({ value: v, label: v }));

/** Alias endpoint choices in "Route traffic to". */
export const ALIAS_ENDPOINTS = [
  { value: "elb", label: "Alias to Application and Classic Load Balancer", needsRegion: true },
  { value: "nlb", label: "Alias to Network Load Balancer", needsRegion: true },
  { value: "cloudfront", label: "Alias to CloudFront distribution", needsRegion: false, hostedZoneId: "Z2FDTNDATAQYW2" },
  { value: "s3", label: "Alias to S3 website endpoint", needsRegion: true },
  { value: "apigw", label: "Alias to API Gateway API", needsRegion: true },
  { value: "eb", label: "Alias to Elastic Beanstalk environment", needsRegion: true },
  { value: "vpce", label: "Alias to VPC endpoint", needsRegion: true },
  { value: "record", label: "Alias to another record in this hosted zone", needsRegion: false },
];

export const TTL_PRESETS = [
  { label: "1m", value: 60 },
  { label: "1h", value: 3600 },
  { label: "1d", value: 86400 },
];

/** Strip the zone suffix from a FQDN so it can be shown in the "Record name" prefix input. */
export function relativeName(fqdn: string, zoneName: string): string {
  const name = fqdn.toLowerCase();
  const zone = zoneName.toLowerCase();
  if (name === zone) return "";
  if (name.endsWith(`.${zone}`)) return name.slice(0, -(zone.length + 1));
  return name.replace(/\.$/, "");
}

/** Zone name without the trailing dot, the way the console displays it. */
export function displayName(name: string): string {
  return name.replace(/\.$/, "");
}

export function emptyRecord(): RecordInput {
  return {
    name: "",
    type: "A",
    ttl: 300,
    values: [],
    routing_policy: "simple",
    set_identifier: null,
    weight: null,
    region: null,
    failover: null,
    geo_location: null,
    health_check_id: null,
    alias: false,
    alias_target: null,
  };
}

export function toInput(record: DnsRecord): RecordInput {
  const { id: _id, zone_id: _z, is_default: _d, created_at: _c, updated_at: _u, ...input } = record;
  void _id;
  void _z;
  void _d;
  void _c;
  void _u;
  return input;
}

/** The "Differentiator" column: what distinguishes records sharing a name/type. */
export function differentiator(r: DnsRecord): string {
  switch (r.routing_policy) {
    case "weighted":
      return r.weight === null ? "-" : String(r.weight);
    case "latency":
      return r.region ?? "-";
    case "failover":
      return r.failover ? r.failover.charAt(0) + r.failover.slice(1).toLowerCase() : "-";
    case "geolocation":
      return r.geo_location ?? "-";
    default:
      return "-";
  }
}

export function recordValueText(r: DnsRecord): string {
  if (r.alias && r.alias_target) return r.alias_target.dns_name;
  return r.values.join("\n");
}
