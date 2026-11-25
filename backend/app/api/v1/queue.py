"""Live Waiting Room Queue Management API Endpoints."""
import uuid
from typing import List
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_tenant, require_roles, TenantContext
from app.models.appointment import QueueToken, Appointment, QueueStatus, AppointmentStatus
from app.models.patient import Patient
from app.models.doctor import DoctorProfile
from app.models.user import ClinicRole, ClinicStaff
from app.schemas.appointment import LiveQueueItem, QueueTokenResponse

router = APIRouter(prefix="/queue", tags=["Live Queue Engine"])


@router.get("/live", response_model=List[LiveQueueItem])
async def get_live_queue(
    doctor_id: uuid.UUID = Query(None, description="Filter live queue by specific doctor"),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Live Queue Display:
    Returns the today's active waiting room queue for receptionists, TV monitors, and doctors.
    """
    today = date.today()
    stmt = (
        select(QueueToken)
        .where(
            and_(
                QueueToken.clinic_id == tenant.clinic_id,
                QueueToken.queue_date == today,
                QueueToken.status.notin_([QueueStatus.COMPLETED, QueueStatus.SKIPPED])
            )
        )
        .options(
            selectinload(QueueToken.appointment).selectinload(Appointment.patient).selectinload(Patient.user),
            selectinload(QueueToken.appointment).selectinload(Appointment.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user)
        )
        .order_by(QueueToken.token_number.asc())
    )
    if doctor_id:
        stmt = stmt.where(QueueToken.doctor_id == doctor_id)

    res = await db.execute(stmt)
    tokens = res.scalars().all()

    now = datetime.now(timezone.utc)
    queue_items = []
    for t in tokens:
        patient_name = "Patient"
        doctor_name = "Doctor"
        if t.appointment and t.appointment.patient:
            p = t.appointment.patient
            full = f"{p.first_name or ''} {p.last_name or ''}".strip()
            if not full and getattr(p, "user", None):
                u = p.user
                full = f"{u.first_name or ''} {u.last_name or ''}".strip()
            patient_name = full or "Patient"
        if t.appointment and t.appointment.doctor and t.appointment.doctor.staff and t.appointment.doctor.staff.user:
            u = t.appointment.doctor.staff.user
            full = f"{u.first_name} {u.last_name}".strip()
            doctor_name = full if full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {full}"

        checkin = t.check_in_time if t.check_in_time.tzinfo else t.check_in_time.replace(tzinfo=timezone.utc)
        wait_minutes = max(0, int((now - checkin).total_seconds() / 60))

        queue_items.append(
            LiveQueueItem(
                token_id=t.id,
                token_code=t.token_code,
                token_number=t.token_number,
                appointment_id=t.appointment_id,
                patient_name=patient_name,
                doctor_name=doctor_name,
                status=t.status,
                wait_time_minutes=wait_minutes,
                check_in_time=t.check_in_time
            )
        )

    return queue_items


@router.post("/{token_id}/call", response_model=QueueTokenResponse)
async def call_patient(
    token_id: uuid.UUID,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST, ClinicRole.DOCTOR])),
    db: AsyncSession = Depends(get_db)
):
    """Marks a patient as CALLED on the reception board/speaker."""
    stmt = select(QueueToken).where(QueueToken.id == token_id, QueueToken.clinic_id == tenant.clinic_id)
    res = await db.execute(stmt)
    token = res.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue token not found")

    token.status = QueueStatus.CALLED
    token.called_time = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(token)
    return token


@router.post("/{token_id}/start-consultation", response_model=QueueTokenResponse)
async def start_consultation(
    token_id: uuid.UUID,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Marks patient as WITH_DOCTOR and updates appointment status to IN_CONSULTATION."""
    stmt = (
        select(QueueToken)
        .where(QueueToken.id == token_id, QueueToken.clinic_id == tenant.clinic_id)
        .options(selectinload(QueueToken.appointment))
    )
    res = await db.execute(stmt)
    token = res.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue token not found")

    token.status = QueueStatus.WITH_DOCTOR
    token.consultation_start_time = datetime.now(timezone.utc)
    if token.appointment:
        token.appointment.status = AppointmentStatus.IN_CONSULTATION

    await db.commit()
    await db.refresh(token)
    return token


@router.post("/{token_id}/complete", response_model=QueueTokenResponse)
async def complete_consultation(
    token_id: uuid.UUID,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Marks consultation as COMPLETED and removes patient from live queue."""
    stmt = (
        select(QueueToken)
        .where(QueueToken.id == token_id, QueueToken.clinic_id == tenant.clinic_id)
        .options(selectinload(QueueToken.appointment))
    )
    res = await db.execute(stmt)
    token = res.scalar_one_or_none()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Queue token not found")

    token.status = QueueStatus.COMPLETED
    token.consultation_end_time = datetime.now(timezone.utc)
    if token.appointment:
        token.appointment.status = AppointmentStatus.COMPLETED

    await db.commit()
    await db.refresh(token)
    return token
