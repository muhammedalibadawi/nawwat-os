"""JWT creation and validation."""
import datetime
from typing import Any

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

http_bearer = HTTPBearer(auto_error=False)

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days


def create_access_token(data: dict[str, Any], expires_delta: datetime.timedelta | None = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + (expires_delta or datetime.timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Security(http_bearer),
) -> dict[str, Any] | None:
    if not credentials:
        return None
    return decode_token(credentials.credentials)


async def get_current_user_required(
    credentials: HTTPAuthorizationCredentials | None = Security(http_bearer),
) -> dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return decode_token(credentials.credentials)


async def require_master_admin(
    user: dict[str, Any] | None = Security(get_current_user_optional),
) -> dict[str, Any]:
    settings = get_settings()
    if user and user.get("role") == "MASTER_ADMIN":
        return user
    if settings.master_admin_bypass_enabled:
        return {"role": "MASTER_ADMIN", "tenant_id": "T-ACME", "sub": "bypass"}
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Master admin access required")
