from app.seed import DEMO_ACCOUNT_ID, DEMO_PASSWORD, DEMO_USERNAME


def test_requires_login(anon):
    r = anon.get("/api/hostedzones")
    assert r.status_code == 401
    assert r.json()["detail"]["code"] == "Unauthorized"


def test_login_with_account_id_me_and_logout(anon):
    r = anon.post("/api/auth/login", json={"account": DEMO_ACCOUNT_ID, "username": DEMO_USERNAME, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    assert r.json()["account_alias"] == "demo"
    assert "httponly" in r.headers["set-cookie"].lower()
    assert anon.get("/api/auth/me").json()["username"] == DEMO_USERNAME
    assert anon.post("/api/auth/logout").status_code == 204
    assert anon.get("/api/auth/me").status_code == 401


def test_bad_password(anon):
    r = anon.post("/api/auth/login", json={"account": "demo", "username": DEMO_USERNAME, "password": "nope"})
    assert r.status_code == 401


def test_session_persists_across_requests(client):
    for _ in range(3):
        assert client.get("/api/auth/me").status_code == 200
