from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/real-estate", tags=["Real Estate Deals Engine"])


@router.get("/deals")
def get_ai_deals(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    try:
        return db.query(models.RealEstateDeal).filter(
            models.RealEstateDeal.tenant_id == tenant.id
        ).all()
    except Exception as e:
        print(f"DB Error: {e}")
        return []
