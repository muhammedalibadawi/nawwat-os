from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/hr", tags=["HR & Payroll"])


@router.get("/employees")
def get_employees(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    try:
        return db.query(models.User).filter(
            models.User.tenant_id == tenant.id
        ).all()
    except Exception as e:
        print(f"DB Error: {e}")
        return []
