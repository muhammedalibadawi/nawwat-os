"""
celery_tasks.py — Zenith ERP | Background Task Engine (Celery + Redis)

Periodic jobs:
  - notify_expiring_batches : WhatsApp alerts for inventory expiring in < 30 days
  - dunning_process_rent    : IVR calls for rent overdue by >= 3 days

Run workers:
  celery -A celery_tasks worker --loglevel=info
  celery -A celery_tasks beat   --loglevel=info --scheduler django_celery_beat.schedulers:DatabaseScheduler
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import date, timedelta

from celery import Celery
from celery.schedules import crontab
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from notification_service import NotificationService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Celery App Configuration
# ---------------------------------------------------------------------------

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "zenith_erp",
    broker=REDIS_URL,
    backend=REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Dubai",
    enable_utc=True,
    task_acks_late=True,           # ensure tasks are not lost on worker crash
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,  # fair dispatch for long-running tasks
    beat_schedule={
        "notify-expiring-batches-daily": {
            "task": "celery_tasks.notify_expiring_batches",
            "schedule": crontab(hour=7, minute=0),  # 07:00 GST daily
        },
        "dunning-process-rent-daily": {
            "task": "celery_tasks.dunning_process_rent",
            "schedule": crontab(hour=8, minute=30),  # 08:30 GST daily
        },
    },
)

# ---------------------------------------------------------------------------
# Async DB Session Factory
# ---------------------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+asyncpg://zenith:zenith@localhost/zenith_erp"
)

_engine = create_async_engine(DATABASE_URL, pool_pre_ping=True, echo=False)
AsyncSessionFactory = sessionmaker(
    bind=_engine, class_=AsyncSession, expire_on_commit=False
)

notifier = NotificationService()


# ---------------------------------------------------------------------------
# Helper: run async code safely inside a Celery worker (sync context)
# ---------------------------------------------------------------------------

def _run(coro):
    """Execute an async coroutine from a synchronous Celery task."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Inventory helpers (async)
# ---------------------------------------------------------------------------

async def _fetch_expiring_batches(session: AsyncSession) -> list[dict]:
    """Return inventory batches expiring within 30 days.

    Adjust the import path to your actual inventory models.
    """
    # Lazy import to avoid circular deps at module load time
    try:
        from inventory_models import InventoryBatch, Branch, BranchManager  # type: ignore
    except ImportError:
        logger.warning("inventory_models not available; skipping expiry query.")
        return []

    threshold = date.today() + timedelta(days=30)
    stmt = (
        select(
            InventoryBatch.id,
            InventoryBatch.product_name,
            InventoryBatch.expiry_date,
            BranchManager.phone,
            BranchManager.name.label("manager_name"),
        )
        .join(Branch, Branch.id == InventoryBatch.branch_id)
        .join(BranchManager, BranchManager.branch_id == Branch.id)
        .where(
            InventoryBatch.expiry_date <= threshold,
            InventoryBatch.expiry_date >= date.today(),
            InventoryBatch.quantity > 0,
        )
    )
    result = await session.execute(stmt)
    return [row._asdict() for row in result.all()]


async def _send_expiry_notifications(batches: list[dict]) -> None:
    for batch in batches:
        days_left = (batch["expiry_date"] - date.today()).days
        msg = (
            f"⚠️ Zenith ERP Expiry Alert\n"
            f"Dear {batch['manager_name']},\n"
            f"Product: {batch['product_name']}\n"
            f"Expiry: {batch['expiry_date']} ({days_left} days remaining)\n"
            f"Please take immediate action to minimise wastage."
        )
        result = await notifier.send_whatsapp(phone=batch["phone"], msg=msg)
        if not result.success:
            logger.error(
                "WhatsApp failed for batch %s → %s: %s",
                batch["id"], batch["phone"], result.error,
            )
        else:
            logger.info("Expiry alert sent for batch %s (msg_id=%s)", batch["id"], result.provider_message_id)


# ---------------------------------------------------------------------------
# Real Estate helpers (async)
# ---------------------------------------------------------------------------

async def _fetch_overdue_leases(session: AsyncSession) -> list[dict]:
    """Return lease contracts where rent is >= 3 days overdue."""
    try:
        from real_estate_models import LeaseContract, PropertyOwner  # type: ignore
    except ImportError:
        logger.warning("real_estate_models not available; skipping lease query.")
        return []

    overdue_threshold = date.today() - timedelta(days=3)
    stmt = (
        select(
            LeaseContract.id,
            LeaseContract.rent_amount,
            LeaseContract.due_date,
            PropertyOwner.name.label("tenant_name"),
            PropertyOwner.contact_info.label("tenant_phone"),
        )
        .join(PropertyOwner, PropertyOwner.id == LeaseContract.tenant_id)
        .where(
            LeaseContract.due_date <= overdue_threshold,
            LeaseContract.is_paid.is_(False),
        )
    )
    result = await session.execute(stmt)
    return [row._asdict() for row in result.all()]


async def _trigger_rent_ivr_calls(leases: list[dict]) -> None:
    for lease in leases:
        days_overdue = (date.today() - lease["due_date"]).days
        script = (
            f"Hello {lease['tenant_name']}, this is an automated reminder from Zenith ERP. "
            f"Your rent payment of AED {lease['rent_amount']:,.2f} was due on "
            f"{lease['due_date']} and is now {days_overdue} days overdue. "
            f"Please contact your property manager immediately to avoid further action. "
            f"Thank you."
        )
        result = await notifier.trigger_automated_ivr_call(
            phone=lease["tenant_phone"], script=script
        )
        if not result.success:
            logger.error(
                "IVR call failed for lease %s → %s: %s",
                lease["id"], lease["tenant_phone"], result.error,
            )
        else:
            logger.info(
                "Dunning IVR initiated for lease %s (call_sid=%s)",
                lease["id"], result.provider_message_id,
            )


# ---------------------------------------------------------------------------
# Celery Tasks
# ---------------------------------------------------------------------------

@celery_app.task(
    name="celery_tasks.notify_expiring_batches",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 minutes
    autoretry_for=(Exception,),
)
def notify_expiring_batches(self) -> dict:
    """Periodic task: Query inventory for items expiring within 30 days and
    send WhatsApp alerts to the respective branch managers.

    Runs daily at 07:00 GST via Celery Beat.
    """
    logger.info("Task started: notify_expiring_batches")

    async def _run_async():
        async with AsyncSessionFactory() as session:
            batches = await _fetch_expiring_batches(session)
            logger.info("Found %d expiring batches.", len(batches))
            await _send_expiry_notifications(batches)
            return {"processed": len(batches)}

    result = _run(_run_async())
    logger.info("Task complete: notify_expiring_batches | %s", result)
    return result


@celery_app.task(
    name="celery_tasks.dunning_process_rent",
    bind=True,
    max_retries=3,
    default_retry_delay=300,
    autoretry_for=(Exception,),
)
def dunning_process_rent(self) -> dict:
    """Periodic task: Identify overdue rent (>= 3 days) and initiate
    automated IVR calls to tenants.

    Runs daily at 08:30 GST via Celery Beat.
    """
    logger.info("Task started: dunning_process_rent")

    async def _run_async():
        async with AsyncSessionFactory() as session:
            leases = await _fetch_overdue_leases(session)
            logger.info("Found %d overdue leases.", len(leases))
            await _trigger_rent_ivr_calls(leases)
            return {"processed": len(leases)}

    result = _run(_run_async())
    logger.info("Task complete: dunning_process_rent | %s", result)
    return result
