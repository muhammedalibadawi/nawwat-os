"""Health and config tests."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_root():
    r = client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "online"
    assert "Nawwat" in data.get("system", "")


def test_health_api():
    r = client.get("/api/v1/health", headers={"X-Tenant-ID": "T-ACME"})
    assert r.status_code == 200
    assert r.json().get("status") == "ok"
