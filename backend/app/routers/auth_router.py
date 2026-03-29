"""Authentication endpoints are handled by the real identity provider."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
