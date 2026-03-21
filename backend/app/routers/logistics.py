from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/logistics", tags=["Logistics & Shipments"])


def trigger_communication(tenant_id: str, action: str, details: str):
    print(f"[{tenant_id}] TRIGGER FIRED | Action: {action} | Details: {details}")


@router.get("/shipments")
def get_shipments(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.Shipment).filter(
        models.Shipment.tenant_id == tenant.id
    ).all()


class ShipmentUpdateConfig(BaseModel):
    status: str


@router.put("/shipments/{shipment_id}")
def update_shipment_status(
    shipment_id: str,
    data: ShipmentUpdateConfig,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    shipment = db.query(models.Shipment).filter(
        models.Shipment.id == shipment_id,
        models.Shipment.tenant_id == tenant.id,
    ).first()
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    shipment.status = data.status
    shipment.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    db.commit()
    trigger_communication(tenant.id, "SHIPMENT_UPDATE", f"Order {shipment.order_id} is now {data.status}.")
    return shipment
