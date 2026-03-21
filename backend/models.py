from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, DateTime
from database import Base

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    status = Column(String, default="active")
    industry_type = Column(String, default="retail")
    modules = Column(String) # JSON string array

class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    name = Column(String, index=True)
    role = Column(String) # MASTER_ADMIN, SUPER_ADMIN, ACCOUNTANT, CASHIER
    department = Column(String)
    status = Column(String, default="Active")
    avatar = Column(String)
    commission_rate = Column(Float, default=0.0)

class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    name = Column(String, index=True)
    price = Column(Float)
    stock = Column(Integer)
    min_stock_level = Column(Integer, default=5)
    category = Column(String)
    barcode = Column(String, index=True)
    tax_rate = Column(Float, default=0.0)
    sku = Column(String, nullable=True)
    ingredients = Column(String, nullable=True)

# --- محرك الحسابات المتقدم (Advanced Accounting) ---
class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    entry_number = Column(String, unique=True)
    entry_date = Column(String)
    description = Column(String)
    status = Column(String, default="posted") # posted, reversed

class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"
    id = Column(String, primary_key=True)
    entry_id = Column(String, ForeignKey("journal_entries.id"))
    account_id = Column(String)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)

# --- طابور المزامنة (Sync Queue) ---
class SyncQueue(Base):
    __tablename__ = "sync_queue"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    entity_type = Column(String, index=True)
    entity_id = Column(String, index=True)
    operation = Column(String)  # CREATE, UPDATE, DELETE
    payload = Column(String)
    hlc_timestamp = Column(String)
    status = Column(String, default="pending")  # pending, synced, conflict

# --- Restored Mock Models for Mock Routers ---
class CustomField(Base):
    __tablename__ = "custom_fields"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    entity_type = Column(String)
    name = Column(String)
    key = Column(String)
    field_type = Column(String)
    is_required = Column(Integer)
    created_at = Column(String)

class RealEstateDeal(Base):
    __tablename__ = "real_estate_deals"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    property = Column(String)
    price_usd = Column(Float)
    estimated_roi = Column(String)
    ai_score = Column(Integer)
    category = Column(String)
    reasoning = Column(String)

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    date = Column(String)
    description = Column(String)
    account = Column(String)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    status = Column(String)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    user_id = Column(String, index=True)
    title = Column(String)
    message = Column(String)
    is_read = Column(Integer, default=0)
    timestamp = Column(String)

class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    title = Column(String)
    description = Column(String)
    start_time = Column(String)
    end_time = Column(String)
    attendees = Column(String) # JSON string

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    sender_id = Column(String, index=True)
    receiver_id = Column(String, index=True)
    message = Column(String)
    is_group_chat = Column(Integer, default=0)
    timestamp = Column(String)

class Commission(Base):
    __tablename__ = "commissions"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    user_id = Column(String, index=True)
    sale_amount = Column(Float)
    commission_amount = Column(Float)
    date = Column(String)

class Shipment(Base):
    __tablename__ = "shipments"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    order_id = Column(String)
    status = Column(String) # Pending, In Transit, Delivered
    tracking_number = Column(String, unique=True)
    destination_city = Column(String)
    latitude = Column(Float) # للإحداثيات على الخريطة
    longitude = Column(Float)
    estimated_arrival = Column(String)
    updated_at = Column(String)

class LeadTracking(Base):
    __tablename__ = "lead_tracking"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    customer_name = Column(String)
    email = Column(String)
    phone = Column(String)
    interests = Column(String)
    follow_up_date = Column(String)
    status = Column(String)

class StockMovement(Base):
    __tablename__ = "stock_movements"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    product_id = Column(String, index=True)
    movement_type = Column(String)
    quantity = Column(Integer)
    date = Column(String)
    reference = Column(String)

class EmployeePoints(Base):
    __tablename__ = "employee_points"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    user_id = Column(String, index=True)
    total_points = Column(Integer, default=0)
    current_streak_days = Column(Integer, default=0)
    last_activity_date = Column(String)

class AccountPayable(Base):
    __tablename__ = "account_payables"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    due_date = Column(String)
    amount = Column(Float)
    description = Column(String)

class AccountReceivable(Base):
    __tablename__ = "account_receivables"
    id = Column(String, primary_key=True)
    tenant_id = Column(String, index=True)
    due_date = Column(String)
    amount = Column(Float)
    description = Column(String)


class Bank(Base):
    __tablename__ = "banks"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    name = Column(String)
    account_number = Column(String, nullable=True)
    balance = Column(Float, default=0.0)
    currency = Column(String, default="AED")


class Branch(Base):
    __tablename__ = "branches"
    id = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    name = Column(String)
    location = Column(String, nullable=True)
    contact = Column(String, nullable=True)
    status = Column(String, default="active")
