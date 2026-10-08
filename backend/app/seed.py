"""Demo account + realistic sample zones, inserted only into an empty database."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from .auth import hash_password
from .models import Account, User
from .schemas import AliasTarget, HostedZoneCreate, RecordIn, Tag, Vpc
from .services import dns

DEMO_ACCOUNT_ID = "123456789012"
DEMO_ALIAS = "demo"
DEMO_USERNAME = "admin"
DEMO_PASSWORD = "Route53Demo!"


def _r(name: str, rtype: str, *values: str, ttl: int = 300, **extra) -> RecordIn:
    return RecordIn(name=name, type=rtype, ttl=ttl, values=list(values), **extra)


SAMPLE_ZONES: list[tuple[HostedZoneCreate, list[RecordIn]]] = [
    (
        HostedZoneCreate(name="example.com", comment="Primary marketing site",
                         tags=[Tag(key="Environment", value="production"), Tag(key="Owner", value="web-team")]),
        [
            _r("", "A", "192.0.2.10", "192.0.2.11"),
            _r("", "AAAA", "2001:db8::10"),
            _r("", "MX", "10 inbound-smtp.us-east-1.amazonaws.com", "20 mx2.example.com"),
            _r("", "TXT", '"v=spf1 include:amazonses.com ~all"', '"google-site-verification=3x4mpl3t0k3n"'),
            _r("", "CAA", '0 issue "amazon.com"', '0 issue "letsencrypt.org"', '0 iodef "mailto:security@example.com"', ttl=3600),
            _r("www", "CNAME", "example.com"),
            _r("api", "A", "", alias=True, ttl=None,
               alias_target=AliasTarget(dns_name="my-api-alb-1234567890.us-east-1.elb.amazonaws.com",
                                        hosted_zone_id="Z35SXDOTRQ7X7K", evaluate_target_health=True)),
            _r("cdn", "A", "", alias=True, ttl=None,
               alias_target=AliasTarget(dns_name="d111111abcdef8.cloudfront.net", hosted_zone_id="Z2FDTNDATAQYW2")),
            _r("app", "A", "198.51.100.20", routing_policy="weighted", set_identifier="blue", weight=80),
            _r("app", "A", "198.51.100.21", routing_policy="weighted", set_identifier="green", weight=20),
            _r("eu", "A", "203.0.113.5", routing_policy="latency", set_identifier="eu-west-1", region="eu-west-1"),
            _r("eu", "A", "203.0.113.6", routing_policy="latency", set_identifier="us-east-1", region="us-east-1"),
            _r("status", "A", "198.51.100.40", routing_policy="failover", set_identifier="status-primary", failover="PRIMARY",
               health_check_id="7d3e5f2a-1c4b-4e8a-9f60-2b7c1d0e9a11"),
            _r("status", "A", "198.51.100.41", routing_policy="failover", set_identifier="status-secondary", failover="SECONDARY"),
            _r("mail", "A", "192.0.2.25"),
            _r("mx2", "A", "192.0.2.26"),
            _r("vpn", "A", "192.0.2.30"),
            _r("blog", "CNAME", "example.ghost.io"),
            _r("shop", "CNAME", "shops.myshopify.com"),
            _r("docs", "CNAME", "example.readthedocs.io"),
            _r("staging", "A", "10.20.0.15", ttl=60),
            _r("dev", "A", "10.20.0.16", ttl=60),
            _r("ipv6", "AAAA", "2001:db8::1", "2001:db8::2"),
            _r("_sip._tcp", "SRV", "10 60 5060 sip1.example.com", "20 40 5060 sip2.example.com"),
            _r("_xmpp-server._tcp", "SRV", "5 0 5269 xmpp.example.com"),
            _r("_dmarc", "TXT", '"v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"'),
            _r("selector1._domainkey", "CNAME", "selector1-example-com._domainkey.example.onmicrosoft.com"),
            _r("_acme-challenge", "TXT", '"gk3Jx9vQ0wR2nM8pL5tY7uA1sD4fH6jK"', ttl=60),
            _r("sip1", "A", "192.0.2.50"),
            _r("sip2", "A", "192.0.2.51"),
            _r("xmpp", "A", "192.0.2.52"),
            _r("legacy", "A", "192.0.2.60", "192.0.2.61", routing_policy="multivalue", set_identifier="legacy-1"),
            _r("dev-delegated", "NS", "ns1.dev-dns.net", "ns2.dev-dns.net", ttl=86400),
        ],
    ),
    (
        HostedZoneCreate(name="acme-shop.io", comment="Storefront - managed by platform team"),
        [
            _r("", "A", "", alias=True, ttl=None,
               alias_target=AliasTarget(dns_name="acme-shop-prod.us-east-2.elb.amazonaws.com", hosted_zone_id="Z3AADJGX6KTTL2")),
            _r("www", "CNAME", "acme-shop.io"),
            _r("", "MX", "1 aspmx.l.google.com", "5 alt1.aspmx.l.google.com", "5 alt2.aspmx.l.google.com"),
            _r("", "TXT", '"v=spf1 include:_spf.google.com ~all"'),
            _r("checkout", "A", "198.51.100.80"),
            _r("images", "CNAME", "acme-shop-assets.s3.amazonaws.com"),
        ],
    ),
    (
        HostedZoneCreate(name="internal.corp", type="private", comment="Internal service discovery",
                         vpcs=[Vpc(region="us-east-1", vpc_id="vpc-0a1b2c3d4e5f67890")]),
        [
            _r("db", "A", "10.0.1.15"),
            _r("cache", "A", "10.0.1.30"),
            _r("ldap", "A", "10.0.2.10"),
            _r("grafana", "CNAME", "monitoring.internal.corp"),
            _r("monitoring", "A", "10.0.3.5"),
        ],
    ),
    (
        HostedZoneCreate(name="1.168.192.in-addr.arpa", comment="Reverse lookup for 192.168.1.0/24"),
        [
            _r("10", "PTR", "db.internal.corp"),
            _r("20", "PTR", "cache.internal.corp"),
            _r("30", "PTR", "ldap.internal.corp"),
        ],
    ),
]


def seed(db: Session) -> None:
    if db.scalar(select(Account.id).limit(1)):
        return
    account = Account(id=DEMO_ACCOUNT_ID, alias=DEMO_ALIAS)
    account.users = [User(username=DEMO_USERNAME, display_name="admin", password_hash=hash_password(DEMO_PASSWORD))]
    db.add(account)
    db.flush()
    for zone_in, records in SAMPLE_ZONES:
        zone = dns.create_zone(db, account.id, zone_in)
        db.flush()
        dns.create_records(db, zone, records)
    db.commit()
