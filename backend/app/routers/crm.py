import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant
from app.routers.logistics import trigger_communication

router = APIRouter(prefix="/api/v1/crm", tags=["CRM & Leads"])


@router.get("/leads")
def get_leads(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.LeadTracking).filter(
        models.LeadTracking.tenant_id == tenant.id
    ).all()


class LeadCreateSchema(BaseModel):
    customer_name: str
    email: str
    phone: str
    interests: str
    follow_up_date: str
    status: str = "New"


@router.post("/leads")
def create_lead(
    data: LeadCreateSchema,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    new_lead = models.LeadTracking(
        id=f"lead-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant.id,
        **data.model_dump(),
    )
    db.add(new_lead)
    db.commit()
    trigger_communication(tenant.id, "NEW_LEAD", f"Lead {data.customer_name} generated.")
    return new_lead


@router.put("/leads/{lead_id}")
def update_lead(
    lead_id: str,
    data: LeadCreateSchema,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    lead = db.query(models.LeadTracking).filter(
        models.LeadTracking.id == lead_id,
        models.LeadTracking.tenant_id == tenant.id,
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for key, value in data.model_dump().items():
        setattr(lead, key, value)
    db.commit()
    return lead
