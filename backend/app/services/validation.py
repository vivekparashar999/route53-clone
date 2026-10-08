"""Record/zone validation that mirrors Route 53's ChangeResourceRecordSets rules and messages."""

import ipaddress
import re
from dataclasses import dataclass

from ..errors import ApiError, invalid_change
from ..schemas import RecordIn

SUPPORTED_TYPES = ("A", "AAAA", "CAA", "CNAME", "DS", "MX", "NAPTR", "NS", "PTR", "SOA", "SPF", "SRV", "TXT")
USER_CREATABLE_TYPES = tuple(t for t in SUPPORTED_TYPES if t != "SOA")
ALIAS_TYPES = ("A", "AAAA", "CNAME", "MX", "TXT", "PTR", "SPF", "SRV", "NAPTR", "CAA", "DS")
CAA_TAGS = ("issue", "issuewild", "iodef", "issuemail", "issuevmc", "contactemail", "contactphone")
AWS_REGIONS = (
    "us-east-1", "us-east-2", "us-west-1", "us-west-2", "af-south-1", "ap-east-1", "ap-south-1",
    "ap-south-2", "ap-southeast-1", "ap-southeast-2", "ap-southeast-3", "ap-northeast-1",
    "ap-northeast-2", "ap-northeast-3", "ca-central-1", "eu-central-1", "eu-central-2", "eu-west-1",
    "eu-west-2", "eu-west-3", "eu-north-1", "eu-south-1", "me-south-1", "me-central-1", "sa-east-1",
)

_LABEL = re.compile(r"^(?!-)[a-z0-9_-]{1,63}(?<!-)$")


def _rr_error(code: str, desc: str, value: str) -> ApiError:
    return invalid_change(f"[Invalid Resource Record: 'FATAL problem: {code} ({desc}) encountered with '{value}'']")


def normalize_zone_name(raw: str) -> str:
    name = raw.strip().lower().rstrip(".")
    if not name:
        raise ApiError(400, "InvalidDomainName", "Domain name is required.")
    labels = name.split(".")
    if len(name) > 253 or any(not _LABEL.match(label) for label in labels):
        raise ApiError(400, "InvalidDomainName", f"{raw} is reserved by AWS or is not a valid domain name.")
    return name + "."


def qualify(raw: str, zone_name: str) -> str:
    """Turn '', '@', 'www' or 'www.example.com[.]' into an absolute, lowercase name inside the zone."""
    name = raw.strip().lower()
    if name in ("", "@"):
        return zone_name
    apex = zone_name.rstrip(".")
    bare = name.rstrip(".")
    if not (bare == apex or bare.endswith("." + apex)):
        if name.endswith("."):
            raise invalid_change(f"[RRSet with DNS name {name} is not permitted in zone {zone_name}]")
        bare = f"{bare}.{apex}"
    fqdn = bare + "."
    labels = bare.split(".")
    for i, label in enumerate(labels):
        if label == "*" and i == 0:
            continue
        if not _LABEL.match(label):
            raise invalid_change(f"[RRSet with DNS name {fqdn} is not permitted because it contains an invalid label]")
    if len(fqdn) > 255:
        raise invalid_change(f"[DNS name {fqdn} is too long]")
    return fqdn


def _is_hostname(value: str) -> bool:
    bare = value.strip().lower().rstrip(".")
    if not bare or len(bare) > 253:
        return False
    labels = bare.split(".")
    return all(_LABEL.match(lb) or (lb == "*" and i == 0) for i, lb in enumerate(labels))


def _check_hostname(value: str) -> str:
    if not _is_hostname(value):
        raise _rr_error("DomainLabelEmpty" if ".." in value else "InvalidCharacterString",
                        "Value is not a valid domain name", value)
    return value.strip()


def _int_in(token: str, lo: int, hi: int) -> bool:
    return token.isdigit() and lo <= int(token) <= hi


def _quote_txt(value: str) -> str:
    v = value.strip()
    if len(v) >= 2 and v.startswith('"') and v.endswith('"'):
        segments = re.findall(r'"((?:[^"\\]|\\.)*)"', v)
        if any(len(s) > 255 for s in segments):
            raise _rr_error("CharacterStringTooLong", "Value is too long", value)
        return v
    if len(v) > 255:
        # Route 53 requires long TXT values to be split into 255-char strings; do it for the user.
        return " ".join(f'"{v[i:i + 255]}"' for i in range(0, len(v), 255))
    return '"' + v.replace('"', '\\"') + '"'


