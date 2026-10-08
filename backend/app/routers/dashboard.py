from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_user
from ..database import get_db
from ..models import HostedZone, Record, User
from ..schemas import DashboardOut

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)) -> DashboardOut:
    zones = db.scalar(select(func.count(HostedZone.id)).where(HostedZone.account_id == user.account_id)) or 0
    records = db.scalar(
        select(func.count(Record.id)).join(HostedZone).where(HostedZone.account_id == user.account_id)
    ) or 0
    return DashboardOut(hosted_zones=zones, records=records)
