"""
onboarding_service.py — Zenith ERP | Dynamic Tenant Onboarding

Provisions a new Organisation with:
  - Industry-specific feature flags (JSONB)
  - Auto-generated Chart of Accounts for the selected vertical
"""

from __future__ import annotations

import enum
import uuid
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import JSON, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from accounting_models import Account, AccountType, Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class IndustryType(str, enum.Enum):
    RETAIL_PHARMA = "RETAIL_PHARMA"
    REAL_ESTATE = "REAL_ESTATE"
    MANUFACTURING = "MANUFACTURING"


# ---------------------------------------------------------------------------
# Organisation Model
# ---------------------------------------------------------------------------

class Organization(Base):
    """Top-level tenant entity.  All other models reference org_id."""

    __tablename__ = "organizations"
    __table_args__ = (UniqueConstraint("slug", name="uq_org_slug"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False)
    industry: Mapped[IndustryType] = mapped_column(
        String(50), nullable=False
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    feature_flags: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict,
        comment="JSONB blob of toggled UI modules; set during provisioning"
    )
    is_active: Mapped[bool] = mapped_column(default=True)


# ---------------------------------------------------------------------------
# Pydantic Schemas (V2)
# ---------------------------------------------------------------------------

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9\-]+$")
    industry: IndustryType
    email: EmailStr
    # Optionally allow the caller to override flags; provisioning logic wins.
    feature_flags: dict[str, Any] = Field(default_factory=dict)


class OrganizationRead(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    industry: IndustryType
    email: str
    feature_flags: dict[str, Any]
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Feature Flag Profiles
# ---------------------------------------------------------------------------

_FEATURE_FLAGS: dict[IndustryType, dict[str, Any]] = {
    IndustryType.RETAIL_PHARMA: {
        "pos_enabled": True,
        "batch_expiry_enabled": True,
        "real_estate_enabled": False,
        "manufacturing_enabled": False,
        "ai_sourcing_enabled": False,
    },
    IndustryType.REAL_ESTATE: {
        "pos_enabled": False,
        "batch_expiry_enabled": False,
        "real_estate_enabled": True,
        "manufacturing_enabled": False,
        "ai_sourcing_enabled": True,
    },
    IndustryType.MANUFACTURING: {
        "pos_enabled": False,
        "batch_expiry_enabled": True,
        "real_estate_enabled": False,
        "manufacturing_enabled": True,
        "ai_sourcing_enabled": False,
    },
}


# ---------------------------------------------------------------------------
# Default Chart of Accounts per Industry
# ---------------------------------------------------------------------------

def _default_coa(industry: IndustryType) -> list[dict]:
    """Return a minimal, industry-specific Chart of Accounts seed."""

    # Common accounts shared across all verticals
    common = [
        {"code": "1000", "name": "Cash & Cash Equivalents",       "type": AccountType.ASSET},
        {"code": "1200", "name": "Accounts Receivable",           "type": AccountType.ASSET},
        {"code": "1500", "name": "Prepaid Expenses",              "type": AccountType.ASSET},
        {"code": "2000", "name": "Accounts Payable",              "type": AccountType.LIABILITY},
        {"code": "2100", "name": "Accrued Liabilities",           "type": AccountType.LIABILITY},
        {"code": "3000", "name": "Owner Equity",                  "type": AccountType.EQUITY},
        {"code": "3100", "name": "Retained Earnings",             "type": AccountType.EQUITY},
        {"code": "4000", "name": "General Revenue",               "type": AccountType.REVENUE},
        {"code": "5000", "name": "General Operating Expenses",    "type": AccountType.EXPENSE},
        {"code": "5100", "name": "Salaries & Wages",              "type": AccountType.EXPENSE},
    ]

    industry_specific: dict[IndustryType, list[dict]] = {
        IndustryType.RETAIL_PHARMA: [
            {"code": "1300", "name": "Inventory — Pharmaceutical",  "type": AccountType.ASSET},
            {"code": "1310", "name": "Inventory — Retail / FMCG",   "type": AccountType.ASSET},
            {"code": "4100", "name": "POS Sales Revenue",            "type": AccountType.REVENUE},
            {"code": "4200", "name": "Prescription Revenue",         "type": AccountType.REVENUE},
            {"code": "5200", "name": "Cost of Goods Sold",           "type": AccountType.EXPENSE},
            {"code": "5300", "name": "Batch Write-off / Expiry Loss","type": AccountType.EXPENSE},
        ],
        IndustryType.REAL_ESTATE: [
            {"code": "1400", "name": "Investment Properties",        "type": AccountType.ASSET},
            {"code": "1410", "name": "Properties Under Development", "type": AccountType.ASSET},
            {"code": "2200", "name": "Tenant Security Deposits",     "type": AccountType.LIABILITY},
            {"code": "4100", "name": "Rental Income",                "type": AccountType.REVENUE},
            {"code": "4200", "name": "Property Management Fees",     "type": AccountType.REVENUE},
            {"code": "5200", "name": "Property Maintenance",         "type": AccountType.EXPENSE},
            {"code": "5300", "name": "Depreciation — Properties",    "type": AccountType.EXPENSE},
        ],
        IndustryType.MANUFACTURING: [
            {"code": "1300", "name": "Raw Materials Inventory",      "type": AccountType.ASSET},
            {"code": "1350", "name": "WIP Inventory",                "type": AccountType.ASSET},
            {"code": "1360", "name": "Finished Goods Inventory",     "type": AccountType.ASSET},
            {"code": "4100", "name": "Product Sales Revenue",        "type": AccountType.REVENUE},
            {"code": "5200", "name": "Cost of Manufactured Goods",   "type": AccountType.EXPENSE},
            {"code": "5300", "name": "Factory Overhead",             "type": AccountType.EXPENSE},
            {"code": "5400", "name": "Depreciation — Machinery",     "type": AccountType.EXPENSE},
        ],
    }

    return common + industry_specific.get(industry, [])


# ---------------------------------------------------------------------------
# Provisioning Service
# ---------------------------------------------------------------------------

async def provision_new_tenant(
    db: AsyncSession, payload: OrganizationCreate
) -> Organization:
    """Create a new Organisation tenant with feature flags and default CoA.

    Steps:
      1. Validate slug uniqueness.
      2. Assign industry-specific feature flags.
      3. Persist the Organisation.
      4. Seed the Chart of Accounts for the vertical.

    Args:
        db:      Async SQLAlchemy session.
        payload: Validated OrganizationCreate schema.

    Returns:
        The newly created Organisation record.

    Raises:
        HTTPException 409: Slug already taken.
    """
    from sqlalchemy import select

    # 1. Slug uniqueness check
    existing = await db.execute(
        select(Organization).where(Organization.slug == payload.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Organisation slug '{payload.slug}' is already taken.",
        )

    # 2. Resolve feature flags
    flags = _FEATURE_FLAGS.get(payload.industry, {})

    # 3. Create Organisation
    org = Organization(
        name=payload.name,
        slug=payload.slug,
        industry=payload.industry,
        email=payload.email,
        feature_flags=flags,
    )
    db.add(org)
    await db.flush()  # get org.id

    # 4. Seed Chart of Accounts
    coa_seeds = _default_coa(payload.industry)
    for entry in coa_seeds:
        account = Account(
            org_id=org.id,
            code=entry["code"],
            name=entry["name"],
            account_type=entry["type"],
        )
        db.add(account)

    await db.commit()
    await db.refresh(org)
    return org
