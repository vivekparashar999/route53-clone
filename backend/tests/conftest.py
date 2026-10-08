import os
import tempfile

import pytest

_DB_DIR = tempfile.mkdtemp(prefix="r53-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_DIR}/test.db"
os.environ["SEED_DEMO"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import DEMO_ALIAS, DEMO_PASSWORD, DEMO_USERNAME, seed  # noqa: E402


@pytest.fixture()
def anon():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed(db)
    with TestClient(app) as client:
        yield client


@pytest.fixture()
def client(anon):
    r = anon.post("/api/auth/login", json={"account": DEMO_ALIAS, "username": DEMO_USERNAME, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    return anon


@pytest.fixture()
def zone(client):
    r = client.post("/api/hostedzones", json={"name": "test-zone.com", "comment": "for tests"})
    assert r.status_code == 201, r.text
    return r.json()

