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


async def ensure_runtime_migrations():
    """
    Safely executes ALTER TABLE ADD COLUMN statements for nurse_bookings and invoices
    if columns do not already exist, ensuring compatibility across SQLite and PostgreSQL.
    """
    from sqlalchemy import inspect, text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        def sync_check(connection):
            inspector = inspect(connection)
            tables = inspector.get_table_names()

            # 1. nurse_bookings table columns
            if "nurse_bookings" in tables:
                existing_nb_cols = {c["name"] for c in inspector.get_columns("nurse_bookings")}
                nb_cols_to_add = [
                    ("contracted_hours", "NUMERIC(5, 2) DEFAULT 4.0"),
                    ("hourly_rate_bdt", "NUMERIC(12, 2) DEFAULT 300.0"),
                    ("payment_status", "VARCHAR(50) DEFAULT 'Due'"),
                    ("duty_status", "VARCHAR(50) DEFAULT 'Awaiting Payment'"),
                    ("duty_started_at", "DATETIME"),
                    ("duty_ended_at", "DATETIME"),
                    ("actual_worked_minutes", "INTEGER DEFAULT 0"),
                    ("overtime_hours", "NUMERIC(5, 2) DEFAULT 0.0"),
                    ("overtime_due_bdt", "NUMERIC(12, 2) DEFAULT 0.0"),
                    ("patient_address", "VARCHAR(255) DEFAULT ''"),
                    ("care_notes", "TEXT"),
                    ("shift_time", "VARCHAR(100) DEFAULT 'Day Shift'"),
                    ("overtime_invoice_id", "UUID"),
                    ("fee_bdt", "NUMERIC(12, 2) DEFAULT 0.0"),
                    ("invoice_id", "UUID"),
                ]
                for col_name, col_def in nb_cols_to_add:
                    if col_name not in existing_nb_cols:
                        try:
                            connection.execute(text(f"ALTER TABLE nurse_bookings ADD COLUMN {col_name} {col_def}"))
                        except Exception as e:
                            print(f"[DB Startup Migration] Note adding nurse_bookings.{col_name}: {e}")

            # 2. invoices table columns
            if "invoices" in tables:
                existing_inv_cols = {c["name"] for c in inspector.get_columns("invoices")}
                inv_cols_to_add = [
                    ("nurse_booking_id", "UUID"),
                    ("bill_type", "VARCHAR(50) DEFAULT 'Doctor Visit'"),
                    ("due_amount_bdt", "NUMERIC(12, 2) DEFAULT 0.0"),
                    ("paid_amount_bdt", "NUMERIC(12, 2) DEFAULT 0.0"),
                    ("amount_bdt", "NUMERIC(12, 2) DEFAULT 0.0"),
                    ("payment_status", "VARCHAR(20) DEFAULT 'Due'"),
                    ("confirmed_by_receptionist_id", "UUID"),
                    ("paid_at", "DATETIME"),
                ]
                for col_name, col_def in inv_cols_to_add:
                    if col_name not in existing_inv_cols:
                        try:
                            connection.execute(text(f"ALTER TABLE invoices ADD COLUMN {col_name} {col_def}"))
                        except Exception as e:
                            print(f"[DB Startup Migration] Note adding invoices.{col_name}: {e}")

            # 3. website_settings table dynamic color theme tokens
            if "website_settings" in tables:
                existing_ws_cols = {c["name"] for c in inspector.get_columns("website_settings")}
                ws_cols_to_add = [
                    ("theme_preset", "VARCHAR(50) DEFAULT 'signature-green'"),
                    ("primary_color", "VARCHAR(20) DEFAULT '#059669'"),
                    ("button_color", "VARCHAR(20) DEFAULT '#047857'"),
                    ("tint_color", "VARCHAR(20) DEFAULT '#ECFDF5'"),
                    ("background_color", "VARCHAR(20) DEFAULT '#FFFFFF'"),
                    ("text_color", "VARCHAR(20) DEFAULT '#0F172A'"),
                ]
                for col_name, col_def in ws_cols_to_add:
                    if col_name not in existing_ws_cols:
                        try:
                            connection.execute(text(f"ALTER TABLE website_settings ADD COLUMN {col_name} {col_def}"))
                        except Exception as e:
                            print(f"[DB Startup Migration] Note adding website_settings.{col_name}: {e}")

            # 4. audit_logs table actor columns
            if "audit_logs" in tables:
                existing_al_cols = {c["name"] for c in inspector.get_columns("audit_logs")}
                al_cols_to_add = [
                    ("actor_name", "VARCHAR(255)"),
                    ("actor_email", "VARCHAR(255)"),
                    ("actor_role", "VARCHAR(50)"),
                    ("action_title", "VARCHAR(255)"),
                    ("details", "TEXT"),
                ]
                for col_name, col_def in al_cols_to_add:
                    if col_name not in existing_al_cols:
                        try:
                            connection.execute(text(f"ALTER TABLE audit_logs ADD COLUMN {col_name} {col_def}"))
                        except Exception as e:
                            print(f"[DB Startup Migration] Note adding audit_logs.{col_name}: {e}")

            # 5. nurse_profiles rating columns
            if "nurse_profiles" in tables:
                existing_np_cols = {c["name"] for c in inspector.get_columns("nurse_profiles")}
                np_cols_to_add = [
                    ("average_rating", "NUMERIC(3, 1) DEFAULT 0.0"),
                    ("total_reviews", "INTEGER DEFAULT 0"),
                ]
                for col_name, col_def in np_cols_to_add:
                    if col_name not in existing_np_cols:
                        try:
                            connection.execute(text(f"ALTER TABLE nurse_profiles ADD COLUMN {col_name} {col_def}"))
                        except Exception as e:
                            print(f"[DB Startup Migration] Note adding nurse_profiles.{col_name}: {e}")

        await conn.run_sync(sync_check)


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

    # Ensure runtime column migrations are applied
    try:
        await ensure_runtime_migrations()
    except Exception as e:
        print(f"Startup migration check note: {e}")

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
