from tests.helpers import add


def test_seeded_zones_listed(client):
    body = client.get("/api/hostedzones").json()
    names = [z["name"] for z in body["items"]]
    assert body["total"] == 4
    assert names == sorted(names)
    assert "example.com." in names


def test_create_zone_has_default_ns_and_soa(client, zone):
    assert zone["name"] == "test-zone.com."
    assert zone["id"].startswith("Z") and len(zone["id"]) == 21
    assert zone["record_count"] == 2
    assert len(zone["name_servers"]) == 4
    recs = client.get(f"/api/hostedzones/{zone['id']}/records").json()["items"]
    assert [(r["type"], r["is_default"]) for r in recs] == [("NS", True), ("SOA", True)]
    assert recs[0]["ttl"] == 172800


def test_duplicate_public_zone_rejected(client, zone):
    r = client.post("/api/hostedzones", json={"name": "TEST-ZONE.com."})
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "HostedZoneAlreadyExists"


def test_invalid_zone_name(client):
    r = client.post("/api/hostedzones", json={"name": "bad_name..com"})
    assert r.status_code == 400


def test_private_zone_requires_vpc(client):
    assert client.post("/api/hostedzones", json={"name": "corp.local", "type": "private"}).status_code == 400
    r = client.post("/api/hostedzones", json={"name": "corp.local", "type": "private",
                                               "vpcs": [{"region": "us-east-1", "vpc_id": "vpc-123"}]})
    assert r.status_code == 201
    assert r.json()["vpcs"] == [{"region": "us-east-1", "vpc_id": "vpc-123"}]


def test_get_and_update_zone(client, zone):
    r = client.patch(f"/api/hostedzones/{zone['id']}", json={"comment": "updated", "tags": [{"key": "env", "value": "dev"}]})
    assert r.status_code == 200
    got = client.get(f"/api/hostedzones/{zone['id']}").json()
    assert got["comment"] == "updated"
    assert got["tags"] == [{"key": "env", "value": "dev"}]
    assert got["name"] == "test-zone.com."


def test_unknown_zone_404(client):
    r = client.get("/api/hostedzones/ZNOPE")
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "NoSuchHostedZone"


def test_delete_zone_not_empty_then_ok(client, zone):
    zid = zone["id"]
    created = add(client, zid, {"name": "www", "type": "A", "values": ["1.2.3.4"]}).json()["items"][0]
    r = client.delete(f"/api/hostedzones/{zid}")
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "HostedZoneNotEmpty"
    assert client.delete(f"/api/hostedzones/{zid}/records/{created['id']}").status_code == 204
    assert client.delete(f"/api/hostedzones/{zid}").status_code == 204
    assert client.get(f"/api/hostedzones/{zid}").status_code == 404


def test_search_filter_sort_paginate(client):
    assert client.get("/api/hostedzones?q=example").json()["total"] == 1
    assert client.get("/api/hostedzones?q=internal service").json()["total"] == 1  # matches comment
    assert client.get("/api/hostedzones?type=private").json()["items"][0]["name"] == "internal.corp."
    assert client.get("/api/hostedzones?comment=storefront").json()["items"][0]["name"] == "acme-shop.io."
    page2 = client.get("/api/hostedzones?page=2&page_size=3").json()
    assert page2["total"] == 4 and len(page2["items"]) == 1
    by_count = client.get("/api/hostedzones?sort=record_count&order=desc").json()["items"]
    assert by_count[0]["name"] == "example.com."


def test_zones_scoped_to_account(client, zone):
    client.post("/api/auth/logout")
    assert client.get(f"/api/hostedzones/{zone['id']}").status_code == 401
