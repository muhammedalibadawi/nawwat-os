"""
accounting_models.py — Zenith ERP | Double-Entry Accounting Models
SQLAlchemy 2.0 (Async) + Pydantic V2

Immutable Ledger Design
-----------------------
Once a JournalEntry transitions from DRAFT → POSTED the record is treated as
immutable.  The service layer enforces this by:

  1. Rejecting any attempt to re-post or edit a POSTED entry.
  2. Validating SUM(debits) == SUM(credits) *before* the status flip, so a
     partially-written entry can never become part of the permanent ledger.
  3. Corrections are made via *reversing entries* (a new JournalEntry whose
     lines are the mirror image of the original), preserving a full audit trail.

This mirrors real-world double-entry bookkeeping where the general ledger is
a write-once record of economic events.
"""

import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Enum as SAEnum,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import Date


# ---------------------------------------------------------------------------
# Base & Tenant Mixin
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


class TenantMixin:
    """Row-level security mixin.  Every query MUST filter by org_id to
    prevent cross-tenant data leaks."""

    org_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True,
        comment="Foreign key to organizations.id — used for RLS",
    )


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AccountType(str, enum.Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"


class JournalStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    POSTED = "POSTED"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Account(TenantMixin, Base):
    """Chart of Accounts entry.

    Normal balances follow the accounting equation:
      Assets = Liabilities + Equity
    Debits increase ASSET/EXPENSE accounts; credits increase the rest.
    """

    __tablename__ = "accounts"
    __table_args__ = (
        UniqueConstraint("org_id", "code", name="uq_account_org_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(
        SAEnum(AccountType, name="account_type_enum"), nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)

    # Relationships
    journal_lines: Mapped[list["JournalLine"]] = relationship(
        "JournalLine", back_populates="account"
    )

    def __repr__(self) -> str:
        return f"<Account {self.code} | {self.name} | {self.account_type}>"


class JournalEntry(TenantMixin, Base):
    """Header record for a double-entry transaction.

    Status lifecycle: DRAFT → POSTED (one-way, enforced in service layer).
    A POSTED entry is immutable; corrections require a reversing entry.
    """

    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    reference: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entry_date: Mapped[Date] = mapped_column(Date, nullable=False, default=func.current_date())
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[JournalStatus] = mapped_column(
        SAEnum(JournalStatus, name="journal_status_enum"),
        nullable=False,
        default=JournalStatus.DRAFT,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Relationships
    lines: Mapped[list["JournalLine"]] = relationship(
        "JournalLine", back_populates="journal_entry", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<JournalEntry {self.reference} | {self.status}>"


class JournalLine(TenantMixin, Base):
    """Individual debit or credit line within a JournalEntry.

    Constraints:
      - Exactly one of debit/credit must be non-zero (XOR at DB level).
      - Both values are stored as positive Numerics; sign is implied by column.
    """

    __tablename__ = "journal_lines"
    __table_args__ = (
        CheckConstraint(
            "(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)",
            name="ck_journal_line_debit_xor_credit",
        ),
        CheckConstraint("debit >= 0", name="ck_journal_line_debit_positive"),
        CheckConstraint("credit >= 0", name="ck_journal_line_credit_positive"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    journal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("journal_entries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("accounts.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    debit: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False, default=Decimal("0.0000")
    )
    credit: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=4), nullable=False, default=Decimal("0.0000")
    )
    memo: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    journal_entry: Mapped["JournalEntry"] = relationship(
        "JournalEntry", back_populates="lines"
    )
    account: Mapped["Account"] = relationship("Account", back_populates="journal_lines")

    def __repr__(self) -> str:
        return f"<JournalLine journal={self.journal_id} Dr={self.debit} Cr={self.credit}>"
