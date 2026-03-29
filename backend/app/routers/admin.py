from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from app.dependencies import get_current_tenant, require_master_admin, require_owner_or_master_admin
from database import get_db

router = APIRouter(prefix="/api/v1/admin", tags=["Admin"])

INVITATION_EXPIRY_HOURS = 72


class TenantSummary(BaseModel):
    id: str
    name: str
    status: str
    modules: list[str]


class TenantStatusResponse(BaseModel):
    id: str
    status: str


class TenantDeleteResponse(BaseModel):
    id: str
    deleted: bool


class ModuleUpdate(BaseModel):
    modules: list[str]


class ModuleUpdateResponse(BaseModel):
    id: str
    modules: list[str]


class InviteUserRequest(BaseModel):
    email: str
    role_id: str
    redirect_to: str | None = None


class InviteUserResponse(BaseModel):
    success: bool
    email: str
    auth_id: str
    user_id: str
    role_id: str
    role_name: str
    invitation_expires_at: str


def _normalize_modules(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(module) for module in raw]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw or "[]")
            if isinstance(parsed, list):
                return [str(module) for module in parsed]
        except json.JSONDecodeError:
            return []
    return []


def _serialize_tenant(tenant: models.Tenant) -> dict[str, Any]:
    return {
        "id": tenant.id,
        "name": tenant.name or "",
        "status": tenant.status or "active",
        "modules": _normalize_modules(tenant.modules),
    }


def _write_audit_log(
    db: Session,
    actor: models.User,
    action: str,
    tenant_id: str,
    table_name: str,
    record_id: str,
    *,
    old_values: dict[str, Any] | None = None,
    new_values: dict[str, Any] | None = None,
) -> None:
    db.add(
        models.AuditLog(
            id=f"audit-{uuid.uuid4().hex}",
            tenant_id=tenant_id,
            user_id=actor.id,
            action=action,
            table_name=table_name,
            record_id=record_id,
            old_values=json.dumps(old_values or {}, ensure_ascii=True),
            new_values=json.dumps(new_values or {}, ensure_ascii=True),
        )
    )


def _get_tenant_or_404(db: Session, tenant_id: str) -> models.Tenant:
    tenant = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _get_supabase_project_settings() -> tuple[str, str]:
    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").strip().rstrip("/")
    service_role_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()

    if not supabase_url or not service_role_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase service role configuration is missing",
        )

    return supabase_url, service_role_key


def _supabase_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json;charset=UTF-8",
    }


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip() or "Unknown Supabase error"

    if isinstance(payload, dict):
        for key in ("msg", "message", "error_description", "error"):
            value = payload.get(key)
            if value:
                return str(value)
    return str(payload)


def _require_response_ok(response: httpx.Response, detail_prefix: str, *, conflict_codes: set[int] | None = None) -> None:
    if response.status_code < 400:
        return

    detail = _extract_error_detail(response)
    if conflict_codes and response.status_code in conflict_codes:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{detail_prefix}: {detail}")

    raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"{detail_prefix}: {detail}")


def _fetch_role_record(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    tenant_id: str,
    role_id: str,
) -> dict[str, Any]:
    response = client.get(
        f"{supabase_url}/rest/v1/roles",
        headers=_supabase_headers(service_role_key),
        params={
            "select": "id,name",
            "tenant_id": f"eq.{tenant_id}",
            "id": f"eq.{role_id}",
        },
    )
    _require_response_ok(response, "Failed to fetch role")

    rows = response.json()
    if not rows:
        raise HTTPException(status_code=404, detail="Role not found")
    return rows[0]


def _fetch_existing_public_user(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    tenant_id: str,
    email: str,
) -> dict[str, Any] | None:
    response = client.get(
        f"{supabase_url}/rest/v1/users",
        headers=_supabase_headers(service_role_key),
        params={
            "select": "id,auth_id,email",
            "tenant_id": f"eq.{tenant_id}",
            "email": f"eq.{email}",
        },
    )
    _require_response_ok(response, "Failed to check existing tenant user")
    rows = response.json()
    return rows[0] if rows else None


