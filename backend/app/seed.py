"""Database seeding for development/demo."""
import json
from datetime import datetime

import models
from database import get_db


def seed_db():
    db = next(get_db())
    if not db.query(models.Tenant).first():
        db.add_all([
            models.Tenant(id="T-ACME", name="Acme Corp", status="active",
                          modules='["POS", "HR", "Accounting", "RealEstate", "Inventory", "CRM"]'),
            models.Tenant(id="T-GLOBEX", name="Globex Inc", status="active",
                          modules='["POS", "Accounting"]')
        ])
        db.commit()

    if not db.query(models.JournalEntry).first():
        from accounting import create_balanced_entry
        t_id = "T-ACME"
        try:
            create_balanced_entry(db, t_id, "Opening Balance Injection", [
                {'account_id': 'Assets:Cash', 'debit': 50000.0, 'credit': 0.0},
                {'account_id': 'Equity:Capital', 'debit': 0.0, 'credit': 50000.0}
            ])
        except Exception as e:
            print(f"Seed Error: {e}")

    t_id = "T-ACME"
    if not db.query(models.Product).first():
        db.add_all([
            models.Product(id="p1", tenant_id=t_id, name="Organic Whole Milk (1L)", price=8.50, category="Dairy", stock=42, barcode="6281001"),
            models.Product(id="p2", tenant_id=t_id, name="Fresh Croissant", price=12.00, category="Bakery", stock=18, barcode="6281002"),
            models.Product(id="p3", tenant_id=t_id, name="Colombian Roast Coffee (250g)", price=45.00, category="Pantry", stock=12, barcode="6281003"),
            models.Product(id="p4", tenant_id=t_id, name="Almonds Roasted (500g)", price=38.00, category="Pantry", stock=5, barcode="6281004")
        ])

    if not db.query(models.CustomField).first():
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.add_all([
            models.CustomField(id="cf1", tenant_id=t_id, entity_type="product", name="Barcode", key="barcode", field_type="text", is_required=1, created_at=now),
            models.CustomField(id="cf2", tenant_id=t_id, entity_type="product", name="Tax Rate", key="tax_rate", field_type="number", is_required=0, created_at=now),
            models.CustomField(id="cf3", tenant_id=t_id, entity_type="product", name="Brand", key="brand", field_type="text", is_required=0, created_at=now),
            models.CustomField(id="cf4", tenant_id=t_id, entity_type="lead", name="Industry", key="industry", field_type="text", is_required=0, created_at=now)
        ])
    if not db.query(models.RealEstateDeal).first():
        db.add_all([
            models.RealEstateDeal(id="re1", tenant_id=t_id, property="Marina View Tower - Apt 1204", price_usd=450000, estimated_roi="8.5%", ai_score=92, category="HOT DEALS", reasoning="Priced 15% below market average for Marina properties. High historical rental yield."),
            models.RealEstateDeal(id="re2", tenant_id=t_id, property="Downtown Plaza Commercial Space", price_usd=1200000, estimated_roi="6.2%", ai_score=74, category="WARM DEALS", reasoning="Stable long-term tenant, but upcoming building maintenance fees reduce short-term net yield."),
            models.RealEstateDeal(id="re3", tenant_id=t_id, property="Jumeirah Village Circle - Townhouse", price_usd=680000, estimated_roi="7.1%", ai_score=85, category="HOT DEALS", reasoning="High demand area. Recent infrastructure upgrades indicate strong capital appreciation potential.")
        ])
    if not db.query(models.User).first():
        db.add_all([
            models.User(id="EMP-001", tenant_id=t_id, name="Sarah Jenkins", role="Senior Accountant", department="Finance", status="Active", avatar="SJ"),
            models.User(id="EMP-002", tenant_id=t_id, name="Michael Chen", role="Software Engineer", department="Engineering", status="Active", avatar="MC"),
            models.User(id="EMP-003", tenant_id=t_id, name="Elena Rodriguez", role="HR Manager", department="Human Resources", status="On Leave", avatar="ER"),
            models.User(id="EMP-004", tenant_id=t_id, name="David Smith", role="Sales Director", department="Sales", status="Active", avatar="DS")
        ])
    if not db.query(models.LedgerEntry).first():
        db.add_all([
            models.LedgerEntry(id="JRN-1042", tenant_id=t_id, date="2026-02-28", description="Office Supplies Purchase", account="Expenses:Supplies", debit=450.00, credit=0.00, status="Posted"),
            models.LedgerEntry(id="JRN-1043", tenant_id=t_id, date="2026-02-28", description="Office Supplies Purchase", account="Assets:Cash", debit=0.00, credit=450.00, status="Posted"),
            models.LedgerEntry(id="JRN-1044", tenant_id=t_id, date="2026-02-27", description="Client Payment - Acme Corp", account="Assets:Bank", debit=12500.00, credit=0.00, status="Posted"),
            models.LedgerEntry(id="JRN-1045", tenant_id=t_id, date="2026-02-27", description="Client Payment - Acme Corp", account="Assets:Accounts Receivable", debit=0.00, credit=12500.00, status="Posted")
        ])

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not db.query(models.Notification).first():
        db.add_all([
            models.Notification(id="notif-1", tenant_id=t_id, user_id="EMP-001", title="New Invoice Generated", message="Invoice INV-2026-042 has been created.", is_read=0, timestamp=now),
            models.Notification(id="notif-2", tenant_id=t_id, user_id="EMP-001", title="Meeting Reminder", message="Q1 Planning in 15 minutes.", is_read=0, timestamp=now),
            models.Notification(id="notif-3", tenant_id="T-GLOBEX", user_id="EMP-101", title="System Maintenance", message="Scheduled for tonight.", is_read=0, timestamp=now)
        ])
    if not db.query(models.Meeting).first():
        db.add_all([
            models.Meeting(id="meet-1", tenant_id=t_id, title="Q1 Financial Review", description="Quarterly sync with the finance team.", start_time="2026-03-01 10:00:00", end_time="2026-03-01 11:30:00", attendees=json.dumps(["EMP-001", "EMP-002"])),
            models.Meeting(id="meet-2", tenant_id=t_id, title="Product Roadmap Sync", description="Aligning on Q2 deliverables.", start_time="2026-03-02 14:00:00", end_time="2026-03-02 15:00:00", attendees=json.dumps(["EMP-002", "EMP-004"]))
        ])
    if not db.query(models.ChatMessage).first():
        db.add_all([
            models.ChatMessage(id="chat-1", tenant_id=t_id, sender_id="EMP-002", receiver_id="EMP-001", message="Hey Sarah, did you approve that invoice yet?", is_group_chat=0, timestamp=now),
            models.ChatMessage(id="chat-2", tenant_id=t_id, sender_id="EMP-001", receiver_id="EMP-002", message="Yes, just now. You should see it in the ledger.", is_group_chat=0, timestamp=now),
            models.ChatMessage(id="chat-3", tenant_id=t_id, sender_id="EMP-004", receiver_id=None, message="Team, sales targets for this month are looking great 🚀", is_group_chat=1, timestamp=now)
        ])
    if not db.query(models.Commission).first():
        db.add_all([
            models.Commission(id="comm-1", tenant_id=t_id, user_id="EMP-004", sale_amount=12500.0, commission_amount=625.0, date=now),
            models.Commission(id="comm-2", tenant_id=t_id, user_id="EMP-004", sale_amount=450000.0, commission_amount=22500.0, date=now)
        ])
    if not db.query(models.Shipment).first():
        db.add_all([
            models.Shipment(id="SHP-101", tenant_id="T-ACME", order_id="ORD-001", status="In Transit",
                            tracking_number="AWB-882190", destination_city="Dubai Marina",
                            latitude=25.0657, longitude=55.1412, estimated_arrival="14:30 PM"),
            models.Shipment(id="SHP-102", tenant_id="T-ACME", order_id="ORD-002", status="Pending",
                            tracking_number="AWB-882191", destination_city="Riyadh Hub",
                            latitude=24.7136, longitude=46.6753, estimated_arrival="Tomorrow")
        ])
        db.commit()
    if not db.query(models.LeadTracking).first():
        db.add_all([
            models.LeadTracking(id="lead-1", tenant_id=t_id, customer_name="Alice Smith", email="alice@test.com", phone="+971501234567", interests="Marina View Tower", follow_up_date="2026-03-05", status="New"),
            models.LeadTracking(id="lead-2", tenant_id=t_id, customer_name="Bob Jones", email="bob@test.com", phone="+971509876543", interests="JVC Townhouses", follow_up_date="2026-03-02", status="Contacted"),
            models.LeadTracking(id="lead-3", tenant_id=t_id, customer_name="Charlie Brown", email="charles@test.com", phone="+971505556666", interests="Commercial Spaces", follow_up_date="2026-03-10", status="Qualified")
        ])
    db.commit()
