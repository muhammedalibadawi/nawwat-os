from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/sync", tags=["Offline Sync"])


@router.get("/conflicts")
def get_conflicts(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.SyncQueue).filter(
        models.SyncQueue.tenant_id == tenant.id,
        models.SyncQueue.status == "conflict"
    ).all()
