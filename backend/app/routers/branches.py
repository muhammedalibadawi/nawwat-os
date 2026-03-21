import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/branches", tags=["Multi-Branch"])


class BranchCreate(BaseModel):
    name: str
    location: str = ""
    contact: str = ""


@router.get("/")
def get_branches(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.Branch).filter(
        models.Branch.tenant_id == tenant.id
    ).all()


@router.post("/")
def create_branch(
    branch: BranchCreate,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    new_br = models.Branch(
        id=f"BR-{uuid.uuid4().hex[:8].upper()}",
        tenant_id=tenant.id,
        name=branch.name,
        location=branch.location,
        contact=branch.contact,
        status="active",
    )
    db.add(new_br)
    db.commit()
    db.refresh(new_br)
    return new_br
