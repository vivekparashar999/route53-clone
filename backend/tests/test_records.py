import pytest

from tests.helpers import add

VALID = [
    ("A", ["192.0.2.1", "192.0.2.2"]),
    ("AAAA", ["2001:db8::1"]),
    ("CNAME", ["target.example.net"]),
    ("TXT", ["hello world"]),
    ("MX", ["10 mail.example.com"]),
    ("NS", ["ns1.other-dns.net", "ns2.other-dns.net"]),
    ("PTR", ["host.example.com"]),
    ("SRV", ["10 60 5060 sip.example.com"]),
    ("CAA", ['0 issue "amazon.com"']),
]

INVALID = [
    ("A", ["1.2.3"], "ARRDATAIllegalIPv4Address"),
    ("A", ["2001:db8::1"], "ARRDATAIllegalIPv4Address"),
    ("AAAA", ["192.0.2.1"], "AAAARRDATAIllegalIPv6Address"),
    ("CNAME", ["a.example.com", "b.example.com"], "exactly one"),
    ("CNAME", ["bad..host"], "DomainLabelEmpty"),
    ("MX", ["mail.example.com"], "MXRRDATAIllegalFormat"),
    ("MX", ["99999 mail.example.com"], "MXRRDATAIllegalFormat"),
    ("NS", ["not a host"], "Value is not a valid domain name"),
    ("PTR", ["bad host!"], "Value is not a valid domain name"),
    ("SRV", ["10 60 sip.example.com"], "SRVRRDATAIllegalFormat"),
    ("CAA", ['0 bogus "x"'], "CAARRDATAIllegalFormat"),
    ("TXT", [], "ResourceRecordsEmpty"),
]


@pytest.mark.parametrize("rtype,values", VALID)
def test_create_each_type(client, zone, rtype, values):
    r = add(client, zone["id"], {"name": f"rec-{rtype.lower()}", "type": rtype, "ttl": 120, "values": values})
    assert r.status_code == 201, r.text
    rec = r.json()["items"][0]
    assert rec["name"] == f"rec-{rtype.lower()}.test-zone.com."
    assert rec["ttl"] == 120 and len(rec["values"]) == len(values)


@pytest.mark.parametrize("rtype,values,message", INVALID)
def test_reject_invalid_values(client, zone, rtype, values, message):
    r = add(client, zone["id"], {"name": "bad", "type": rtype, "values": values})
    assert r.status_code == 400, r.text
    assert r.json()["detail"]["code"] == "InvalidChangeBatch"
    assert message in r.json()["detail"]["message"]


def test_txt_is_auto_quoted(client, zone):
    rec = add(client, zone["id"], {"name": "", "type": "TXT", "values": ["v=spf1 -all"]}).json()["items"][0]
    assert rec["values"] == ['"v=spf1 -all"'] and rec["name"] == "test-zone.com."


def test_cname_rules(client, zone):
    r = add(client, zone["id"], {"name": "", "type": "CNAME", "values": ["x.example.com"]})
    assert "is not permitted at apex in zone test-zone.com." in r.json()["detail"]["message"]
    add(client, zone["id"], {"name": "www", "type": "A", "values": ["1.1.1.1"]})
    r = add(client, zone["id"], {"name": "www", "type": "CNAME", "values": ["x.example.com"]})
    assert r.status_code == 400 and "conflicting RRSet of type A" in r.json()["detail"]["message"]


def test_duplicate_and_batch_atomicity(client, zone):
    zid = zone["id"]
    assert add(client, zid, {"name": "dup", "type": "A", "values": ["1.1.1.1"]}).status_code == 201
    assert add(client, zid, {"name": "dup.test-zone.com.", "type": "A", "values": ["2.2.2.2"]}).status_code == 409
    r = add(client, zid, {"name": "ok1", "type": "A", "values": ["1.1.1.1"]}, {"name": "bad", "type": "A", "values": ["x"]})
    assert r.status_code == 400
    assert client.get(f"/api/hostedzones/{zid}/records?q=ok1").json()["total"] == 0


