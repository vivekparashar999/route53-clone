from tests.helpers import add

ZONE_FILE = """
$ORIGIN test-zone.com.
$TTL 1h
@       IN  SOA ns1.test-zone.com. admin.test-zone.com. (
            2024010101 ; serial
            7200 900 1209600 86400 )
@       IN  NS  ns1.test-zone.com.
@       300 IN  A   192.0.2.1
        300 IN  A   192.0.2.2     ; second address, same owner
www     IN  CNAME test-zone.com.
mail    600 IN A 192.0.2.25
@       IN  MX  10 mail
@       IN  TXT "v=spf1 include:example.net ~all"
_sip._tcp IN SRV 10 60 5060 sip.test-zone.com.
@       IN  CAA 0 issue "amazon.com"
ext.other.org. IN A 1.1.1.1
bad     IN  A   999.1.1.1
weird   IN  HINFO "x" "y"
"""


def test_import_bind(client, zone):
    zid = zone["id"]
    r = client.post(f"/api/hostedzones/{zid}/import", json={"zone_file": ZONE_FILE})
    assert r.status_code == 200, r.text
    result = r.json()
    # A(apex), CNAME, A(mail), MX, TXT, SRV, CAA; ext.other.org. is outside the zone
    assert result["created"] == 7, result
    assert any("HINFO" in e for e in result["errors"])
    assert any("999.1.1.1" in e for e in result["errors"])
    apex_a = client.get(f"/api/hostedzones/{zid}/records?type=A&q=192.0.2.1").json()["items"][0]
    assert apex_a["values"] == ["192.0.2.1", "192.0.2.2"] and apex_a["ttl"] == 300
    www = client.get(f"/api/hostedzones/{zid}/records?type=CNAME").json()["items"][0]
    assert www["ttl"] == 3600


def test_import_origin_without_trailing_dot(client, zone):
    zid = zone["id"]
    text = "$ORIGIN test-zone.com\napi IN A 192.0.2.10\n"
    r = client.post(f"/api/hostedzones/{zid}/import", json={"zone_file": text})
    assert r.json()["created"] == 1, r.text
    names = [x["name"] for x in client.get(f"/api/hostedzones/{zid}/records?type=A").json()["items"]]
    assert "api.test-zone.com." in names


def test_export_round_trip(client, zone):
    zid = zone["id"]
    add(client, zid,
        {"name": "", "type": "A", "values": ["192.0.2.1"]},
        {"name": "www", "type": "CNAME", "values": ["test-zone.com"]},
        {"name": "", "type": "MX", "values": ["10 mail.test-zone.com"]},
        {"name": "", "type": "TXT", "values": ['"hello; world"']},
        {"name": "_x._tcp", "type": "SRV", "values": ["1 2 3 t.test-zone.com"]})
    bind_text = client.get(f"/api/hostedzones/{zid}/export?format=bind")
    assert bind_text.headers["content-disposition"].endswith('test-zone.com.zone"')
    assert "$ORIGIN test-zone.com." in bind_text.text

    other = client.post("/api/hostedzones", json={"name": "test-zone.com", "type": "private",
                                                  "vpcs": [{"region": "us-east-1", "vpc_id": "vpc-1"}]}).json()
    result = client.post(f"/api/hostedzones/{other['id']}/import", json={"zone_file": bind_text.text}).json()
    assert result["created"] == 5 and result["errors"] == []

    def snapshot(z):
        return sorted((r["name"], r["type"], r["ttl"], tuple(r["values"]))
                      for r in client.get(f"/api/hostedzones/{z}/records").json()["items"] if not r["is_default"])

    assert snapshot(zid) == snapshot(other["id"])


def test_export_json(client, zone):
    data = client.get(f"/api/hostedzones/{zone['id']}/export?format=json").json()
    assert data["hosted_zone"]["name"] == "test-zone.com."
    assert {r["type"] for r in data["records"]} == {"NS", "SOA"}


def test_dashboard(client):
    d = client.get("/api/dashboard").json()
    assert d["hosted_zones"] == 4 and d["records"] > 40


def test_health(anon):
    assert anon.get("/api/health").json() == {"status": "ok"}
