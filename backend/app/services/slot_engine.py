"""Smart Doctor Slot Generation Engine."""
import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.doctor import DoctorProfile, DoctorSchedule, DoctorLeave, LeaveStatus
from app.models.appointment import Appointment, AppointmentStatus
from app.schemas.doctor import TimeSlot, AvailableSlotsResponse


async def generate_doctor_slots(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    doctor_id: uuid.UUID,
    target_date: date
) -> AvailableSlotsResponse:
    """
    Computes precise booking slots for a doctor on target_date:
    1. Checks if the doctor is on approved leave.
    2. Retrieves working shift template and intra-shift breaks for target day of week.
    3. Fetches existing booked appointments for the day.
    4. Slices available working hours into discrete intervals.
    """
    # 1. Check for Doctor Leave
    leave_stmt = select(DoctorLeave).where(
        and_(
            DoctorLeave.clinic_id == clinic_id,
            DoctorLeave.doctor_id == doctor_id,
            DoctorLeave.status == LeaveStatus.APPROVED,
            DoctorLeave.start_date <= target_date,
            DoctorLeave.end_date >= target_date
        )
    )
    leave_res = await db.execute(leave_stmt)
    leave = leave_res.scalar_one_or_none()
    if leave:
        return AvailableSlotsResponse(
            doctor_id=doctor_id,
            date=target_date,
            slot_duration_minutes=0,
            slots=[]
        )

    # 2. Check Doctor Schedule for this Day of Week (0=Monday, 6=Sunday)
    day_of_week = target_date.weekday()
    schedule_stmt = (
        select(DoctorSchedule)
        .where(
            and_(
                DoctorSchedule.clinic_id == clinic_id,
                DoctorSchedule.doctor_id == doctor_id,
                DoctorSchedule.day_of_week == day_of_week,
                DoctorSchedule.is_active == True
            )
        )
        .options(selectinload(DoctorSchedule.breaks))
    )
    sched_res = await db.execute(schedule_stmt)
    schedule = sched_res.scalar_one_or_none()

    if not schedule:
        return AvailableSlotsResponse(
            doctor_id=doctor_id,
            date=target_date,
            slot_duration_minutes=0,
            slots=[]
        )

    # 3. Retrieve Existing Booked Appointments for this Doctor on target_date
    start_of_day = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
    end_of_day = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)

    appt_stmt = select(Appointment).where(
        and_(
            Appointment.clinic_id == clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.start_time >= start_of_day,
            Appointment.start_time <= end_of_day,
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW])
        )
    )
    appt_res = await db.execute(appt_stmt)
    existing_appts = appt_res.scalars().all()

    # 4. Generate Slots
    slot_duration = timedelta(minutes=schedule.slot_duration_minutes)
    buffer_time = timedelta(minutes=schedule.buffer_time_minutes)
    step = slot_duration + buffer_time

    current_slot_start = datetime.combine(target_date, schedule.shift_start_time).replace(tzinfo=timezone.utc)
    shift_end = datetime.combine(target_date, schedule.shift_end_time).replace(tzinfo=timezone.utc)

    calculated_slots: List[TimeSlot] = []

    while current_slot_start + slot_duration <= shift_end:
        current_slot_end = current_slot_start + slot_duration
        is_available = True
        reason = None

        # Check intra-shift breaks
        slot_start_time_val = current_slot_start.time()
        slot_end_time_val = current_slot_end.time()
        for b in schedule.breaks:
            if not (slot_end_time_val <= b.start_time or slot_start_time_val >= b.end_time):
                is_available = False
                reason = f"BREAK ({b.break_name})"
                break

        # Check existing appointment collisions
        if is_available:
            for appt in existing_appts:
                # Overlap check
                appt_start = appt.start_time if appt.start_time.tzinfo else appt.start_time.replace(tzinfo=timezone.utc)
                appt_end = appt.end_time if appt.end_time.tzinfo else appt.end_time.replace(tzinfo=timezone.utc)
                if not (current_slot_end <= appt_start or current_slot_start >= appt_end):
                    is_available = False
                    reason = "BOOKED"
                    break

        calculated_slots.append(
            TimeSlot(
                start_time=current_slot_start,
                end_time=current_slot_end,
                is_available=is_available,
                reason=reason
            )
        )
        current_slot_start += step

    return AvailableSlotsResponse(
        doctor_id=doctor_id,
        date=target_date,
        slot_duration_minutes=schedule.slot_duration_minutes,
        slots=calculated_slots
    )
