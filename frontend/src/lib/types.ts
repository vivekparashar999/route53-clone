export interface User {
  id: number;
  username: string;
  account_id: string;
  account_alias: string | null;
  display_name: string;
}

export type ZoneType = "public" | "private";

export interface Vpc {
  region: string;
  vpc_id: string;
}

export interface Tag {
  key: string;
  value: string;
}

export interface HostedZone {
  id: string;
  name: string;
  type: ZoneType;
  comment: string;
  record_count: number;
  created_by: string;
  caller_reference: string;
  vpcs: Vpc[];
  tags: Tag[];
  name_servers: string[];
  created_at: string;
  updated_at: string;
}

export type RecordType =
  | "A"
  | "AAAA"
  | "CAA"
  | "CNAME"
  | "DS"
  | "MX"
  | "NAPTR"
  | "NS"
  | "PTR"
  | "SOA"
  | "SPF"
  | "SRV"
  | "TXT";

export type RoutingPolicy = "simple" | "weighted" | "latency" | "failover" | "geolocation" | "multivalue";

export interface AliasTarget {
  dns_name: string;
  hosted_zone_id: string;
  evaluate_target_health: boolean;
}

export interface DnsRecord {
  id: number;
  zone_id: string;
  name: string;
  type: RecordType;
  ttl: number | null;
  values: string[];
  routing_policy: RoutingPolicy;
  set_identifier: string | null;
  weight: number | null;
  region: string | null;
  failover: "PRIMARY" | "SECONDARY" | null;
  geo_location: string | null;
  health_check_id: string | null;
  alias: boolean;
  alias_target: AliasTarget | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type RecordInput = Omit<DnsRecord, "id" | "zone_id" | "is_default" | "created_at" | "updated_at">;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DashboardSummary {
  hosted_zones: number;
  records: number;
  health_checks: number;
  traffic_policies: number;
  domains: number;
}
