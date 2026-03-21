import io
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session
import models
from database import get_db
from app.dependencies import get_current_tenant

router = APIRouter(tags=["Reports"])


def generate_pdf_header(c, tenant, title):
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, 750, title)
    c.setFont("Helvetica", 12)
    c.drawString(50, 730, f"Company: {tenant.name}  |  ID: {tenant.id}")
    c.line(50, 715, 550, 715)
    return 700


@router.get("/api/v1/accounting/voucher/{entry_id}/pdf")
def generate_accounting_voucher(
    entry_id: str,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    entry = db.query(models.LedgerEntry).filter(
        models.LedgerEntry.id == entry_id,
        models.LedgerEntry.tenant_id == tenant.id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Journal Entry not found")
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    y = generate_pdf_header(c, tenant, "Accounting Voucher")
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, f"Voucher No: {entry.id}")
    c.setFont("Helvetica", 12)
    c.drawString(50, y - 20, f"Date: {entry.date}")
    c.drawString(50, y - 40, f"Description: {entry.description}")
    c.drawString(50, y - 60, f"Account: {entry.account}")
    c.drawString(50, y - 80, f"Status: {entry.status}")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y - 120, f"Debit Amount: ${entry.debit:,.2f}")
    c.drawString(50, y - 140, f"Credit Amount: ${entry.credit:,.2f}")
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=voucher-{entry.id}.pdf"})


@router.get("/api/v1/inventory/report/pdf")
def generate_inventory_report(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    products = db.query(models.Product).filter(models.Product.tenant_id == tenant.id).all()
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    y = generate_pdf_header(c, tenant, "Stock Balance Report")
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "ID")
    c.drawString(150, y, "Product Name")
    c.drawString(350, y, "Category")
    c.drawString(450, y, "Stock Level")
    c.drawString(520, y, "Unit Price")
    y -= 20
    c.setFont("Helvetica", 10)
    total_value = 0.0
    for p in products:
        c.drawString(50, y, str(p.id))
        c.drawString(150, y, str(p.name))
        c.drawString(350, y, p.category)
        c.drawString(450, y, str(p.stock))
        c.drawString(520, y, f"${p.price:,.2f}")
        total_value += p.stock * p.price
        y -= 20
        if y < 100:
            c.showPage()
            y = 750
    c.line(50, y - 10, 550, y - 10)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(350, y - 30, "Total Inventory Value:")
    c.drawString(500, y - 30, f"${total_value:,.2f}")
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "inline; filename=stock-balance.pdf"})


@router.get("/api/v1/crm/statement/{customer_name}/pdf")
def generate_crm_statement(
    customer_name: str,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    leads = db.query(models.LeadTracking).filter(
        models.LeadTracking.tenant_id == tenant.id,
        models.LeadTracking.customer_name.ilike(f"%{customer_name}%"),
    ).all()
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    y = generate_pdf_header(c, tenant, f"Client Statement: {customer_name}")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Recorded Lead Interactions & Prospects")
    y -= 20
    c.setFont("Helvetica", 10)
    for lead in leads:
        c.drawString(50, y, f"Date: {lead.follow_up_date} | Status: {lead.status}")
        c.drawString(50, y - 15, f"Email: {lead.email} | Phone: {lead.phone}")
        c.drawString(50, y - 30, f"Interests: {lead.interests}")
        y -= 50
        if y < 100:
            c.showPage()
            y = 750
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=statement-{customer_name}.pdf"})


@router.get("/api/v1/pos/invoice/{order_id}/pdf")
def generate_invoice_pdf(
    order_id: str,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    y = generate_pdf_header(c, tenant, "Tax Invoice / Receipt")
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, f"Invoice No: {order_id}")
    ledger = db.query(models.LedgerEntry).filter(
        models.LedgerEntry.tenant_id == tenant.id,
        models.LedgerEntry.description.like(f"%{order_id}%"),
        models.LedgerEntry.account == "Revenue:Sales",
    ).first()
    total = ledger.credit if ledger else 0.0
    date_recorded = ledger.date if ledger else "Unknown"
    c.setFont("Helvetica", 10)
    c.drawString(50, y - 20, f"Date: {date_recorded}")
    y -= 60
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Description")
    c.drawString(450, y, "Amount")
    y -= 10
    c.line(50, y, 550, y)
    y -= 20
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"POS Retail Sale ({order_id})")
    c.drawString(450, y, f"${total:,.2f}")
    y -= 40
    c.line(50, y, 550, y)
    y -= 20
    c.setFont("Helvetica-Bold", 14)
    c.drawString(350, y, "Total Amount Paid:")
    c.drawString(500, y, f"${total:,.2f}")
    y -= 60
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, y, "Thank you for your business. This is a computer-generated document.")
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=invoice-{order_id}.pdf"})


@router.get("/api/v1/accounting/report/pdf")
def generate_accounting_report(
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    entries = db.query(models.LedgerEntry).filter(models.LedgerEntry.tenant_id == tenant.id).all()
    total_debit = sum(e.debit for e in entries)
    total_credit = sum(e.credit for e in entries)
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, 750, "Monthly Financial Report")
    c.setFont("Helvetica", 14)
    c.drawString(50, 720, f"Company: {tenant.name} ({tenant.id})")
    c.setFont("Helvetica", 12)
    c.drawString(50, 680, f"Total Ledger Entries: {len(entries)}")
    c.drawString(50, 660, f"Total Debits: ${total_debit:,.2f}")
    c.drawString(50, 640, f"Total Credits: ${total_credit:,.2f}")
    balance = total_credit - total_debit
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, 600, f"Net Balance: ${balance:,.2f}")
    c.line(50, 580, 550, 580)
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(50, 550, "Generated by Nawwat OS Automated Reporting Engine")
    c.showPage()
    c.save()
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "inline; filename=accounting-report.pdf"})
