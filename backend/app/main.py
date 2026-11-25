"""Main FastAPI Application Entrypoint."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.api.v1.router import api_v1_router
from app.db.session import engine, AsyncSessionLocal
from app.models.base import Base
from app.db.seed import seed_demo_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initializes database schema, seeds demo records, and handles graceful shutdown."""
    # Create tables automatically in development / SQLite mode if needed
    if "sqlite" in settings.async_database_url:
        from sqlalchemy.dialects.postgresql import ExcludeConstraint
        from app.models.appointment import Appointment
        Appointment.__table__.constraints = {
            c for c in Appointment.__table__.constraints
            if not isinstance(c, ExcludeConstraint)
        }
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Seed initial demo clinic & users
    async with AsyncSessionLocal() as session:
        try:
            await seed_demo_data(session)
        except Exception as e:
            print(f"Seed note: {e}")

    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Multi-Tenant SaaS Doctor & Clinic Management System Backend API",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# CORS Middleware - allows access from any LAN / external IP
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    """
    Catches PostgreSQL exclusion constraint or unique index violations
    and maps them to clean HTTP 409 Conflict responses.
    """
    error_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
    if "prevent_doctor_appointment_overlap" in error_msg:
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": "Double-booking prevented: Doctor already has an active appointment in this time range."
            }
        )
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": "Database integrity constraint violation.", "technical": error_msg}
    )


@app.get("/health", tags=["System"])
async def health_check():
    """Service health monitoring endpoint."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    }


# Mount API v1 Routes
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

# Mount /uploads for static assets (doctor/patient avatars, signature images)
import os
from fastapi.staticfiles import StaticFiles

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOAD_DIR = os.path.join(BACKEND_ROOT, "uploads")
os.makedirs(os.path.join(UPLOAD_DIR, "avatars"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
