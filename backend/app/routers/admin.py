import json
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.auth import require_master_admin

router = APIRouter(prefix="/api/v1/admin/tenants", tags=["Master Admin Portal"])


@router.get("/")
def get_all_tenants(
    db: Session = Depends(get_db),
    _user: dict = Depends(require_master_admin),
):
    return db.query(models.Tenant).all()


@router.post("/{tenant_id}/toggle-status")
def toggle_tenant_status(
    tenant_id: str,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_master_admin),
):
    t = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404)
    t.status = "suspended" if t.status == "active" else "active"
    db.commit()
    return {"status": t.status}


class ModuleUpdate(BaseModel):
    modules: list[str]


@router.put("/{tenant_id}/modules")
def update_tenant_modules(
    tenant_id: str,
    data: ModuleUpdate,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_master_admin),
):
    t = db.query(models.Tenant).filter(models.Tenant.id == tenant_id).first()
    if not t:
        raise HTTPException(status_code=404)
    t.modules = json.dumps(data.modules)
    db.commit()
    return {"modules": data.modules}
