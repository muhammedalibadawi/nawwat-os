from datetime import datetime
import uuid
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/accounting", tags=["Accounting"])


class LedgerTransaction(BaseModel):
    description: str
    account: str
    amount: float
    type: str  # "debit" or "credit"


@router.get("/ledger")
def get_ledger(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    try:
        return db.query(models.LedgerEntry).filter(
            models.LedgerEntry.tenant_id == tenant.id
        ).order_by(models.LedgerEntry.id.desc()).all()
    except Exception as e:
        print(f"DB Error: {e}")
        return []


@router.get("/payables")
def get_payables(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.AccountPayable).filter(
        models.AccountPayable.tenant_id == tenant.id
    ).order_by(models.AccountPayable.due_date.asc()).all()


@router.get("/receivables")
def get_receivables(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    return db.query(models.AccountReceivable).filter(
        models.AccountReceivable.tenant_id == tenant.id
    ).order_by(models.AccountReceivable.due_date.asc()).all()


@router.post("/ledger")
def create_ledger_entry(
    tx: LedgerTransaction,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    final_account = tx.account
    desc_lower = tx.description.lower()
    if "bank" in desc_lower or "transfer" in desc_lower:
        final_account = "Assets:Bank"
    elif "cash" in desc_lower:
        final_account = "Assets:Cash"
    elif "credit" in desc_lower or "payable" in desc_lower:
        final_account = "Liabilities:Accounts Payable"
    elif "receivable" in desc_lower or "due" in desc_lower:
        final_account = "Assets:Accounts Receivable"
    new_id = f"JRN-{str(uuid.uuid4())[:4].upper()}"
    new_entry = models.LedgerEntry(
        id=new_id,
        tenant_id=tenant.id,
        date=datetime.now().strftime("%Y-%m-%d"),
        description=tx.description,
        account=final_account,
        debit=tx.amount if tx.type == "debit" else 0.0,
        credit=tx.amount if tx.type == "credit" else 0.0,
        status="Posted",
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)
    return new_entry
