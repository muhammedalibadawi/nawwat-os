"""Shared dependencies (tenant context, etc.)."""
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

import models
from app.auth import get_current_user_required
from database import get_db


def _normalize_role(role: str | None) -> str:
    return (role or "").strip().upper()


def _normalize_status(value: str | None) -> str:
    return (value or "").strip().lower()


def _load_authenticated_membership(token_user: dict, db: Session) -> models.User:
    user_id = str(token_user.get("sub") or "").strip()
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    membership = db.query(models.User).filter(models.User.id == user_id).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated user not found")

    if _normalize_status(membership.status) != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Membership suspended")

    return membership


def require_master_admin(
    token_user: dict = Depends(get_current_user_required),
    db: Session = Depends(get_db),
) -> models.User:
    membership = _load_authenticated_membership(token_user, db)
    if _normalize_role(membership.role) != "MASTER_ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master admin access required")
    return membership


def require_owner_or_master_admin(
    token_user: dict = Depends(get_current_user_required),
    db: Session = Depends(get_db),
) -> models.User:
    membership = _load_authenticated_membership(token_user, db)
    if _normalize_role(membership.role) not in {"MASTER_ADMIN", "OWNER"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner or master admin access required")
    return membership


def get_current_tenant(
    x_tenant_id: str | None = Header(None),
    token_user: dict = Depends(get_current_user_required),
    db: Session = Depends(get_db),
) -> models.Tenant:
    if not x_tenant_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="X-Tenant-ID header missing")

    membership = _load_authenticated_membership(token_user, db)
    if membership.tenant_id != x_tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-tenant access denied")

    tenant = db.query(models.Tenant).filter(models.Tenant.id == membership.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    if _normalize_status(tenant.status) != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Subscription expired")
    return tenant
