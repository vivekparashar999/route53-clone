import json
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(12), primary_key=True)  # 12-digit AWS account id
    alias: Mapped[str | None] = mapped_column(String(63), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    users: Mapped[list["User"]] = relationship(back_populates="account", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("account_id", "username"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"), index=True)
    username: Mapped[str] = mapped_column(String(64))
    display_name: Mapped[str] = mapped_column(String(128))
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    account: Mapped[Account] = relationship(back_populates="users")


class SessionToken(Base):
    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship()


class HostedZone(Base):
    __tablename__ = "hosted_zones"
    __table_args__ = (
        CheckConstraint("type IN ('public', 'private')", name="ck_zone_type"),
        Index("ix_zone_account_name", "account_id", "name"),
        # Route 53 allows duplicate private zones (different VPCs) but not duplicate public ones.
        Index(
            "uq_public_zone_name",
            "account_id",
            "name",
            unique=True,
            sqlite_where=text("type = 'public'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("accounts.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(10), default="public")
    comment: Mapped[str] = mapped_column(Text, default="")
    caller_reference: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    vpcs: Mapped[list["ZoneVpc"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    tags: Mapped[list["ZoneTag"]] = relationship(cascade="all, delete-orphan", passive_deletes=True)
    records: Mapped[list["Record"]] = relationship(
        back_populates="zone", cascade="all, delete-orphan", passive_deletes=True
    )


class ZoneVpc(Base):
    __tablename__ = "zone_vpcs"
    __table_args__ = (UniqueConstraint("zone_id", "region", "vpc_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True)
    region: Mapped[str] = mapped_column(String(32))
    vpc_id: Mapped[str] = mapped_column(String(32))


class ZoneTag(Base):
    __tablename__ = "zone_tags"
    __table_args__ = (UniqueConstraint("zone_id", "key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(128))
    value: Mapped[str] = mapped_column(String(256), default="")


class Record(Base):
    __tablename__ = "records"
    __table_args__ = (
        Index("ix_record_zone_name_type", "zone_id", "name", "type"),
        CheckConstraint(
            "routing_policy IN ('simple','weighted','latency','failover','geolocation','multivalue')",
            name="ck_record_routing_policy",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    zone_id: Mapped[str] = mapped_column(ForeignKey("hosted_zones.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(10))
    ttl: Mapped[int | None] = mapped_column(Integer)
    values_json: Mapped[str] = mapped_column("values", Text, default="[]")
    routing_policy: Mapped[str] = mapped_column(String(16), default="simple")
    set_identifier: Mapped[str | None] = mapped_column(String(128))
    weight: Mapped[int | None] = mapped_column(Integer)
    region: Mapped[str | None] = mapped_column(String(32))
    failover: Mapped[str | None] = mapped_column(String(10))
    geo_location: Mapped[str | None] = mapped_column(String(64))
    health_check_id: Mapped[str | None] = mapped_column(String(64))
    alias: Mapped[bool] = mapped_column(Boolean, default=False)
    alias_dns_name: Mapped[str | None] = mapped_column(String(255))
    alias_hosted_zone_id: Mapped[str | None] = mapped_column(String(32))
    alias_evaluate_target_health: Mapped[bool] = mapped_column(Boolean, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    zone: Mapped[HostedZone] = relationship(back_populates="records")

    @property
    def values(self) -> list[str]:
        return json.loads(self.values_json or "[]")

    @values.setter
    def values(self, items: list[str]) -> None:
        self.values_json = json.dumps(list(items))