def _validate_value(rtype: str, value: str) -> str:
    v = value.strip()
    if not v:
        raise _rr_error("InvalidCharacterString", "Value should not be empty", value)
    parts = v.split()
    if rtype == "A":
        try:
            ipaddress.IPv4Address(v)
        except ValueError:
            raise _rr_error("ARRDATAIllegalIPv4Address", "Value is not a valid IPv4 address", v) from None
        return v
    if rtype == "AAAA":
        try:
            return str(ipaddress.IPv6Address(v))
        except ValueError:
            raise _rr_error("AAAARRDATAIllegalIPv6Address", "Value is not a valid IPv6 address", v) from None
    if rtype in ("CNAME", "NS", "PTR"):
        return _check_hostname(v)
    if rtype == "MX":
        if len(parts) != 2 or not _int_in(parts[0], 0, 65535) or not _is_hostname(parts[1]):
            raise _rr_error("MXRRDATAIllegalFormat", "Value must be in the format: priority mail-server, e.g. 10 mail.example.com", v)
        return f"{int(parts[0])} {parts[1]}"
    if rtype == "SRV":
        if (len(parts) != 4 or not all(_int_in(p, 0, 65535) for p in parts[:3])
                or not (parts[3] == "." or _is_hostname(parts[3]))):
            raise _rr_error("SRVRRDATAIllegalFormat", "Value must be in the format: priority weight port target", v)
        return " ".join(parts)
    if rtype == "CAA":
        m = re.fullmatch(r'(\d{1,3})\s+([A-Za-z0-9]+)\s+(".*"|\S+)', v)
        if not m or int(m.group(1)) > 255 or m.group(2).lower() not in CAA_TAGS:
            raise _rr_error("CAARRDATAIllegalFormat", 'Value must be in the format: flags tag "value", e.g. 0 issue "amazon.com"', v)
        val = m.group(3) if m.group(3).startswith('"') else f'"{m.group(3)}"'
        return f"{m.group(1)} {m.group(2).lower()} {val}"
    if rtype in ("TXT", "SPF"):
        return _quote_txt(v)
    if rtype == "SOA":
        if len(parts) != 7 or not all(p.isdigit() for p in parts[2:]):
            raise _rr_error("SOARRDATAIllegalFormat", "Value must contain 7 fields", v)
        return " ".join(parts)
    if rtype == "DS":
        if len(parts) != 4 or not all(p.isdigit() for p in parts[:3]):
            raise _rr_error("DSRRDATAIllegalFormat", "Value must be in the format: key-tag algorithm digest-type digest", v)
        return " ".join(parts)
    if rtype == "NAPTR":
        if len(parts) < 6:
            raise _rr_error("NAPTRRRDATAIllegalFormat", "Value must contain 6 fields", v)
        return v
    return v


@dataclass
class NormalizedRecord:
    name: str
    type: str
    ttl: int | None
    values: list[str]
    routing_policy: str = "simple"
    set_identifier: str | None = None
    weight: int | None = None
    region: str | None = None
    failover: str | None = None
    geo_location: str | None = None
    health_check_id: str | None = None
    alias: bool = False
    alias_dns_name: str | None = None
    alias_hosted_zone_id: str | None = None
    alias_evaluate_target_health: bool = False


def normalize_record(data: RecordIn, zone_name: str, *, allow_soa: bool = False) -> NormalizedRecord:
    rtype = data.type.strip().upper()
    if rtype not in SUPPORTED_TYPES or (rtype == "SOA" and not allow_soa):
        raise invalid_change(f"[Record type {rtype} is not supported]")
    name = qualify(data.name, zone_name)

    if rtype == "CNAME" and name == zone_name:
        raise invalid_change(f"[RRSet of type CNAME with DNS name {name} is not permitted at apex in zone {zone_name}]")

    rec = NormalizedRecord(name=name, type=rtype, ttl=None, values=[], routing_policy=data.routing_policy)

    if data.alias:
        if rtype not in ALIAS_TYPES or data.alias_target is None:
            raise invalid_change(f"[Alias target is required for alias record {name} of type {rtype}]")
        target = data.alias_target.dns_name.strip().lower()
        if not _is_hostname(target):
            raise invalid_change(f"[Tried to create an alias that targets {target}, which is not a valid DNS name]")
        rec.alias = True
        rec.alias_dns_name = target if target.endswith(".") else target + "."
        rec.alias_hosted_zone_id = data.alias_target.hosted_zone_id or None
        rec.alias_evaluate_target_health = data.alias_target.evaluate_target_health
    else:
        values = [v for v in (x.strip() for x in data.values) if v]
        if not values:
            raise invalid_change(f"[Invalid Resource Record: 'FATAL problem: ResourceRecordsEmpty (Resource records are required) encountered with '{name}'']")
        if rtype in ("CNAME", "SOA") and len(values) > 1:
            raise invalid_change(f"[RRSet of type {rtype} with DNS name {name} must contain exactly one resource record]")
        normalized = [_validate_value(rtype, v) for v in values]
        if len(set(normalized)) != len(normalized):
            raise invalid_change(f"[Duplicate Resource Record: '{normalized[0]}']")
        rec.values = normalized
        rec.ttl = 300 if data.ttl is None else data.ttl

    _apply_routing(rec, data)
    return rec


def _apply_routing(rec: NormalizedRecord, data: RecordIn) -> None:
    policy = data.routing_policy
    if policy == "simple":
        return
    if not (data.set_identifier and data.set_identifier.strip()):
        raise invalid_change(f"[A record ID (SetIdentifier) is required for {policy} routing on {rec.name}]")
    rec.set_identifier = data.set_identifier.strip()
    rec.health_check_id = data.health_check_id or None
    if policy == "weighted":
        if data.weight is None:
            raise invalid_change("[Weight is required for weighted routing]")
        rec.weight = data.weight
    elif policy == "latency":
        if data.region not in AWS_REGIONS:
            raise invalid_change(f"[Invalid region for latency routing: {data.region}]")
        rec.region = data.region
    elif policy == "failover":
        if data.failover is None:
            raise invalid_change("[Failover record type (PRIMARY or SECONDARY) is required]")
        rec.failover = data.failover
    elif policy == "geolocation":
        if not data.geo_location:
            raise invalid_change("[Location is required for geolocation routing]")
        rec.geo_location = data.geo_location
    elif policy == "multivalue" and rec.alias:
        raise invalid_change("[Multivalue answer routing is not supported for alias records]")
