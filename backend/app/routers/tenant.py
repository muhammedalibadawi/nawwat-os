import json
from fastapi import APIRouter, Depends
import models
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/tenants", tags=["Tenant Info"])


@router.get("/me")
def get_tenant_me(tenant: models.Tenant = Depends(get_current_tenant)):
    return {
        "id": tenant.id,
        "name": tenant.name,
        "status": tenant.status,
        "industry_type": getattr(tenant, "industry_type", None),
        "modules": json.loads(tenant.modules) if tenant.modules else []
    }
