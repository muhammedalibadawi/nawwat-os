import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/production", tags=["Production"])


class RawMaterialItem(BaseModel):
    id: str
    qty: int


class ProductionRunReq(BaseModel):
    producedItem: str
    producedQty: int
    rawMaterials: list[RawMaterialItem]


@router.post("/run")
def production_run(
    req: ProductionRunReq,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    finished_good = db.query(models.Product).filter(
        models.Product.id == req.producedItem,
        models.Product.tenant_id == tenant.id,
    ).first()
    if not finished_good:
        raise HTTPException(status_code=404, detail="Produced item not found")
    finished_good.stock += req.producedQty
    for rm in req.rawMaterials:
        rm_item = db.query(models.Product).filter(
            models.Product.id == rm.id,
            models.Product.tenant_id == tenant.id,
        ).first()
        if rm_item:
            rm_item.stock -= rm.qty
            if rm_item.stock < rm_item.min_stock_level:
                now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                alert = models.Notification(
                    id=f"notif-{uuid.uuid4().hex[:8]}",
                    tenant_id=tenant.id,
                    user_id="EMP-001",
                    title="Low Stock Alert (Raw Material)",
                    message=f"{rm_item.name} stock dropped to {rm_item.stock} during production",
                    timestamp=now,
                )
                db.add(alert)
    db.commit()
    return {"status": "success", "message": "Production run completed"}
