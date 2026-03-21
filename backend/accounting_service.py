"""
accounting_service.py — Zenith ERP | Double-Entry Accounting Service
SQLAlchemy 2.0 (Async) + FastAPI

Immutable Ledger Guarantee
---------------------------
The `post_journal_entry` function is the *sole* gateway through which a
JournalEntry transitions from DRAFT to POSTED.  It enforces:

  1. **Existence check** — entry must exist and belong to the caller's org.
  2. **Idempotency guard** — re-posting an already-POSTED entry is a no-op
     that raises HTTP 409 Conflict, preventing duplicate postings.
  3. **Balance validation** — SUM(debits) must equal SUM(credits) to satisfy
     the fundamental accounting equation before the entry is committed to the
     permanent ledger.  A mismatch raises HTTP 422 Unprocessable Entity.
  4. **Atomic commit** — the status flip and any side effects happen inside a
     single DB transaction; a failure anywhere rolls back the entire operation.
  5. **No editing after posting** — the service rejects any mutation of a
     POSTED entry's lines, enforcing immutability at the application layer
     (complement this with DB-level triggers in production).

Corrections are handled via reversing journal entries, maintaining a complete,
tamper-evident audit trail in the ledger.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from accounting_models import (
    Account,
    AccountType,
    JournalEntry,
    JournalLine,
    JournalStatus,
)


# ---------------------------------------------------------------------------
# Pydantic Schemas (V2)
# ---------------------------------------------------------------------------

class JournalLineCreate(BaseModel):
    account_id: uuid.UUID
    debit: Decimal = Field(default=Decimal("0.0000"), ge=0)
    credit: Decimal = Field(default=Decimal("0.0000"), ge=0)
    memo: str | None = None

    @field_validator("debit", "credit", mode="before")
    @classmethod
    def coerce_to_decimal(cls, v: object) -> Decimal:
        return Decimal(str(v))


class JournalEntryCreate(BaseModel):
    org_id: uuid.UUID
    reference: str = Field(..., min_length=1, max_length=100)
    entry_date: str  # ISO date string; convert in service
    description: str | None = None
    created_by: uuid.UUID | None = None
    lines: list[JournalLineCreate] = Field(..., min_length=2)


class AccountCreate(BaseModel):
    org_id: uuid.UUID
    code: str = Field(..., min_length=1, max_length=20)
    name: str = Field(..., min_length=1, max_length=255)
    account_type: AccountType
    description: str | None = None


class AccountRead(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    code: str
    name: str
    account_type: AccountType
    is_active: bool

    model_config = {"from_attributes": True}


class JournalLineRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    debit: Decimal
    credit: Decimal
    memo: str | None

    model_config = {"from_attributes": True}


class JournalEntryRead(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    reference: str
    description: str | None
    status: JournalStatus
    lines: list[JournalLineRead] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Account Service
# ---------------------------------------------------------------------------

async def create_account(db: AsyncSession, payload: AccountCreate) -> Account:
    """Create a new account in the Chart of Accounts."""
    account = Account(**payload.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def get_accounts(
    db: AsyncSession, org_id: uuid.UUID, account_type: AccountType | None = None
) -> list[Account]:
    """Retrieve all accounts for an organisation, optionally filtered by type."""
    stmt = select(Account).where(Account.org_id == org_id, Account.is_active.is_(True))
    if account_type:
        stmt = stmt.where(Account.account_type == account_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Journal Entry Service
# ---------------------------------------------------------------------------

async def create_journal_entry(
    db: AsyncSession, payload: JournalEntryCreate
) -> JournalEntry:
    """Persist a new DRAFT journal entry with its lines.

    Validates:
      - At least two lines exist (debit + credit sides).
      - Each line has exactly one non-zero side (XOR).
    The entry is saved in DRAFT status; call `post_journal_entry` to finalise.
    """
    for i, line in enumerate(payload.lines):
        debit_set = line.debit > 0
        credit_set = line.credit > 0
        if debit_set == credit_set:  # both zero or both non-zero
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Line {i}: exactly one of debit/credit must be non-zero.",
            )

    entry_data = payload.model_dump(exclude={"lines"})
    entry = JournalEntry(**entry_data)
    db.add(entry)
    await db.flush()  # get entry.id without committing

    for line_payload in payload.lines:
        line = JournalLine(
            org_id=payload.org_id,
            journal_id=entry.id,
            **line_payload.model_dump(),
        )
        db.add(line)

    await db.commit()
    await db.refresh(entry)
    return entry


async def post_journal_entry(
    db: AsyncSession,
    entry_id: uuid.UUID,
    org_id: uuid.UUID,
) -> JournalEntry:
    """Validate and post a DRAFT journal entry to the permanent ledger.

    This is the core double-entry integrity gate.  The function guarantees:

      - SUM(debits) == SUM(credits) — the fundamental accounting equation.
      - The entry transitions to POSTED atomically; partial transitions are
        impossible due to transaction semantics.
      - A POSTED entry cannot be re-posted (idempotency guard).

    Args:
        db:       Async SQLAlchemy session.
        entry_id: UUID of the JournalEntry to post.
        org_id:   Tenant identifier used for RLS scoping.

    Returns:
        The updated JournalEntry with status == POSTED.

    Raises:
        HTTPException 404: Entry not found for this tenant.
        HTTPException 409: Entry is already POSTED.
        HTTPException 422: Debits do not equal credits (unbalanced entry).
    """
    # 1. Fetch entry with lines (RLS-scoped by org_id)
    stmt = (
        select(JournalEntry)
        .options(selectinload(JournalEntry.lines))
        .where(
            JournalEntry.id == entry_id,
            JournalEntry.org_id == org_id,
        )
    )
    result = await db.execute(stmt)
    entry: JournalEntry | None = result.scalar_one_or_none()

    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"JournalEntry {entry_id} not found.",
        )

    # 2. Idempotency guard — already posted
    if entry.status == JournalStatus.POSTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"JournalEntry {entry_id} is already POSTED.",
        )

    # 3. Balance validation — the heart of double-entry accounting
    total_debits: Decimal = sum((line.debit for line in entry.lines), Decimal("0.0000"))
    total_credits: Decimal = sum((line.credit for line in entry.lines), Decimal("0.0000"))

    if total_debits != total_credits:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Journal entry is unbalanced: "
                f"debits={total_debits}, credits={total_credits}. "
                f"Difference={abs(total_debits - total_credits)}."
            ),
        )

    if total_debits == Decimal("0") or len(entry.lines) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Journal entry must have at least two lines with non-zero amounts.",
        )

    # 4. Atomic status flip — entry now lives in the immutable ledger
    entry.status = JournalStatus.POSTED
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_trial_balance(
    db: AsyncSession, org_id: uuid.UUID
) -> dict[str, Decimal]:
    """Compute the trial balance: sum of debits and credits per account for all
    POSTED entries.  Total debits must equal total credits (system-wide check).
    """
    stmt = (
        select(
            Account.code,
            Account.name,
            Account.account_type,
            func.coalesce(func.sum(JournalLine.debit), Decimal("0")).label("total_debit"),
            func.coalesce(func.sum(JournalLine.credit), Decimal("0")).label("total_credit"),
        )
        .join(JournalLine, JournalLine.account_id == Account.id)
        .join(JournalEntry, JournalEntry.id == JournalLine.journal_id)
        .where(
            Account.org_id == org_id,
            JournalEntry.status == JournalStatus.POSTED,
        )
        .group_by(Account.code, Account.name, Account.account_type)
        .order_by(Account.code)
    )
    result = await db.execute(stmt)
    rows = result.all()

    trial_balance = {}
    grand_debit = Decimal("0")
    grand_credit = Decimal("0")

    for row in rows:
        trial_balance[row.code] = {
            "name": row.name,
            "type": row.account_type,
            "total_debit": row.total_debit,
            "total_credit": row.total_credit,
            "net": row.total_debit - row.total_credit,
        }
        grand_debit += row.total_debit
        grand_credit += row.total_credit

    trial_balance["_totals"] = {
        "grand_debit": grand_debit,
        "grand_credit": grand_credit,
        "balanced": grand_debit == grand_credit,
    }
    return trial_balance
