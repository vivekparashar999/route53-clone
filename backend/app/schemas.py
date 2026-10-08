from datetime import datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

ZoneType = Literal["public", "private"]
RoutingPolicy = Literal["simple", "weighted", "latency", "failover", "geolocation", "multivalue"]


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


# ---- auth ----

class LoginIn(BaseModel):
    account: str = Field(min_length=1, max_length=63)
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class UserOut(BaseModel):
    id: int
    username: str
    account_id: str
    account_alias: str | None
    display_name: str


# ---- hosted zones ----

class Vpc(BaseModel):
    region: str = Field(min_length=1, max_length=32)
    vpc_id: str = Field(min_length=1, max_length=32)


class Tag(BaseModel):
    key: str = Field(min_length=1, max_length=128)
    value: str = Field(default="", max_length=256)


class HostedZoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    comment: str = Field(default="", max_length=256)
    type: ZoneType = "public"
    vpcs: list[Vpc] = []
    tags: list[Tag] = []


class HostedZoneUpdate(BaseModel):
    comment: str | None = Field(default=None, max_length=256)
    vpcs: list[Vpc] | None = None
    tags: list[Tag] | None = None


class HostedZoneOut(BaseModel):
    id: str
    name: str
    type: ZoneType
    comment: str
    record_count: int
    created_by: str = "Route 53"
    caller_reference: str
    vpcs: list[Vpc]
    tags: list[Tag]
    name_servers: list[str]
    created_at: datetime
    updated_at: datetime


class ImportIn(BaseModel):
    zone_file: str = Field(max_length=1_000_000)


class ImportOut(BaseModel):
    created: int
    skipped: int
    errors: list[str]


# ---- records ----

class AliasTarget(BaseModel):
    dns_name: str = Field(min_length=1, max_length=255)
    hosted_zone_id: str = Field(default="", max_length=32)
    evaluate_target_health: bool = False


class RecordIn(BaseModel):
    name: str = Field(default="", max_length=255)
    type: str = Field(min_length=1, max_length=10)
    ttl: int | None = Field(default=300, ge=0, le=2147483647)
    values: list[str] = []
    routing_policy: RoutingPolicy = "simple"
    set_identifier: str | None = Field(default=None, max_length=128)
    weight: int | None = Field(default=None, ge=0, le=255)
    region: str | None = None
    failover: Literal["PRIMARY", "SECONDARY"] | None = None
    geo_location: str | None = None
    health_check_id: str | None = None
    alias: bool = False
    alias_target: AliasTarget | None = None


class RecordBatchIn(BaseModel):
    records: list[RecordIn] = Field(min_length=1, max_length=1000)


class RecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    zone_id: str
    name: str
    type: str
    ttl: int | None
    values: list[str]
    routing_policy: RoutingPolicy
    set_identifier: str | None
    weight: int | None
    region: str | None
    failover: str | None
    geo_location: str | None
    health_check_id: str | None
    alias: bool
    alias_target: AliasTarget | None
    is_default: bool
    created_at: datetime
    updated_at: datetime


class RecordList(BaseModel):
    items: list[RecordOut]


class BatchDeleteIn(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)


class BatchDeleteOut(BaseModel):
    deleted: int


class DashboardOut(BaseModel):
    hosted_zones: int
    records: int
    health_checks: int = 0
    traffic_policies: int = 0
    domains: int = 0
