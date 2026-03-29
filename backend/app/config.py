"""Central configuration from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_ALLOWED_ORIGINS = ",".join(
    [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
)


class Settings(BaseSettings):
    """Application settings loaded from env / .env."""

    database_url: str = "sqlite:///./nawwat.db"
    env: str = "development"  # development | production
    allowed_origins: str = DEFAULT_ALLOWED_ORIGINS
    secret_key: str
    master_admin_bypass_enabled: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


def validate_settings_for_startup(settings: Settings) -> None:
    """Fail fast when the runtime configuration is unsafe."""
    if not settings.secret_key.strip():
        raise RuntimeError("SECRET_KEY must be set to a non-empty value.")

    origins = settings.cors_origins
    if "*" in origins:
        raise RuntimeError("Wildcard CORS origins are not allowed when credentials are enabled.")

    if settings.env.lower() == "production":
        if settings.master_admin_bypass_enabled:
            raise RuntimeError("MASTER_ADMIN_BYPASS_ENABLED must be false in production.")
        if not origins:
            raise RuntimeError("ALLOWED_ORIGINS must include at least one explicit origin in production.")


@lru_cache
def get_settings() -> Settings:
    return Settings()
