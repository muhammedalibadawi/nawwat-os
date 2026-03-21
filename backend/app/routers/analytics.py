from sqlalchemy import func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/summary")
def get_analytics_summary(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    try:
        total_products = db.query(models.Product).filter(
            models.Product.tenant_id == tenant.id
        ).count()
        total_employees = db.query(models.User).filter(
            models.User.tenant_id == tenant.id
        ).count()
        hot_deals = db.query(models.RealEstateDeal).filter(
            models.RealEstateDeal.tenant_id == tenant.id,
            models.RealEstateDeal.category == "HOT DEALS",
        ).count()
        warm_deals = db.query(models.RealEstateDeal).filter(
            models.RealEstateDeal.tenant_id == tenant.id,
            models.RealEstateDeal.category == "WARM DEALS",
        ).count()
        total_credits = db.query(func.sum(models.LedgerEntry.credit)).filter(
            models.LedgerEntry.tenant_id == tenant.id
        ).scalar() or 0.0
        total_debits = db.query(func.sum(models.LedgerEntry.debit)).filter(
            models.LedgerEntry.tenant_id == tenant.id
        ).scalar() or 0.0
        net_balance = total_credits - total_debits
        return {
            "kpis": {
                "total_products": total_products,
                "total_employees": total_employees,
                "net_ledger_balance": net_balance,
            },
            "real_estate_charts": [
                {"name": "Hot Deals", "value": hot_deals},
                {"name": "Warm Deals", "value": warm_deals},
            ],
        }
    except Exception as e:
        print(f"Analytics DB Error: {e}")
        return {
            "kpis": {"total_products": 0, "total_employees": 0, "net_ledger_balance": 0.0},
            "real_estate_charts": [],
        }


@router.get("/kpis")
def get_kpis(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    revenue = db.query(func.sum(models.LedgerEntry.credit)).filter(
        models.LedgerEntry.tenant_id == tenant.id
    ).scalar() or 0.0
    low_stock = db.query(models.Product).filter(
        models.Product.tenant_id == tenant.id,
        models.Product.stock <= models.Product.min_stock_level,
    ).count()
    active_leads = db.query(models.LeadTracking).filter(
        models.LeadTracking.tenant_id == tenant.id,
        models.LeadTracking.status.in_(["New", "Contacted", "Qualified"]),
    ).count()
    bank_balance = db.query(func.sum(models.Bank.balance)).filter(
        models.Bank.tenant_id == tenant.id
    ).scalar() or 0.0
    return {
        "total_revenue": revenue,
        "low_stock_alerts": low_stock,
        "active_leads": active_leads,
        "total_bank_balance": bank_balance,
    }


@router.get("/activity")
def get_recent_activity(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    activities = db.query(models.LedgerEntry).filter(
        models.LedgerEntry.tenant_id == tenant.id
    ).order_by(models.LedgerEntry.id.desc()).limit(5).all()
    return [
        {
            "id": a.id,
            "type": "Ledger",
            "description": a.description,
            "amount": a.credit if a.credit > 0 else a.debit,
            "date": a.date,
        }
        for a in activities
    ]