def test_routing_policies(client, zone):
    zid = zone["id"]
    w = {"name": "app", "type": "A", "values": ["1.1.1.1"], "routing_policy": "weighted"}
    assert add(client, zid, w).status_code == 400  # missing set identifier
    assert add(client, zid, {**w, "set_identifier": "a", "weight": 10}).status_code == 201
    assert add(client, zid, {**w, "set_identifier": "b", "weight": 90, "values": ["2.2.2.2"]}).status_code == 201
    simple = add(client, zid, {"name": "app", "type": "A", "values": ["3.3.3.3"]})
    assert simple.status_code == 400
    lat = {"name": "lat", "type": "A", "values": ["1.1.1.1"], "routing_policy": "latency", "set_identifier": "x"}
    assert add(client, zid, {**lat, "region": "mars-1"}).status_code == 400
    assert add(client, zid, {**lat, "region": "eu-west-1"}).json()["items"][0]["region"] == "eu-west-1"


def test_alias_record(client, zone):
    r = add(client, zone["id"], {"name": "", "type": "A", "alias": True, "ttl": None,
                                 "alias_target": {"dns_name": "d123.cloudfront.net", "hosted_zone_id": "Z2FDTNDATAQYW2"}})
    rec = r.json()["items"][0]
    assert rec["alias"] is True and rec["ttl"] is None and rec["values"] == []
    assert rec["alias_target"]["dns_name"] == "d123.cloudfront.net."


def test_update_record(client, zone):
    zid = zone["id"]
    rec = add(client, zid, {"name": "edit", "type": "A", "values": ["1.1.1.1"]}).json()["items"][0]
    r = client.put(f"/api/hostedzones/{zid}/records/{rec['id']}",
                   json={"name": "edit", "type": "A", "ttl": 60, "values": ["9.9.9.9", "8.8.8.8"]})
    assert r.status_code == 200
    assert r.json()["values"] == ["9.9.9.9", "8.8.8.8"] and r.json()["ttl"] == 60
    bad = client.put(f"/api/hostedzones/{zid}/records/{rec['id']}", json={"name": "edit", "type": "A", "values": ["nope"]})
    assert bad.status_code == 400


def test_default_records_editable_not_deletable(client, zone):
    zid = zone["id"]
    ns = client.get(f"/api/hostedzones/{zid}/records?type=NS").json()["items"][0]
    assert client.delete(f"/api/hostedzones/{zid}/records/{ns['id']}").status_code == 400
    r = client.put(f"/api/hostedzones/{zid}/records/{ns['id']}",
                   json={"name": "ignored", "type": "NS", "ttl": 3600, "values": ns["values"]})
    assert r.status_code == 200 and r.json()["ttl"] == 3600 and r.json()["name"] == zone["name"]


def test_search_filter_pagination(client):
    zid = next(z["id"] for z in client.get("/api/hostedzones").json()["items"] if z["name"] == "example.com.")
    base = f"/api/hostedzones/{zid}/records"
    first = client.get(f"{base}?page_size=10").json()
    assert first["total"] >= 30 and len(first["items"]) == 10
    assert [r["type"] for r in first["items"][:2]] == ["NS", "SOA"]
    last = client.get(f"{base}?page_size=10&page=4").json()
    assert len(last["items"]) == first["total"] - 30
    assert all(r["type"] == "SRV" for r in client.get(f"{base}?type=SRV").json()["items"])
    assert client.get(f"{base}?type=A,AAAA").json()["total"] > client.get(f"{base}?type=A").json()["total"]
    assert all(r["alias"] for r in client.get(f"{base}?alias=true").json()["items"])
    assert client.get(f"{base}?routing_policy=weighted").json()["total"] == 2
    assert client.get(f"{base}?q=cloudfront").json()["items"][0]["name"] == "cdn.example.com."
    assert client.get(f"{base}?q=192.0.2.25").json()["items"][0]["name"] == "mail.example.com."
    assert client.get(f"{base}?sort=ttl&order=desc").json()["items"][0]["ttl"] == 172800


def test_batch_delete(client, zone):
    zid = zone["id"]
    items = add(client, zid, *[{"name": f"h{i}", "type": "A", "values": [f"10.0.0.{i}"]} for i in range(5)]).json()["items"]
    r = client.post(f"/api/hostedzones/{zid}/records/batch-delete", json={"ids": [x["id"] for x in items[:3]]})
    assert r.json() == {"deleted": 3}
    assert client.get(f"/api/hostedzones/{zid}").json()["record_count"] == 4
    soa = client.get(f"/api/hostedzones/{zid}/records?type=SOA").json()["items"][0]
    r = client.post(f"/api/hostedzones/{zid}/records/batch-delete", json={"ids": [items[3]["id"], soa["id"]]})
    assert r.status_code == 400
    assert client.get(f"/api/hostedzones/{zid}").json()["record_count"] == 4  # nothing deleted