def _invite_auth_user(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    email: str,
    *,
    redirect_to: str | None,
) -> dict[str, Any]:
    local_name = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip() or email
    response = client.post(
        f"{supabase_url}/auth/v1/invite",
        headers=_supabase_headers(service_role_key),
        params={"redirect_to": redirect_to} if redirect_to else None,
        json={
            "email": email,
            "data": {
                "full_name": local_name,
            },
        },
    )
    _require_response_ok(response, "Failed to send invitation", conflict_codes={400, 409, 422})

    payload = response.json()
    auth_id = str(payload.get("id") or "").strip() if isinstance(payload, dict) else ""
    if not auth_id:
        raise HTTPException(status_code=502, detail="Invite response did not return an auth user id")
    return payload


def _update_auth_user_metadata(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    auth_id: str,
    tenant_id: str,
    role_name: str,
    invitation_expires_at: str,
) -> None:
    response = client.put(
        f"{supabase_url}/auth/v1/admin/users/{auth_id}",
        headers=_supabase_headers(service_role_key),
        json={
            "app_metadata": {
                "tenant_id": tenant_id,
                "user_role": role_name,
                "invitation_expires_at": invitation_expires_at,
            },
        },
    )
    _require_response_ok(response, "Failed to update invited user metadata")


def _create_public_user(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    tenant_id: str,
    auth_id: str,
    email: str,
) -> dict[str, Any]:
    full_name = email.split("@", 1)[0].replace(".", " ").replace("_", " ").strip() or email
    response = client.post(
        f"{supabase_url}/rest/v1/users",
        headers={**_supabase_headers(service_role_key), "Prefer": "return=representation"},
        json={
            "auth_id": auth_id,
            "tenant_id": tenant_id,
            "full_name": full_name,
            "email": email,
            "is_active": True,
        },
    )
    _require_response_ok(response, "Failed to create tenant user", conflict_codes={400, 409, 422})

    rows = response.json()
    if not rows:
        raise HTTPException(status_code=502, detail="Tenant user insert returned no rows")
    return rows[0]


def _assign_public_user_role(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    tenant_id: str,
    user_id: str,
    role_id: str,
) -> None:
    response = client.post(
        f"{supabase_url}/rest/v1/user_roles",
        headers=_supabase_headers(service_role_key),
        json={
            "tenant_id": tenant_id,
            "user_id": user_id,
            "role_id": role_id,
        },
    )
    _require_response_ok(response, "Failed to assign invited user role", conflict_codes={400, 409, 422})


def _delete_auth_user(client: httpx.Client, supabase_url: str, service_role_key: str, auth_id: str) -> None:
    client.delete(
        f"{supabase_url}/auth/v1/admin/users/{auth_id}",
        headers=_supabase_headers(service_role_key),
    )


@router.get("/tenants/", response_model=list[TenantSummary])
def get_all_tenants(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_master_admin),
):
    _ = current_user
    tenants = db.query(models.Tenant).order_by(models.Tenant.name.asc()).all()
    return [_serialize_tenant(tenant) for tenant in tenants]


@router.post("/tenants/{tenant_id}/toggle-status", response_model=TenantStatusResponse)
def toggle_tenant_status(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_master_admin),
):
    tenant = _get_tenant_or_404(db, tenant_id)
    previous = _serialize_tenant(tenant)

    tenant.status = "suspended" if (tenant.status or "active") == "active" else "active"
    current = _serialize_tenant(tenant)

    action = "suspend_tenant" if current["status"] == "suspended" else "reactivate_tenant"
    _write_audit_log(
        db,
        current_user,
        action,
        tenant.id,
        "tenants",
        tenant.id,
        old_values=previous,
        new_values=current,
    )
    db.commit()

    return {"id": tenant.id, "status": tenant.status}


