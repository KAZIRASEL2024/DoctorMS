"""Aggregates all API v1 domain routers."""
from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.clinics import router as clinics_router
from app.api.v1.patients import router as patients_router
from app.api.v1.doctors import router as doctors_router, admin_leaves_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.queue import router as queue_router
from app.api.v1.emr import router as emr_router
from app.api.v1.prescriptions import router as prescriptions_router
from app.api.v1.billing import router as billing_router, invoices_router, reception_router
from app.api.v1.analytics import router as analytics_router, admin_analytics_router
from app.api.v1.settings import router as settings_router, get_public_website_settings
from app.schemas.settings import WebsiteSettingsResponse
from app.api.v1.units import router as units_router
from app.api.v1.users import router as admin_users_router, admin_patients_credentials_router
from app.api.v1.nurses import router as nurses_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(clinics_router)
api_v1_router.include_router(patients_router)
api_v1_router.include_router(doctors_router)
api_v1_router.include_router(appointments_router)
api_v1_router.include_router(queue_router)
api_v1_router.include_router(emr_router)
api_v1_router.include_router(prescriptions_router)
api_v1_router.include_router(billing_router)
api_v1_router.include_router(invoices_router)
api_v1_router.include_router(reception_router)
api_v1_router.include_router(analytics_router)
api_v1_router.include_router(admin_analytics_router)
api_v1_router.include_router(settings_router)
api_v1_router.add_api_route("/cms", get_public_website_settings, methods=["GET"], response_model=WebsiteSettingsResponse, tags=["Website Settings & CMS"])
api_v1_router.include_router(units_router)
api_v1_router.include_router(admin_leaves_router)
api_v1_router.include_router(admin_users_router)
api_v1_router.include_router(admin_patients_credentials_router)
api_v1_router.include_router(nurses_router)
