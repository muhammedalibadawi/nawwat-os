"""Shared dependencies (tenant context, etc.)."""
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from app.config import get_settings


def get_current_tenant(
    x_tenant_id: str = Header(None),
    db: Session = Depends(get_db),
):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header missing")
    if x_tenant_id == "MASTER_ADMIN_BYPASS":
        settings = get_settings()
        if not settings.master_admin_bypass_enabled:
            raise HTTPException(status_code=403, detail="Master admin bypass is disabled")
        return models.Tenant(
            id="T-ACME",
            name="Acme Corp (Master View)",
            status="active",
            modules='["POS", "HR", "Accounting", "RealEstate", "Inventory", "CRM"]',
        )
    tenant = db.query(models.Tenant).filter(models.Tenant.id == x_tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.status == "suspended":
        raise HTTPException(status_code=403, detail="Subscription Expired")
    return tenant
