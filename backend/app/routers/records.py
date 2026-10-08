from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..auth import current_user
from ..database import get_db
from ..errors import invalid_change
from ..models import Record, User
from ..schemas import BatchDeleteIn, BatchDeleteOut, Page, RecordBatchIn, RecordIn, RecordList, RecordOut, RoutingPolicy
from ..services import dns

router = APIRouter(prefix="/api/hostedzones/{zone_id}/records", tags=["records"])

RecordSort = Literal["name", "type", "ttl", "routing_policy", "created_at"]


@router.get("", response_model=Page[RecordOut])
def list_records(
    zone_id: str,
    q: str | None = None,
    type: str | None = None,
    routing_policy: RoutingPolicy | None = None,
    alias: bool | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=300),
    sort: RecordSort | None = None,
    order: Literal["asc", "desc"] = "asc",
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> Page[RecordOut]:
    zone = dns.get_zone(db, user.account_id, zone_id)
    stmt = select(Record).where(Record.zone_id == zone.id)
    if q:
        like = f"%{q.strip().lower()}%"
        stmt = stmt.where(or_(
            Record.name.like(like), Record.type.like(like), Record.values_json.like(like),
            Record.alias_dns_name.like(like), Record.set_identifier.like(like),
        ))
    if type:
        stmt = stmt.where(Record.type.in_([t.strip().upper() for t in type.split(",") if t.strip()]))
    if routing_policy:
        stmt = stmt.where(Record.routing_policy == routing_policy)
    if alias is not None:
        stmt = stmt.where(Record.alias.is_(alias))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    if sort is None:
        stmt = stmt.order_by(*dns.record_order(zone.name))
    else:
        column = getattr(Record, sort)
        stmt = stmt.order_by(column.desc() if order == "desc" else column.asc(), Record.name, Record.type)
    rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return Page(items=[dns.record_out(r) for r in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=RecordList, status_code=201)
def create_records(
    zone_id: str, body: RecordBatchIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> RecordList:
    zone = dns.get_zone(db, user.account_id, zone_id)
    created = dns.create_records(db, zone, body.records)
    db.commit()
    return RecordList(items=[dns.record_out(r) for r in created])


@router.get("/{record_id}", response_model=RecordOut)
def get_record(zone_id: str, record_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> RecordOut:
    zone = dns.get_zone(db, user.account_id, zone_id)
    return dns.record_out(dns.get_record(db, zone, record_id))


@router.put("/{record_id}", response_model=RecordOut)
def update_record(
    zone_id: str, record_id: int, body: RecordIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> RecordOut:
    zone = dns.get_zone(db, user.account_id, zone_id)
    record = dns.update_record(db, zone, dns.get_record(db, zone, record_id), body)
    db.commit()
    return dns.record_out(record)


@router.delete("/{record_id}", status_code=204)
def delete_record(zone_id: str, record_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Response:
    zone = dns.get_zone(db, user.account_id, zone_id)
    record = dns.get_record(db, zone, record_id)
    dns.assert_record_deletable(record, zone)
    db.delete(record)
    db.commit()
    return Response(status_code=204)


@router.post("/batch-delete", response_model=BatchDeleteOut)
def batch_delete(
    zone_id: str, body: BatchDeleteIn, user: User = Depends(current_user), db: Session = Depends(get_db)
) -> BatchDeleteOut:
    zone = dns.get_zone(db, user.account_id, zone_id)
    ids = set(body.ids)
    records = list(db.scalars(select(Record).where(Record.zone_id == zone.id, Record.id.in_(ids))))
    missing = ids - {r.id for r in records}
    if missing:
        raise invalid_change(f"[Records not found in hosted zone {zone.name}: {sorted(missing)}]")
    for r in records:
        dns.assert_record_deletable(r, zone)
    result = db.execute(delete(Record).where(Record.id.in_(ids)))
    db.commit()
    return BatchDeleteOut(deleted=result.rowcount or 0)
