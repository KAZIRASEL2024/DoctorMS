"""Live waiting room queue management service."""
import uuid
from datetime import date, datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.models.appointment import Appointment, QueueToken, AppointmentStatus, QueueStatus


async def issue_queue_token(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    appointment_id: uuid.UUID
) -> QueueToken:
    """
    Issues a sequential queue token when a patient checks in at the reception.
    Updates appointment status to CHECKED_IN.
    """
    appt_stmt = select(Appointment).where(
        Appointment.id == appointment_id,
        Appointment.clinic_id == clinic_id
    )
    appt_res = await db.execute(appt_stmt)
    appointment = appt_res.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    # Check if token already issued
    token_stmt = select(QueueToken).where(QueueToken.appointment_id == appointment_id)
    token_res = await db.execute(token_stmt)
    existing_token = token_res.scalar_one_or_none()
    if existing_token:
        return existing_token

    today = date.today()

    # Calculate next sequential token for this doctor today
    max_token_stmt = select(func.coalesce(func.max(QueueToken.token_number), 0)).where(
        and_(
            QueueToken.clinic_id == clinic_id,
            QueueToken.queue_date == today,
            QueueToken.doctor_id == appointment.doctor_id
        )
    )
    max_token_res = await db.execute(max_token_stmt)
    next_number = (max_token_res.scalar() or 0) + 1

    token_code = f"Q-{next_number:02d}"

    token = QueueToken(
        clinic_id=clinic_id,
        appointment_id=appointment.id,
        doctor_id=appointment.doctor_id,
        queue_date=today,
        token_number=next_number,
        token_code=token_code,
        status=QueueStatus.WAITING,
        check_in_time=datetime.now(timezone.utc)
    )
    appointment.status = AppointmentStatus.CHECKED_IN

    db.add(token)
    await db.commit()
    await db.refresh(token)
    return token
