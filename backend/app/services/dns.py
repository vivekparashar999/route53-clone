"""Hosted zone / record domain logic shared by routers, BIND import and seeding."""

from collections.abc import Iterable
from datetime import datetime, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..errors import ApiError, invalid_change, not_found
from ..models import HostedZone, Record, ZoneTag, ZoneVpc
from ..schemas import AliasTarget, HostedZoneCreate, HostedZoneOut, RecordIn, RecordOut, Tag, Vpc
from . import ids
from .validation import NormalizedRecord, normalize_record, normalize_zone_name

DEFAULT_NS_TTL = 172800
DEFAULT_SOA_TTL = 900


# ---------- serialization ----------

def _utc(dt: datetime) -> datetime:
    """SQLite drops tzinfo; values are always written as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def record_out(r: Record) -> RecordOut:
    alias_target = (
        AliasTarget(
            dns_name=r.alias_dns_name or "",
            hosted_zone_id=r.alias_hosted_zone_id or "",
            evaluate_target_health=r.alias_evaluate_target_health,
        )
        if r.alias
        else None
    )
    return RecordOut(
        id=r.id, zone_id=r.zone_id, name=r.name, type=r.type, ttl=r.ttl, values=r.values,
        routing_policy=r.routing_policy, set_identifier=r.set_identifier, weight=r.weight,
        region=r.region, failover=r.failover, geo_location=r.geo_location,
        health_check_id=r.health_check_id, alias=r.alias, alias_target=alias_target,
        is_default=r.is_default, created_at=_utc(r.created_at), updated_at=_utc(r.updated_at),
    )


def zone_out(zone: HostedZone, record_count: int) -> HostedZoneOut:
    return HostedZoneOut(
        id=zone.id, name=zone.name, type=zone.type, comment=zone.comment,
        record_count=record_count, caller_reference=zone.caller_reference,
        vpcs=[Vpc(region=v.region, vpc_id=v.vpc_id) for v in zone.vpcs],
        tags=[Tag(key=t.key, value=t.value) for t in zone.tags],
        name_servers=ids.name_servers(zone.id),
        created_at=_utc(zone.created_at), updated_at=_utc(zone.updated_at),
    )


def record_count(db: Session, zone_id: str) -> int:
    return db.scalar(select(func.count(Record.id)).where(Record.zone_id == zone_id)) or 0


# ---------- zones ----------

def get_zone(db: Session, account_id: str, zone_id: str) -> HostedZone:
    zone = db.get(HostedZone, zone_id)
    if zone is None or zone.account_id != account_id:
        raise not_found("hosted zone", zone_id)
    return zone


def create_zone(db: Session, account_id: str, data: HostedZoneCreate) -> HostedZone:
    name = normalize_zone_name(data.name)
    if data.type == "private" and not data.vpcs:
        raise ApiError(400, "InvalidVPCId", "A private hosted zone must be associated with at least one VPC.")
    if data.type == "public":
        exists = db.scalar(
            select(HostedZone.id).where(
                HostedZone.account_id == account_id, HostedZone.name == name, HostedZone.type == "public"
            )
        )
        if exists:
            raise ApiError(409, "HostedZoneAlreadyExists",
                           f"A public hosted zone named {name} already exists in this account ({exists}).")

    zone = HostedZone(
        id=ids.hosted_zone_id(), account_id=account_id, name=name, type=data.type,
        comment=data.comment.strip(), caller_reference=ids.caller_reference(),
    )
    zone.vpcs = [ZoneVpc(region=v.region, vpc_id=v.vpc_id) for v in _unique_vpcs(data.vpcs)] if data.type == "private" else []
    zone.tags = [ZoneTag(key=t.key, value=t.value) for t in _unique_tags(data.tags)]
    servers = ids.name_servers(zone.id)
    zone.records = [
        _default_record(name, "NS", DEFAULT_NS_TTL, servers),
        _default_record(name, "SOA", DEFAULT_SOA_TTL, [ids.soa_value(servers[0])]),
    ]
    db.add(zone)
    return zone


def update_zone_children(zone: HostedZone, vpcs: list[Vpc] | None, tags: list[Tag] | None) -> None:
    if vpcs is not None and zone.type == "private":
        if not vpcs:
            raise ApiError(400, "LastVPCAssociation", "A private hosted zone must remain associated with at least one VPC.")
        zone.vpcs = [ZoneVpc(region=v.region, vpc_id=v.vpc_id) for v in _unique_vpcs(vpcs)]
    if tags is not None:
        zone.tags = [ZoneTag(key=t.key, value=t.value) for t in _unique_tags(tags)]


def assert_zone_deletable(db: Session, zone: HostedZone) -> None:
    extra = db.scalar(
        select(func.count(Record.id)).where(Record.zone_id == zone.id, Record.is_default.is_(False))
    )
    if extra:
        raise ApiError(
            400, "HostedZoneNotEmpty",
            f"The specified hosted zone contains non-required resource record sets and so cannot be deleted. "
            f"Delete the {extra} record(s) other than the default NS and SOA records first.",
        )


def _default_record(zone_name: str, rtype: str, ttl: int, values: list[str]) -> Record:
    r = Record(name=zone_name, type=rtype, ttl=ttl, routing_policy="simple", is_default=True)
    r.values = values
    return r


def _unique_vpcs(vpcs: Iterable[Vpc]) -> list[Vpc]:
    return list({(v.region, v.vpc_id): v for v in vpcs}.values())


def _unique_tags(tags: Iterable[Tag]) -> list[Tag]:
    return list({t.key: t for t in tags}.values())


# ---------- records ----------

def record_order(zone_name: str):
    """Route 53 console order: apex first, NS before SOA at the apex, then name, then type."""
    return (
        case((Record.name == zone_name, 0), else_=1),
        Record.name,
        case((Record.type == "NS", 0), (Record.type == "SOA", 1), else_=2),
        Record.type,
        Record.set_identifier,
    )


def get_record(db: Session, zone: HostedZone, record_id: int) -> Record:
    record = db.get(Record, record_id)
    if record is None or record.zone_id != zone.id:
        raise not_found("record", record_id)
    return record


def _check_conflicts(existing: list[Record | NormalizedRecord], new: NormalizedRecord, zone_name: str) -> None:
    for other in existing:
        if other.name != new.name:
            continue
        if other.type == new.type and (other.set_identifier or None) == (new.set_identifier or None):
            raise ApiError(
                409, "RecordAlreadyExists",
                f"[Tried to create resource record set [name='{new.name}', type='{new.type}'"
                + (f", set-identifier='{new.set_identifier}'" if new.set_identifier else "")
                + "] but it already exists]",
            )
        if "CNAME" in (new.type, other.type) and other.type != new.type:
            raise invalid_change(
                f"[RRSet of type {new.type} with DNS name {new.name} is not permitted because a conflicting "
                f"RRSet of type {other.type} with the same DNS name already exists in zone {zone_name}]"
            )
        if other.type == new.type and other.routing_policy != new.routing_policy:
            raise invalid_change(
                f"[RRSet with DNS name {new.name}, type {new.type} cannot be created as a "
                f"{other.routing_policy} set exists with the same name and type and a different routing policy]"
            )


def _apply(record: Record, n: NormalizedRecord) -> None:
    record.name, record.type, record.ttl = n.name, n.type, n.ttl
    record.values = n.values
    record.routing_policy, record.set_identifier, record.weight = n.routing_policy, n.set_identifier, n.weight
    record.region, record.failover, record.geo_location = n.region, n.failover, n.geo_location
    record.health_check_id = n.health_check_id
    record.alias, record.alias_dns_name = n.alias, n.alias_dns_name
    record.alias_hosted_zone_id = n.alias_hosted_zone_id
    record.alias_evaluate_target_health = n.alias_evaluate_target_health


def create_records(db: Session, zone: HostedZone, inputs: list[RecordIn]) -> list[Record]:
    """Atomic like a ChangeBatch: either every record is valid and created, or nothing is."""
    existing: list[Record | NormalizedRecord] = list(db.scalars(select(Record).where(Record.zone_id == zone.id)))
    created: list[Record] = []
    for data in inputs:
        n = normalize_record(data, zone.name)
        _check_conflicts(existing, n, zone.name)
        existing.append(n)
        record = Record(zone_id=zone.id, is_default=False)
        _apply(record, n)
        created.append(record)
    db.add_all(created)
    return created


def update_record(db: Session, zone: HostedZone, record: Record, data: RecordIn) -> Record:
    if record.is_default:
        # Route 53 lets you edit TTL/values of the apex NS and SOA, but not rename or retype them.
        data = data.model_copy(update={"name": record.name, "type": record.type, "routing_policy": "simple", "alias": False})
    n = normalize_record(data, zone.name, allow_soa=record.is_default)
    others = list(db.scalars(select(Record).where(Record.zone_id == zone.id, Record.id != record.id)))
    _check_conflicts(others, n, zone.name)
    _apply(record, n)
    return record


def assert_record_deletable(record: Record, zone: HostedZone) -> None:
    if record.is_default:
        raise invalid_change(
            f"[A HostedZone must contain at least one NS record and one SOA record for the zone itself. "
            f"The {record.type} record for {zone.name} can't be deleted.]"
        )
