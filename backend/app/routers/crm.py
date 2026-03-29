import os
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from app.dependencies import get_current_tenant
from app.routers.logistics import trigger_communication
from database import get_db

router = APIRouter(prefix="/api/v1/crm", tags=["CRM & Leads"])
LEGACY_LEADTRACKING_WARNING = (
    "Legacy CRM LeadTracking endpoint. Active frontend CRM flows use Supabase contacts via src/services/crmService.ts."
)


def _get_supabase_project_settings() -> tuple[str, str]:
    supabase_url = (os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL") or "").strip().rstrip("/")
    service_role_key = (os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip()

    if not supabase_url or not service_role_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase service role configuration is missing",
        )

    return supabase_url, service_role_key


def _supabase_headers(service_role_key: str) -> dict[str, str]:
    return {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return response.text.strip() or "Unknown Supabase error"

    if isinstance(payload, dict):
        for key in ("msg", "message", "error_description", "error"):
            value = payload.get(key)
            if value:
                return str(value)
    return str(payload)


def _fetch_customer_contact(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    tenant_id: str,
    contact_id: str,
) -> dict:
    response = client.get(
        f"{supabase_url}/rest/v1/contacts",
        headers=_supabase_headers(service_role_key),
        params={
            "select": "id,tenant_id,type,name,email,auth_id,portal_enabled,is_active",
            "id": f"eq.{contact_id}",
            "tenant_id": f"eq.{tenant_id}",
        },
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch contact: {_extract_error_detail(response)}",
        )

    rows = response.json()
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer contact not found")

    contact = rows[0]
    if contact.get("type") != "customer":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contact must be a customer")
    if not contact.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer contact is inactive")

    email = str(contact.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer contact is missing an email")

    return contact


def _create_portal_auth_user(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    tenant_id: str,
    contact: dict,
) -> str:
    response = client.post(
        f"{supabase_url}/auth/v1/admin/users",
        headers=_supabase_headers(service_role_key),
        json={
            "email": contact["email"],
            "email_confirm": True,
            "user_metadata": {
                "full_name": contact.get("name") or contact["email"],
            },
            "app_metadata": {
                "tenant_id": tenant_id,
                "user_role": "customer",
            },
        },
    )

    if response.status_code >= 400:
        detail = _extract_error_detail(response)
        if response.status_code in {400, 409, 422}:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Failed to create portal auth user: {detail}",
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create portal auth user: {detail}",
        )

    payload = response.json()
    auth_user = payload.get("user") if isinstance(payload, dict) and isinstance(payload.get("user"), dict) else payload
    auth_id = str(auth_user.get("id") or "").strip() if isinstance(auth_user, dict) else ""
    if not auth_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Supabase auth user creation did not return an id",
        )
    return auth_id


def _link_contact_to_auth_user(
    client: httpx.Client,
    supabase_url: str,
    service_role_key: str,
    tenant_id: str,
    contact_id: str,
    auth_id: str,
) -> dict:
    response = client.patch(
        f"{supabase_url}/rest/v1/contacts",
        headers={**_supabase_headers(service_role_key), "Prefer": "return=representation"},
        params={
            "id": f"eq.{contact_id}",
            "tenant_id": f"eq.{tenant_id}",
        },
        json={
            "auth_id": auth_id,
            "portal_enabled": True,
        },
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to link contact to auth user: {_extract_error_detail(response)}",
        )

    rows = response.json()
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Contact link update returned no rows",
        )

    return rows[0]


class LeadCreateSchema(BaseModel):
    customer_name: str
    email: str
    phone: str
    interests: str
    follow_up_date: str
    status: str = "New"


class CustomerPortalAccessSchema(BaseModel):
    contact_id: str


@router.get("/leads", deprecated=True, summary="[Legacy] LeadTracking list endpoint")
def get_leads(
    response: Response,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    response.headers["X-Legacy-CRM-Path"] = LEGACY_LEADTRACKING_WARNING
    return db.query(models.LeadTracking).filter(
        models.LeadTracking.tenant_id == tenant.id
    ).all()


@router.post("/leads", deprecated=True, summary="[Legacy] LeadTracking create endpoint")
def create_lead(
    data: LeadCreateSchema,
    response: Response,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    response.headers["X-Legacy-CRM-Path"] = LEGACY_LEADTRACKING_WARNING
    new_lead = models.LeadTracking(
        id=f"lead-{uuid.uuid4().hex[:8]}",
        tenant_id=tenant.id,
        **data.model_dump(),
    )
    db.add(new_lead)
    db.commit()
    trigger_communication(tenant.id, "NEW_LEAD", f"Lead {data.customer_name} generated.")
    return new_lead


@router.put("/leads/{lead_id}", deprecated=True, summary="[Legacy] LeadTracking update endpoint")
def update_lead(
    lead_id: str,
    data: LeadCreateSchema,
    response: Response,
    db: Session = Depends(get_db),
    tenant: models.Tenant = Depends(get_current_tenant),
):
    response.headers["X-Legacy-CRM-Path"] = LEGACY_LEADTRACKING_WARNING
    lead = db.query(models.LeadTracking).filter(
        models.LeadTracking.id == lead_id,
        models.LeadTracking.tenant_id == tenant.id,
    ).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    for key, value in data.model_dump().items():
        setattr(lead, key, value)
    db.commit()
    return lead


@router.post("/customers/portal-access")
def create_customer_portal_access(
    data: CustomerPortalAccessSchema,
    tenant: models.Tenant = Depends(get_current_tenant),
):
    supabase_url, service_role_key = _get_supabase_project_settings()

    with httpx.Client(timeout=20.0) as client:
        contact = _fetch_customer_contact(
            client=client,
            supabase_url=supabase_url,
            service_role_key=service_role_key,
            tenant_id=tenant.id,
            contact_id=data.contact_id,
        )

        existing_auth_id = str(contact.get("auth_id") or "").strip()
        created_auth_id: str | None = None

        try:
            auth_id = existing_auth_id or _create_portal_auth_user(
                client=client,
                supabase_url=supabase_url,
                service_role_key=service_role_key,
                tenant_id=tenant.id,
                contact=contact,
            )

            if not existing_auth_id:
                created_auth_id = auth_id

            linked_contact = _link_contact_to_auth_user(
                client=client,
                supabase_url=supabase_url,
                service_role_key=service_role_key,
                tenant_id=tenant.id,
                contact_id=data.contact_id,
                auth_id=auth_id,
            )
        except HTTPException:
            if created_auth_id:
                client.delete(
                    f"{supabase_url}/auth/v1/admin/users/{created_auth_id}",
                    headers=_supabase_headers(service_role_key),
                )
            raise

    return {
        "success": True,
        "created": not bool(existing_auth_id),
        "tenant_id": tenant.id,
        "contact_id": linked_contact["id"],
        "auth_id": linked_contact["auth_id"],
        "email": contact["email"],
        "portal_enabled": linked_contact.get("portal_enabled", True),
    }
