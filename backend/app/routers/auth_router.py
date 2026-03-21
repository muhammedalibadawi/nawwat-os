"""Login and JWT issuance."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.auth import create_access_token

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class LoginRequest(BaseModel):
    tenant_id: str
    role: str  # MASTER_ADMIN, SUPER_ADMIN, ACCOUNTANT, CASHIER, etc.


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    tenant_id: str


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    # Demo: accept any tenant_id/role and issue JWT. In production validate against DB.
    token = create_access_token(
        data={"sub": data.tenant_id, "tenant_id": data.tenant_id, "role": data.role}
    )
    return TokenResponse(
        access_token=token,
        role=data.role,
        tenant_id=data.tenant_id,
    )
