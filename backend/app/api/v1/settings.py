"""Hospital Website Settings, Logo Upload, and Public CMS API Endpoints."""
import uuid
import base64
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user, get_current_tenant, require_roles, TenantContext, log_audit_event
from app.models.settings import WebsiteSettings
from app.models.tenant import Clinic
from app.models.user import ClinicRole, SystemRole, User, AuditAction
from app.schemas.settings import (
    WebsiteSettingsUpdate, WebsiteSettingsResponse, LogoUploadResponse
)

router = APIRouter(prefix="/settings", tags=["Website Settings & CMS"])


async def get_or_create_settings(db: AsyncSession, clinic_id: Optional[uuid.UUID] = None) -> WebsiteSettings:
    """Helper to retrieve or initialize default website settings."""
    stmt = select(WebsiteSettings)
    if clinic_id:
        stmt = stmt.where(WebsiteSettings.clinic_id == clinic_id)
    else:
        stmt = stmt.limit(1)

    res = await db.execute(stmt)
    settings_obj = res.scalar_one_or_none()

    if not settings_obj:
        # Check if any clinic exists
        clinic_res = await db.execute(select(Clinic).limit(1))
        first_clinic = clinic_res.scalar_one_or_none()

        settings_obj = WebsiteSettings(
            clinic_id=first_clinic.id if first_clinic else None,
            hospital_name=first_clinic.name if first_clinic else "Metro Health Polyclinic & Hospital",
            tagline="Excellence in Compassionate Care & Advanced Medicine",
            emergency_hotline="+880 1711-001122",
            contact_email=first_clinic.email if first_clinic else "care@metrohealth.com",
            address=f"{first_clinic.address_line1}, {first_clinic.city}" if first_clinic else "100 Medical Plaza, Suite 400, Dhaka",
            hero_title="World-Class Healthcare, Close to You",
            hero_subtitle="Experience seamless medical appointments, digital prescriptions, and expert diagnostics from top certified specialists.",
            logo_url=None,
            theme_preset="signature-green",
            primary_color="#059669",
            button_color="#047857",
            tint_color="#ECFDF5",
            background_color="#FFFFFF",
            text_color="#0F172A",
        )
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)

    # Safe fallback if fields are missing or null on existing db rows
    if not getattr(settings_obj, "primary_color", None):
        settings_obj.primary_color = "#059669"
    if not getattr(settings_obj, "button_color", None):
        settings_obj.button_color = "#047857"
    if not getattr(settings_obj, "tint_color", None):
        settings_obj.tint_color = "#ECFDF5"
    if not getattr(settings_obj, "background_color", None):
        settings_obj.background_color = "#FFFFFF"
    if not getattr(settings_obj, "text_color", None):
        settings_obj.text_color = "#0F172A"
    if not getattr(settings_obj, "theme_preset", None):
        settings_obj.theme_preset = "signature-green"

    return settings_obj


@router.get("/public", response_model=WebsiteSettingsResponse)
async def get_public_website_settings(db: AsyncSession = Depends(get_db)):
    """
    Public Endpoint:
    Returns the hospital name, logo URL, emergency hotline, and hero text.
    No authentication required — consumed by Landing Page, Navbar, and Login Screen.
    """
    return await get_or_create_settings(db)


@router.get("/website", response_model=WebsiteSettingsResponse)
async def get_admin_website_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves CMS and hospital settings for administrators."""
    return await get_or_create_settings(db)


@router.put("/website", response_model=WebsiteSettingsResponse)
async def update_website_settings(
    request: WebsiteSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates Hospital branding, emergency hotline, contact info, and hero banner.
    Restricted to Super Admin or Clinic Admins.
    """
    # Enforce role check
    is_admin = current_user.system_role == SystemRole.SUPER_ADMIN or any(
        m.role == ClinicRole.CLINIC_ADMIN for m in current_user.clinic_memberships if m.is_active
    )
    if not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied. Admin role required.")

    settings_obj = await get_or_create_settings(db)
    update_data = request.model_dump(exclude_unset=True)

    for field, val in update_data.items():
        if val is not None:
            setattr(settings_obj, field, val)

    # Sync with clinic table if hospital_name, logo_url, or primary_color changed
    if settings_obj.clinic_id:
        c_stmt = select(Clinic).where(Clinic.id == settings_obj.clinic_id)
        c_res = await db.execute(c_stmt)
        clinic = c_res.scalar_one_or_none()
        if clinic:
            if request.hospital_name:
                clinic.name = request.hospital_name
            if request.logo_url:
                clinic.logo_url = request.logo_url
            if request.primary_color and isinstance(clinic.letterhead_template, dict):
                tmpl = dict(clinic.letterhead_template)
                tmpl["primary_color"] = request.primary_color
                clinic.letterhead_template = tmpl

    await db.commit()
    await db.refresh(settings_obj)

    # HIPAA / Admin Audit Trail Logging
    try:
        await log_audit_event(
            db=db,
            action=AuditAction.UPDATE,
            action_title="Updated Clinic Theme & Profile",
            resource_type="Clinic Profile & Settings",
            resource_id=str(settings_obj.id),
            clinic_id=settings_obj.clinic_id,
            user=current_user,
            details=f"Updated hospital: '{settings_obj.hospital_name}', theme preset: '{settings_obj.theme_preset}', primary: '{settings_obj.primary_color}', logo: {'updated' if request.logo_url else 'unchanged'}",
        )
    except Exception as e:
        print(f"[Audit Log Warning] {e}")

    return settings_obj


@router.post("/upload-logo", response_model=LogoUploadResponse)
async def upload_hospital_logo(
    file: Optional[UploadFile] = File(None),
    logo_data_url: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads or saves hospital logo:
    Supports direct multipart image upload (converts to data URI) or direct base64 data URL.
    Updates the website settings and clinic profile logo URL.
    """
    is_admin = current_user.system_role == SystemRole.SUPER_ADMIN or any(
        m.role == ClinicRole.CLINIC_ADMIN for m in current_user.clinic_memberships if m.is_active
    )
    if not is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied. Admin role required.")

    resolved_logo_url = logo_data_url

    if file:
        content = await file.read()
        mime = file.content_type or "image/png"
        b64 = base64.b64encode(content).decode("utf-8")
        resolved_logo_url = f"data:{mime};base64,{b64}"

    if not resolved_logo_url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No logo file or data provided")

    settings_obj = await get_or_create_settings(db)
    settings_obj.logo_url = resolved_logo_url

    # Also update clinic table if associated
    if settings_obj.clinic_id:
        c_stmt = select(Clinic).where(Clinic.id == settings_obj.clinic_id)
        c_res = await db.execute(c_stmt)
        clinic = c_res.scalar_one_or_none()
        if clinic:
            clinic.logo_url = resolved_logo_url

    await db.commit()

    # HIPAA / Admin Audit Trail Logging
    try:
        await log_audit_event(
            db=db,
            action=AuditAction.UPDATE,
            action_title="Uploaded Clinic Logo",
            resource_type="Clinic Profile & Settings",
            resource_id="logo",
            clinic_id=settings_obj.clinic_id,
            user=current_user,
            details=f"Uploaded new clinic logo emblem for '{settings_obj.hospital_name}'",
        )
    except Exception as e:
        print(f"[Audit Log Warning] {e}")

    return LogoUploadResponse(logo_url=resolved_logo_url)
