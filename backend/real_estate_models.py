"""
real_estate_models.py — Zenith ERP | Real Estate Data Models
SQLAlchemy 2.0 (Async) with GIS coordinates and lease management.
"""

from __future__ import annotations

import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum as SAEnum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from accounting_models import Base, TenantMixin


class PropertyType(str, enum.Enum):
    APARTMENT = "APARTMENT"
    VILLA = "VILLA"
    OFFICE = "OFFICE"
    RETAIL = "RETAIL"
    WAREHOUSE = "WAREHOUSE"
    LAND = "LAND"


class Property(TenantMixin, Base):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    emirate: Mapped[str] = mapped_column(String(100), nullable=False, default="Dubai")
    property_type: Mapped[PropertyType] = mapped_column(
        SAEnum(PropertyType, name="property_type_enum"), nullable=False
    )
    # GIS coordinates stored as JSONB: {"lat": 25.2048, "lng": 55.2708}
    gis_coordinates: Mapped[dict] = mapped_column(JSONB, nullable=True)
    area_sqft: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    asking_price_aed: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    # AI enrichment fields
    owner_intent_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True,
        comment="0.0–1.0 fuzzy score from MarketIntelligenceEngine")
    is_high_intent: Mapped[bool] = mapped_column(Boolean, default=False)

    owner: Mapped["PropertyOwner | None"] = relationship("PropertyOwner", back_populates="properties")
    leases: Mapped[list["LeaseContract"]] = relationship("LeaseContract", back_populates="property")


class PropertyOwner(TenantMixin, Base):
    __tablename__ = "property_owners"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # contact_info: {"phone": "+971...", "email": "...", "linkedin": "..."}
    contact_info: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    is_owner_occupied: Mapped[bool] = mapped_column(Boolean, default=False,
        comment="True = owner lives in the property (high-intent seller flag)")
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    properties: Mapped[list["Property"]] = relationship("Property", back_populates="owner")


class LeaseContract(TenantMixin, Base):
    __tablename__ = "lease_contracts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("property_owners.id"), nullable=False
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("properties.id"), nullable=False
    )
    rent_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False,
        comment="Annual rent in AED")
    due_date: Mapped[Date] = mapped_column(Date, nullable=False)
    start_date: Mapped[Date] = mapped_column(Date, nullable=False)
    end_date: Mapped[Date] = mapped_column(Date, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    ejari_number: Mapped[str | None] = mapped_column(String(100), nullable=True,
        comment="Dubai RERA Ejari registration number")

    property: Mapped["Property"] = relationship("Property", back_populates="leases")
    tenant: Mapped["PropertyOwner"] = relationship("PropertyOwner")
