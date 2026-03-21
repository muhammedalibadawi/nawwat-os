"""Central configuration from environment variables."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from env / .env."""

    database_url: str = "sqlite:///./nawwat.db"
    env: str = "development"  # development | production
    allowed_origins: str = "*"  # comma-separated in production, e.g. https://app.example.com
    secret_key: str = "change-me-in-production"
    master_admin_bypass_enabled: bool = True  # set False in production

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