@router.put("/tenants/{tenant_id}/modules", response_model=ModuleUpdateResponse)
def update_tenant_modules(
    tenant_id: str,
    data: ModuleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_master_admin),
):
    tenant = _get_tenant_or_404(db, tenant_id)
    previous = _serialize_tenant(tenant)

    tenant.modules = json.dumps(data.modules)
    current = _serialize_tenant(tenant)

    _write_audit_log(
        db,
        current_user,
        "modify_tenant_modules",
        tenant.id,
        "tenants",
        tenant.id,
        old_values=previous,
        new_values=current,
    )
    db.commit()

    return {"id": tenant.id, "modules": current["modules"]}


@router.delete("/tenants/{tenant_id}", response_model=TenantDeleteResponse)
def delete_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_master_admin),
):
    tenant = _get_tenant_or_404(db, tenant_id)
    previous = _serialize_tenant(tenant)

    _write_audit_log(
        db,
        current_user,
        "delete_tenant",
        tenant.id,
        "tenants",
        tenant.id,
        old_values=previous,
        new_values={"deleted": True},
    )
    db.delete(tenant)
    db.commit()

    return {"id": tenant_id, "deleted": True}


@router.post("/invite-user", response_model=InviteUserResponse)
def invite_user(
    payload: InviteUserRequest,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
    current_user: models.User = Depends(require_owner_or_master_admin),
):
    supabase_url, service_role_key = _get_supabase_project_settings()
    invitation_expires_at = (datetime.now(timezone.utc) + timedelta(hours=INVITATION_EXPIRY_HOURS)).isoformat()
    normalized_email = payload.email.strip().lower()
    if "@" not in normalized_email or not payload.role_id.strip():
        raise HTTPException(status_code=400, detail="Valid email and role_id are required")

    with httpx.Client(timeout=20.0) as client:
        existing_public_user = _fetch_existing_public_user(
            client,
            supabase_url,
            service_role_key,
            tenant.id,
            normalized_email,
        )
        if existing_public_user:
            raise HTTPException(status_code=409, detail="A tenant user with this email already exists")

        role_record = _fetch_role_record(
            client,
            supabase_url,
            service_role_key,
            tenant.id,
            payload.role_id,
        )

        auth_user = _invite_auth_user(
            client,
            supabase_url,
            service_role_key,
            normalized_email,
            redirect_to=payload.redirect_to,
        )
        auth_id = str(auth_user.get("id") or "").strip()

        try:
            _update_auth_user_metadata(
                client,
                supabase_url,
                service_role_key,
                auth_id,
                tenant.id,
                str(role_record.get("name") or ""),
                invitation_expires_at,
            )

            created_user = _create_public_user(
                client,
                supabase_url,
                service_role_key,
                tenant.id,
                auth_id,
                normalized_email,
            )

            _assign_public_user_role(
                client,
                supabase_url,
                service_role_key,
                tenant.id,
                str(created_user.get("id") or ""),
                payload.role_id,
            )
        except HTTPException:
            _delete_auth_user(client, supabase_url, service_role_key, auth_id)
            raise

    _write_audit_log(
        db,
        current_user,
        "invite_user",
        tenant.id,
        "users",
        str(created_user.get("id") or auth_id),
        old_values={},
        new_values={
            "email": normalized_email,
            "auth_id": auth_id,
            "role_id": payload.role_id,
            "role_name": role_record.get("name"),
            "invitation_expires_at": invitation_expires_at,
        },
    )
    db.commit()

    return {
        "success": True,
        "email": normalized_email,
        "auth_id": auth_id,
        "user_id": str(created_user.get("id") or ""),
        "role_id": payload.role_id,
        "role_name": str(role_record.get("name") or ""),
        "invitation_expires_at": invitation_expires_at,
    }
