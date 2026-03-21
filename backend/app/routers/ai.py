from sqlalchemy import func, desc
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1/ai", tags=["AI Copilot"])


class AIQuery(BaseModel):
    query: str


@router.post("/query")
def process_ai_query(
    data: AIQuery,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    q_lower = data.query.lower()
    if "sales" in q_lower or "revenue" in q_lower:
        total_sales = db.query(func.sum(models.Commission.sale_amount)).filter(
            models.Commission.tenant_id == tenant.id
        ).scalar() or 0
        return {"response": f"I analyzed your database. Your total sales volume is **${total_sales:,.2f}**. Keep up the great work building revenue!"}
    elif "agent" in q_lower or "performing" in q_lower or "employee" in q_lower:
        top_agent = db.query(
            models.Commission.user_id,
            func.sum(models.Commission.sale_amount).label("total_sales"),
        ).filter(models.Commission.tenant_id == tenant.id).group_by(
            models.Commission.user_id
        ).order_by(desc("total_sales")).first()
        if top_agent:
            return {"response": f"Your top performing agent is **{top_agent.user_id}**, driving **${top_agent.total_sales:,.2f}** in sales."}
        return {"response": "You don't have enough sales data yet to determine a top performing agent."}
    elif "shipment" in q_lower or "delivery" in q_lower or "order" in q_lower:
        pending = db.query(models.Shipment).filter(
            models.Shipment.tenant_id == tenant.id,
            models.Shipment.status == "Pending",
        ).count()
        out = db.query(models.Shipment).filter(
            models.Shipment.tenant_id == tenant.id,
            models.Shipment.status == "Out for Delivery",
        ).count()
        return {"response": f"You currently have **{pending} orders pending** and **{out} orders out for delivery**."}
    elif "lead" in q_lower or "prospect" in q_lower or "crm" in q_lower:
        new_leads = db.query(models.LeadTracking).filter(
            models.LeadTracking.tenant_id == tenant.id,
            models.LeadTracking.status == "New",
        ).count()
        won_leads = db.query(models.LeadTracking).filter(
            models.LeadTracking.tenant_id == tenant.id,
            models.LeadTracking.status == "Won",
        ).count()
        return {"response": f"Your CRM has **{new_leads} new prospects**. You've won **{won_leads} deals**."}
    return {"response": "I didn't quite catch that. Try asking about **sales, top agents, shipments, or leads**."}


@router.get("/insights")
def get_ai_insights(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    total_revenue = db.query(func.sum(models.LedgerEntry.credit)).filter(
        models.LedgerEntry.tenant_id == tenant.id,
        models.LedgerEntry.account == "Revenue:Sales",
    ).scalar() or 0.0
    low_stock_count = db.query(models.Product).filter(
        models.Product.tenant_id == tenant.id,
        models.Product.stock < models.Product.min_stock_level,
    ).count()
    new_leads = db.query(models.LeadTracking).filter(
        models.LeadTracking.tenant_id == tenant.id,
        models.LeadTracking.status == "New",
    ).count()
    won_leads = db.query(models.LeadTracking).filter(
        models.LeadTracking.tenant_id == tenant.id,
        models.LeadTracking.status == "Won",
    ).count()
    return {
        "status": "success",
        "data": [
            {"id": 1, "title": "Revenue Performance", "value": f"${total_revenue:,.2f}", "description": "Total sales volume.", "color": "emerald"},
            {"id": 2, "title": "Inventory Risk", "value": f"{low_stock_count} Items", "description": "Below min stock.", "color": "red" if low_stock_count > 0 else "blue"},
            {"id": 3, "title": "CRM Pipeline", "value": f"{won_leads} Won / {new_leads} Pending", "description": "Deals vs prospects.", "color": "purple"},
        ],
    }
