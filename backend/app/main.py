"""
Zenith ERP (Nawwat OS) - Application entrypoint.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import models
from app.config import get_settings, validate_settings_for_startup
from app.routers import accounting, admin, ai, analytics, branches, communication, crm, email
from app.routers import health, hr, logistics, production, products, real_estate, reports, sync, tenant
from app.seed import seed_db
from database import engine

models.Base.metadata.create_all(bind=engine)


def create_app() -> FastAPI:
    settings = get_settings()
    validate_settings_for_startup(settings)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        seed_db()
        yield

    app = FastAPI(
        title="Nawwat OS API (Multi-Tenant SaaS)",
        description="Multi-Tenant Business Operating System (Retail, Real Estate, Manufacturing)",
        version="3.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(sync.router)
    app.include_router(tenant.router)
    app.include_router(products.router)
    app.include_router(production.router)
    app.include_router(real_estate.router)
    app.include_router(hr.router)
    app.include_router(accounting.router)
    app.include_router(analytics.router)
    app.include_router(communication.router)
    app.include_router(admin.router)
    app.include_router(logistics.router)
    app.include_router(crm.router)
    app.include_router(ai.router)
    app.include_router(reports.router)
    app.include_router(branches.router)
    app.include_router(email.router)
    return app


app = create_app()
