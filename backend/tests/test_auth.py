"""Security regression tests for auth and tenant access."""
from __future__ import annotations

import importlib
import os
import sys
import uuid
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from app.auth import create_access_token
from app.config import get_settings
from database import Base, get_db


def _load_main_module():
    module = sys.modules.get("app.main")
    if module is None:
        return importlib.import_module("app.main")
    return importlib.reload(module)


@pytest.fixture
def client_with_db(monkeypatch):
    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("SECRET_KEY", "test-suite-secret-key")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")
    monkeypatch.delenv("MASTER_ADMIN_BYPASS_ENABLED", raising=False)
    get_settings.cache_clear()

    app_main = _load_main_module()
    app_main.seed_db = lambda: None

    db_path = f"test_auth_{uuid.uuid4().hex}.db"
    db_url = f"sqlite:///./{db_path}"
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    testing_session_local = sessionmaker(
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
        bind=engine,
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app_main.app.dependency_overrides[get_db] = override_get_db

    with TestClient(app_main.app) as client:
        yield client, testing_session_local

    app_main.app.dependency_overrides.clear()
    engine.dispose()
    if os.path.exists(db_path):
        os.remove(db_path)


def _auth_headers(token: str, tenant_id: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    if tenant_id is not None:
        headers["X-Tenant-ID"] = tenant_id
    return headers


def _seed_tenant(db, tenant_id: str, *, status: str = "active") -> models.Tenant:
    tenant = models.Tenant(id=tenant_id, name=f"Tenant {tenant_id}", status=status, modules="[]")
    db.add(tenant)
    db.commit()
    return tenant


def _seed_user(
    db,
    user_id: str,
    tenant_id: str,
    *,
    role: str = "ACCOUNTANT",
    status: str = "Active",
) -> models.User:
    user = models.User(
        id=user_id,
        tenant_id=tenant_id,
        name=f"User {user_id}",
        role=role,
        department="Security",
        status=status,
        avatar="TT",
    )
    db.add(user)
    db.commit()
    return user


def test_tenants_me_rejects_cross_tenant_access(client_with_db):
    client, session_factory = client_with_db
    with session_factory() as db:
        _seed_tenant(db, "T-ALPHA")
        _seed_tenant(db, "T-BETA")
        user = _seed_user(db, "USER-ALPHA", "T-ALPHA")

    token = create_access_token({"sub": user.id})
    response = client.get("/api/v1/tenants/me", headers=_auth_headers(token, "T-BETA"))

    assert response.status_code == 403
    assert response.json()["detail"] == "Cross-tenant access denied"


def test_bypass_header_is_ignored_for_admin_access(client_with_db):
    client, session_factory = client_with_db
    with session_factory() as db:
        _seed_tenant(db, "T-ALPHA")
        user = _seed_user(db, "USER-ALPHA", "T-ALPHA", role="ACCOUNTANT")

    token = create_access_token({"sub": user.id})
    response = client.get(
        "/api/v1/admin/tenants/",
        headers=_auth_headers(token, "MASTER_ADMIN_BYPASS"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Master admin access required"


def test_suspended_membership_returns_403(client_with_db):
    client, session_factory = client_with_db
    with session_factory() as db:
        _seed_tenant(db, "T-SUSPENDED")
        user = _seed_user(db, "USER-SUSPENDED", "T-SUSPENDED", status="Suspended")

    token = create_access_token({"sub": user.id})
    response = client.get("/api/v1/tenants/me", headers=_auth_headers(token, "T-SUSPENDED"))

    assert response.status_code == 403
    assert response.json()["detail"] == "Membership suspended"


def test_expired_token_returns_401(client_with_db):
    client, session_factory = client_with_db
    with session_factory() as db:
        _seed_tenant(db, "T-ALPHA")
        user = _seed_user(db, "USER-ALPHA", "T-ALPHA")

    token = create_access_token({"sub": user.id}, expires_delta=timedelta(minutes=-1))
    response = client.get("/api/v1/tenants/me", headers=_auth_headers(token, "T-ALPHA"))

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or expired token"


def test_production_bypass_configuration_fails_startup(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("SECRET_KEY", "prod-secret-key")
    monkeypatch.setenv("ALLOWED_ORIGINS", "https://app.example.com")
    monkeypatch.setenv("MASTER_ADMIN_BYPASS_ENABLED", "true")
    get_settings.cache_clear()

    with pytest.raises(RuntimeError, match="MASTER_ADMIN_BYPASS_ENABLED must be false in production"):
        _load_main_module()

    monkeypatch.setenv("ENV", "development")
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:3000")
    monkeypatch.delenv("MASTER_ADMIN_BYPASS_ENABLED", raising=False)
    get_settings.cache_clear()
    _load_main_module()
