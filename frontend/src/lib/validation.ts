import type { RecordInput } from "./types";

const LABEL = "(?!-)[a-z0-9_*-]{1,63}(?<!-)";
const DOMAIN_RE = new RegExp(`^(?=.{1,253}\\.?$)(?:${LABEL}\\.)*${LABEL}\\.?$`, "i");
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function isHostname(v: string): boolean {
  return v === "." || DOMAIN_RE.test(v);
}

export function isIPv4(v: string): boolean {
  return IPV4_RE.test(v);
}

export function isIPv6(v: string): boolean {
  if (!/^[0-9a-f:.]+$/i.test(v) || v.split("::").length > 2) return false;
  const [head, tail] = v.includes("::") ? v.split("::") : [v, undefined];
  const groups = [...head.split(":").filter(Boolean), ...(tail ? tail.split(":").filter(Boolean) : [])];
  let count = groups.length;
  const last = groups[groups.length - 1];
  if (last && last.includes(".")) {
    if (!isIPv4(last)) return false;
    count += 1; // embedded IPv4 takes two groups
  }
  if (!groups.slice(0, last?.includes(".") ? -1 : undefined).every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return false;
  return tail === undefined ? count === 8 : count < 8;
}

export function validateDomain(name: string): string | null {
  const v = name.trim();
  if (!v) return "Domain name is required.";
  if (v.length > 254) return "Domain name must be 254 characters or fewer.";
  if (!DOMAIN_RE.test(v) || v.includes("*")) return "Enter a valid domain name, such as example.com.";
  return null;
}

export function validateRecordName(prefix: string): string | null {
  if (!prefix) return null; // apex
  if (!DOMAIN_RE.test(prefix.replace(/\.$/, ""))) return "Record name contains characters that aren't valid.";
  return null;
}

/** Client-side check of a single value; returns an error message or null. The API re-validates. */
function validateValue(type: string, v: string): string | null {
  switch (type) {
    case "A":
      return isIPv4(v) ? null : `"${v}" is not a valid IPv4 address.`;
    case "AAAA":
      return isIPv6(v) ? null : `"${v}" is not a valid IPv6 address.`;
    case "CNAME":
    case "NS":
    case "PTR":
      return isHostname(v.replace(/\.$/, "") || ".") ? null : `"${v}" is not a valid domain name.`;
    case "MX": {
      const m = v.match(/^(\d+)\s+(\S+)$/);
      if (!m) return `MX value "${v}" must be in the format "priority mail-server", e.g. 10 mail.example.com.`;
      return Number(m[1]) <= 65535 ? null : "MX priority must be between 0 and 65535.";
    }
    case "SRV": {
      const m = v.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)$/);
      if (!m) return `SRV value "${v}" must be in the format "priority weight port target".`;
      return [m[1], m[2], m[3]].every((n) => Number(n) <= 65535) ? null : "SRV numbers must be between 0 and 65535.";
    }
    case "CAA":
      return /^\d{1,3}\s+(issue|issuewild|iodef|issuemail|contactemail|contactphone)\s+".*"$/i.test(v)
        ? null
        : `CAA value "${v}" must be in the format: flags tag "value", e.g. 0 issue "amazon.com".`;
    case "TXT":
    case "SPF":
      return v.length > 4000 ? "Each TXT value must be 4,000 characters or fewer." : null;
    default:
      return null;
  }
}

export interface RecordErrors {
  name?: string;
  values?: string;
  ttl?: string;
  set_identifier?: string;
  weight?: string;
  alias?: string;
}

export function validateRecord(r: RecordInput, prefix: string): RecordErrors {
  const errors: RecordErrors = {};
  const nameErr = validateRecordName(prefix);
  if (nameErr) errors.name = nameErr;
  if (r.type === "CNAME" && !prefix) errors.name = "A CNAME record can't be created at the zone apex.";

  if (r.alias) {
    if (!r.alias_target?.dns_name.trim()) errors.alias = "Choose or enter the endpoint to route traffic to.";
  } else {
    if (r.values.length === 0) errors.values = "Enter at least one value.";
    else if (r.type === "CNAME" && r.values.length > 1) errors.values = "A CNAME record can have only one value.";
    else {
      for (const v of r.values) {
        const e = validateValue(r.type, v);
        if (e) {
          errors.values = e;
          break;
        }
      }
    }
    if (r.ttl === null || Number.isNaN(r.ttl) || r.ttl < 0 || r.ttl > 2147483647) {
      errors.ttl = "TTL must be a whole number between 0 and 2147483647.";
    }
  }

  if (r.routing_policy !== "simple" && !r.set_identifier?.trim()) {
    errors.set_identifier = "Record ID is required for this routing policy.";
  }
  if (r.routing_policy === "weighted" && (r.weight === null || r.weight < 0 || r.weight > 255)) {
    errors.weight = "Weight must be a number between 0 and 255.";
  }
  return errors;
}

export function parseValues(text: string): string[] {
  return text
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}
