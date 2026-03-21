"""Auth login and tenant header tests."""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_login_returns_token():
    r = client.post(
        "/api/v1/auth/login",
        json={"tenant_id": "T-ACME", "role": "SUPER_ADMIN"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert data.get("role") == "SUPER_ADMIN"
    assert data.get("tenant_id") == "T-ACME"


def test_tenants_me_requires_header():
    r = client.get("/api/v1/tenants/me")
    assert r.status_code in (400, 422)  # missing X-Tenant-ID
