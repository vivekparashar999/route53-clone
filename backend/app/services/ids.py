import secrets
import string
import uuid

_ALNUM = string.ascii_uppercase + string.digits


def hosted_zone_id() -> str:
    """Route 53 style id, e.g. Z0123456789ABCDEFGHIJ."""
    return "Z" + "".join(secrets.choice(_ALNUM) for _ in range(20))


def caller_reference() -> str:
    return str(uuid.uuid4())


def name_servers(zone_id: str) -> list[str]:
    """Deterministic per-zone delegation set, shaped like real awsdns servers."""
    seed = sum(ord(c) for c in zone_id)
    return [
        f"ns-{(seed * 7) % 512 + 0}.awsdns-{seed % 64:02d}.com.",
        f"ns-{(seed * 11) % 512 + 512}.awsdns-{(seed + 13) % 64:02d}.net.",
        f"ns-{(seed * 13) % 512 + 1024}.awsdns-{(seed + 29) % 64:02d}.org.",
        f"ns-{(seed * 17) % 512 + 1536}.awsdns-{(seed + 41) % 64:02d}.co.uk.",
    ]


def soa_value(primary_ns: str) -> str:
    return f"{primary_ns} awsdns-hostmaster.amazon.com. 1 7200 900 1209600 86400"
