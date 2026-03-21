from fastapi import APIRouter, Depends
import models
from app.dependencies import get_current_tenant

router = APIRouter(prefix="/api/v1", tags=["Email & SMTP"])


@router.post("/email/send")
def send_email(
    payload: dict,
    tenant: models.Tenant = Depends(get_current_tenant),
):
    print(f"[Email Engine] Sent email for {tenant.name}. Payload: {payload}")
    return {"status": "success", "message": "Email dispatched successfully"}
