def add(client, zone_id, *records):
    return client.post(f"/api/hostedzones/{zone_id}/records", json={"records": list(records)})
