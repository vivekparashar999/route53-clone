import json
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..auth import current_user
from ..database import get_db
from ..errors import ApiError
from ..models import HostedZone, Record, User
from ..schemas import HostedZoneCreate, HostedZoneOut, HostedZoneUpdate, ImportIn, ImportOut, Page, RecordIn
from ..services import bind, dns

router = APIRouter(prefix="/api/hostedzones", tags=["hosted zones"])

ZoneSort = Literal["name", "type", "record_count", "comment", "id", "created_at"]


@router.get("", response_model=Page[HostedZoneOut])
def list_zones(
    q: str | None = None,
    name: str | None = None,
    type: Literal["public", "private"] | None = None,
    comment: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort: ZoneSort = "name",
    order: Literal["asc", "desc"] = "asc",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Page[HostedZoneOut]:
    counts = (
        select(Record.zone_id, func.count(Record.id).label("n")).group_by(Record.zone_id).subquery()
    )
    record_count = func.coalesce(counts.c.n, 0)
    stmt = (
        select(HostedZone, record_count)
        .outerjoin(counts, counts.c.zone_id == HostedZone.id)
        .where(HostedZone.account_id == user.account_id)
    )
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(HostedZone.name.like(like), HostedZone.comment.like(like), HostedZone.id.like(like)))
    if name:
        stmt = stmt.where(HostedZone.name.like(f"%{name.strip().lower()}%"))
    if comment:
        stmt = stmt.where(HostedZone.comment.like(f"%{comment.strip()}%"))
    if type:
        stmt = stmt.where(HostedZone.type == type)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    column = record_count if sort == "record_count" else getattr(HostedZone, sort)
    stmt = stmt.order_by(column.desc() if order == "desc" else column.asc(), HostedZone.name)
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[dns.zone_out(z, n) for z, n in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=HostedZoneOut, status_code=201)
def create_zone(body: HostedZoneCreate, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HostedZoneOut:
    zone = dns.create_zone(db, user.account_id, body)
    db.commit()
    return dns.zone_out(zone, dns.record_count(db, zone.id))


@router.get("/{zone_id}", response_model=HostedZoneOut)
def get_zone(zone_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> HostedZoneOut:
    zone = dns.get_zone(db, user.account_id, zone_id)
    return dns.zone_out(zone, dns.record_count(db, zone.id))


@router.patch("/{zone_id}", response_model=HostedZoneOut)
def update_zone(
    zone_id: str, body: HostedZoneUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> HostedZoneOut:
    zone = dns.get_zone(db, user.account_id, zone_id)
    if body.comment is not None:
        zone.comment = body.comment.strip()
    dns.update_zone_children(zone, body.vpcs, body.tags)
    db.commit()
    return dns.zone_out(zone, dns.record_count(db, zone.id))


@router.delete("/{zone_id}", status_code=204)
def delete_zone(zone_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    zone = dns.get_zone(db, user.account_id, zone_id)
    dns.assert_zone_deletable(db, zone)
    db.delete(zone)
    db.commit()
    return Response(status_code=204)


@router.get("/{zone_id}/export")
def export_zone(
    zone_id: str,
    format: Literal["json", "bind"] = "json",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Response:
    zone = dns.get_zone(db, user.account_id, zone_id)
    records = list(db.scalars(select(Record).where(Record.zone_id == zone.id).order_by(*dns.record_order(zone.name))))
    stem = zone.name.rstrip(".")
    if format == "bind":
        body, media, filename = bind.export_zone_file(zone.name, records), "text/plain", f"{stem}.zone"
    else:
        payload = {
            "hosted_zone": dns.zone_out(zone, len(records)).model_dump(mode="json"),
            "records": [dns.record_out(r).model_dump(mode="json") for r in records],
        }
        body, media, filename = json.dumps(payload, indent=2), "application/json", f"{stem}.json"
    return Response(body, media_type=media, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.post("/{zone_id}/import", response_model=ImportOut)
def import_zone(
    zone_id: str, body: ImportIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> ImportOut:
    zone = dns.get_zone(db, user.account_id, zone_id)
    rrsets, errors = bind.parse_zone_file(body.zone_file, zone.name)
    if not rrsets and not errors:
        raise ApiError(400, "InvalidInput", "The zone file doesn't contain any records.")
    created = skipped = 0
    for rr in rrsets:
        if rr.name == zone.name and rr.type in ("SOA", "NS"):
            skipped += 1  # the zone already has its own apex NS/SOA, as in the Route 53 console
            continue
        if rr.type == "SOA":
            skipped += 1
            errors.append(f"{rr.name} SOA: SOA records are only allowed at the zone apex")
            continue
        record_in = RecordIn(name=rr.name, type=rr.type, ttl=rr.ttl if rr.ttl is not None else 300, values=rr.values)
        try:
            with db.begin_nested():
                dns.create_records(db, zone, [record_in])
            created += 1
        except ApiError as exc:
            skipped += 1
            errors.append(f"{rr.name} {rr.type}: {exc.message}")
    db.commit()
    return ImportOut(created=created, skipped=skipped, errors=errors)
