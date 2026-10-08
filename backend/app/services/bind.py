"""Minimal RFC 1035 master-file (BIND zone file) import/export."""

import re
from collections import OrderedDict
from dataclasses import dataclass

from .validation import SUPPORTED_TYPES

_CLASSES = {"IN", "CH", "HS", "CS"}
_TTL_UNITS = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}


@dataclass
class ParsedRRSet:
    name: str
    type: str
    ttl: int | None
    values: list[str]


def _strip_comment(line: str) -> str:
    in_quote = False
    escaped = False
    for i, ch in enumerate(line):
        if escaped:
            escaped = False
        elif ch == "\\":
            escaped = True
        elif ch == '"':
            in_quote = not in_quote
        elif ch == ";" and not in_quote:
            return line[:i]
    return line


def _tokens(text: str) -> list[str]:
    return re.findall(r'"(?:[^"\\]|\\.)*"|\S+', text)


def _parse_ttl(token: str) -> int | None:
    if token.isdigit():
        return int(token)
    parts = re.fullmatch(r"(?:\d+[smhdwSMHDW])+", token)
    if not parts:
        return None
    return sum(int(n) * _TTL_UNITS[u.lower()] for n, u in re.findall(r"(\d+)([smhdwSMHDW])", token))


def _logical_lines(text: str) -> list[tuple[bool, str]]:
    """Yield (starts_with_whitespace, content) with parenthesised groups joined into one line."""
    out: list[tuple[bool, str]] = []
    buf, depth, leading = "", 0, False
    for raw in text.splitlines():
        line = _strip_comment(raw)
        if depth == 0:
            if not line.strip():
                continue
            leading = line[:1].isspace()
            buf = line
        else:
            buf += " " + line
        depth += line.count("(") - line.count(")")
        if depth <= 0:
            out.append((leading, buf.replace("(", " ").replace(")", " ")))
            buf, depth = "", 0
    if buf.strip():
        out.append((leading, buf.replace("(", " ").replace(")", " ")))
    return out


def parse_zone_file(text: str, zone_name: str) -> tuple[list[ParsedRRSet], list[str]]:
    origin = zone_name
    default_ttl: int | None = None
    last_owner = zone_name
    errors: list[str] = []
    rrsets: "OrderedDict[tuple[str, str], ParsedRRSet]" = OrderedDict()

    def absolute(name: str) -> str:
        if name == "@":
            return origin
        return name.lower() if name.endswith(".") else f"{name}.{origin}".lower()

    for lineno, (leading, line) in enumerate(_logical_lines(text), start=1):
        toks = _tokens(line)
        if not toks:
            continue
        head = toks[0].upper()
        if head == "$ORIGIN" and len(toks) > 1:
            # "$ORIGIN example.com" (missing trailing dot) is a common mistake; when it names the
            # zone itself, treat it as absolute instead of appending the zone a second time.
            value = toks[1].lower()
            origin = f"{value}." if f"{value}." == zone_name else absolute(value)
            continue
        if head == "$TTL" and len(toks) > 1:
            default_ttl = _parse_ttl(toks[1])
            continue
        if head.startswith("$"):
            errors.append(f"Line {lineno}: directive {toks[0]} is not supported")
            continue

        if leading:
            owner = last_owner
        else:
            owner = absolute(toks.pop(0))
            last_owner = owner

        ttl = default_ttl
        rtype = None
        while toks:
            tok = toks.pop(0)
            upper = tok.upper()
            if upper in _CLASSES:
                continue
            parsed_ttl = _parse_ttl(tok)
            if parsed_ttl is not None:
                ttl = parsed_ttl
                continue
            rtype = upper
            break
        if rtype is None or not toks:
            errors.append(f"Line {lineno}: could not parse record '{line.strip()}'")
            continue
        if rtype not in SUPPORTED_TYPES:
            errors.append(f"Line {lineno}: record type {rtype} is not supported")
            continue

        value = " ".join(toks)
        key = (owner, rtype)
        if key in rrsets:
            rrsets[key].values.append(value)
        else:
            rrsets[key] = ParsedRRSet(name=owner, type=rtype, ttl=ttl, values=[value])
    return list(rrsets.values()), errors


def export_zone_file(zone_name: str, records: list) -> str:
    lines = [
        f"; Zone file for {zone_name}",
        "; Exported from Route 53 clone",
        f"$ORIGIN {zone_name}",
        "$TTL 300",
        "",
    ]
    width = max((len(_relative(r.name, zone_name)) for r in records), default=1) + 2
    for r in records:
        owner = _relative(r.name, zone_name).ljust(width)
        if r.alias:
            lines.append(f"; {owner}ALIAS {r.type} -> {r.alias_dns_name} (alias records have no BIND equivalent)")
            continue
        policy = f" ; {r.routing_policy} {r.set_identifier}" if r.set_identifier else ""
        for value in r.values:
            lines.append(f"{owner}{str(r.ttl):<8}IN  {r.type:<6}{value}{policy}")
    return "\n".join(lines) + "\n"


def _relative(name: str, zone_name: str) -> str:
    if name == zone_name:
        return "@"
    suffix = "." + zone_name
    return name[: -len(suffix)] if name.endswith(suffix) else name
