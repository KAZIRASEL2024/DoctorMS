"""Doctor Availability, Schedules, Leaves, and Slot Generation API Endpoints."""
import os
import time
import json
import base64
import uuid
from typing import List, Optional
from datetime import date, time as dt_time, datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request, status
from sqlalchemy import select, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_tenant, get_current_user, require_roles, TenantContext
from app.models.doctor import DoctorProfile, DoctorSchedule, DoctorBreak, DoctorLeave, LeaveStatus
from app.models.user import User, ClinicStaff, ClinicRole, SystemRole
from app.schemas.doctor import (
    DoctorProfileCreate, DoctorProfileUpdate, DoctorProfileResponse, DoctorScheduleCreate,
    DoctorScheduleResponse, DoctorLeaveCreate, DoctorLeaveResponse, AvailableSlotsResponse,
    DayScheduleItem, DoctorScheduleUpdateRequest, DoctorScheduleOverviewResponse, LeaveStatusUpdate
)
from app.services.slot_engine import generate_doctor_slots

router = APIRouter(prefix="/doctors", tags=["Doctors & Schedules"])
admin_leaves_router = APIRouter(prefix="/admin/leaves", tags=["Admin Leave Approvals"])

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


async def get_doctor_for_user(current_user: User, db: AsyncSession) -> DoctorProfile:
    """Helper to resolve the DoctorProfile associated with the authenticated user."""
    doc_stmt = (
        select(DoctorProfile)
        .where(
            (DoctorProfile.user_id == current_user.id) |
            (DoctorProfile.staff_id.in_(select(ClinicStaff.id).where(ClinicStaff.user_id == current_user.id)))
        )
        .options(
            selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user),
            selectinload(DoctorProfile.schedules).selectinload(DoctorSchedule.breaks)
        )
    )
    doc_res = await db.execute(doc_stmt)
    doc = doc_res.scalar_one_or_none()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doctor profile not found for the logged-in user"
        )
    return doc


@router.post("/me/avatar")
async def upload_my_doctor_avatar(
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Uploads, optimizes, and stores a doctor's profile picture as /uploads/avatars/..."""
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    upload_dir = os.path.join(backend_root, "uploads", "avatars")
    os.makedirs(upload_dir, exist_ok=True)

    filename = None
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1].lower() or ".png"
        filename = f"doc_{current_user.id}_{int(time.time())}{ext}"
        filepath = os.path.join(upload_dir, filename)
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
    else:
        content_type = request.headers.get("content-type", "")
        if "multipart" in content_type:
            form = await request.form()
            form_file = form.get("file")
            if form_file and hasattr(form_file, "filename"):
                ext = os.path.splitext(form_file.filename)[1].lower() or ".png"
                filename = f"doc_{current_user.id}_{int(time.time())}{ext}"
                filepath = os.path.join(upload_dir, filename)
                content = await form_file.read()
                with open(filepath, "wb") as f:
                    f.write(content)
        else:
            try:
                body = await request.json()
            except Exception:
                body = {}
            data_url = body.get("avatar_url") or body.get("image") or ""
            if data_url.startswith("data:image/"):
                header, base64_data = data_url.split(",", 1)
                ext = ".jpg" if "jpeg" in header or "jpg" in header else ".png"
                filename = f"doc_{current_user.id}_{int(time.time())}{ext}"
                filepath = os.path.join(upload_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(base64_data))
            elif data_url.startswith("/uploads/"):
                filename = os.path.basename(data_url)

    if not filename:
        raise HTTPException(status_code=400, detail="No image file or valid image data provided")

    relative_url = f"/uploads/avatars/{filename}"

    # Update User.avatar_url
    user = await db.get(User, current_user.id)
    if user:
        user.avatar_url = relative_url

    # Update DoctorProfile.avatar_url
    doc_stmt = select(DoctorProfile).where(
        (DoctorProfile.user_id == current_user.id) |
        (DoctorProfile.staff_id.in_(select(ClinicStaff.id).where(ClinicStaff.user_id == current_user.id)))
    )
    doc_res = await db.execute(doc_stmt)
    doc = doc_res.scalar_one_or_none()
    if doc:
        doc.avatar_url = relative_url

    await db.commit()
    return {"avatar_url": relative_url, "message": "Doctor profile photo uploaded successfully"}


@router.get("/me/schedule", response_model=DoctorScheduleOverviewResponse)
async def get_my_schedule(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves weekly recurring shift template, breaks, and live OT availability status for the logged-in doctor."""
    doc = await get_doctor_for_user(current_user, db)

    weekly_list = []
    slot_dur = 20
    buf_time = 5

    if doc.weekly_schedule:
        try:
            parsed = json.loads(doc.weekly_schedule)
            for item in parsed:
                weekly_list.append(DayScheduleItem(**item))
        except Exception:
            weekly_list = []

    if not weekly_list:
        sched_by_day = {s.day_of_week: s for s in doc.schedules}
        for day in range(7):
            s = sched_by_day.get(day)
            if s:
                slot_dur = s.slot_duration_minutes
                buf_time = s.buffer_time_minutes
                lunch_b = next((b for b in s.breaks if "lunch" in (b.break_name or "").lower()), None)
                weekly_list.append(DayScheduleItem(
                    day=day,
                    name=DAY_NAMES[day],
                    is_active=s.is_active,
                    start_time=s.shift_start_time.strftime("%H:%M") if s.shift_start_time else "08:00",
                    end_time=s.shift_end_time.strftime("%H:%M") if s.shift_end_time else "17:00",
                    lunch_start=lunch_b.start_time.strftime("%H:%M") if lunch_b and lunch_b.start_time else "12:00",
                    lunch_end=lunch_b.end_time.strftime("%H:%M") if lunch_b and lunch_b.end_time else "13:00"
                ))
            else:
                weekly_list.append(DayScheduleItem(
                    day=day,
                    name=DAY_NAMES[day],
                    is_active=(day < 6),
                    start_time="08:00",
                    end_time="17:00" if day < 4 else ("13:00" if day == 4 else "15:00"),
                    lunch_start="12:00",
                    lunch_end="13:00"
                ))

    return DoctorScheduleOverviewResponse(
        doctor_id=doc.id,
        current_status=doc.current_status or "Available",
        available_from_time=doc.available_from_time,
        status_note=doc.status_note,
        slot_duration=slot_dur,
        buffer_time=buf_time,
        weekly_schedule=weekly_list
    )


@router.put("/me/schedule", response_model=DoctorScheduleOverviewResponse)
async def update_my_schedule(
    request: DoctorScheduleUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Allows the logged-in doctor to edit their weekly shift hours, toggle active days, and set live duty/OT status."""
    doc = await get_doctor_for_user(current_user, db)

    if request.current_status is not None:
        doc.current_status = request.current_status
    if request.available_from_time is not None:
        doc.available_from_time = request.available_from_time
    if request.status_note is not None:
        doc.status_note = request.status_note

    slot_dur = request.slot_duration or 20
    buf_time = request.buffer_time or 5

    if request.weekly_schedule is not None:
        # Save JSON on DoctorProfile
        doc.weekly_schedule = json.dumps([item.model_dump() for item in request.weekly_schedule])

        # Delete existing schedule rows to re-sync
        await db.execute(delete(DoctorSchedule).where(DoctorSchedule.doctor_id == doc.id))
        await db.flush()

        active_days = []
        earliest = "08:00"
        latest = "17:00"

        for item in request.weekly_schedule:
            if item.is_active:
                active_days.append(DAY_NAMES[item.day][:3])
                earliest = min(earliest, item.start_time)
                latest = max(latest, item.end_time)

            try:
                sh_h, sh_m = map(int, item.start_time.split(":")[:2])
                eh_h, eh_m = map(int, item.end_time.split(":")[:2])
            except Exception:
                sh_h, sh_m = 8, 0
                eh_h, eh_m = 17, 0

            sched = DoctorSchedule(
                clinic_id=doc.clinic_id,
                doctor_id=doc.id,
                day_of_week=item.day,
                shift_start_time=dt_time(sh_h, sh_m),
                shift_end_time=dt_time(eh_h, eh_m),
                slot_duration_minutes=slot_dur,
                buffer_time_minutes=buf_time,
                is_active=item.is_active
            )
            db.add(sched)
            await db.flush()

            if item.lunch_start and item.lunch_end:
                try:
                    lh_h, lh_m = map(int, item.lunch_start.split(":")[:2])
                    leh_h, leh_m = map(int, item.lunch_end.split(":")[:2])
                    d_break = DoctorBreak(
                        schedule_id=sched.id,
                        break_name="Lunch Break",
                        start_time=dt_time(lh_h, lh_m),
                        end_time=dt_time(leh_h, leh_m)
                    )
                    db.add(d_break)
                except Exception:
                    pass

        if active_days:
            if len(active_days) >= 2:
                doc.visiting_days = f"{active_days[0]} - {active_days[-1]}"
            else:
                doc.visiting_days = active_days[0]
            doc.visiting_hours = f"{earliest} - {latest}"

    await db.commit()
    await db.refresh(doc)

    weekly_list = []
    if doc.weekly_schedule:
        try:
            for item in json.loads(doc.weekly_schedule):
                weekly_list.append(DayScheduleItem(**item))
        except Exception:
            weekly_list = []

    return DoctorScheduleOverviewResponse(
        doctor_id=doc.id,
        current_status=doc.current_status or "Available",
        available_from_time=doc.available_from_time,
        status_note=doc.status_note,
        slot_duration=slot_dur,
        buffer_time=buf_time,
        weekly_schedule=weekly_list
    )


@router.post("/me/leaves", response_model=DoctorLeaveResponse, status_code=status.HTTP_201_CREATED)
async def submit_my_leave_request(
    request: DoctorLeaveCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Doctor submits a time-off / vacation leave request (starts as Pending admin approval)."""
    if request.end_date < request.start_date:
        raise HTTPException(status_code=400, detail="End date must be on or after start date")

    doc = await get_doctor_for_user(current_user, db)

    leave = DoctorLeave(
        clinic_id=doc.clinic_id,
        doctor_id=doc.id,
        start_date=request.start_date,
        end_date=request.end_date,
        reason=request.reason,
        status=LeaveStatus.PENDING
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)

    total_days = (leave.end_date - leave.start_date).days + 1
    doc_name = f"Dr. {doc.staff.user.first_name} {doc.staff.user.last_name}" if doc.staff and doc.staff.user else "Doctor"

    return DoctorLeaveResponse(
        id=leave.id,
        doctor_id=leave.doctor_id,
        doctor_name=doc_name,
        doctor_specialization=doc.specialization,
        doctor_avatar=doc.avatar_url,
        start_date=leave.start_date,
        end_date=leave.end_date,
        reason=leave.reason,
        status="PENDING",
        status_display="Pending Approval",
        total_days=total_days,
        created_at=leave.created_at
    )


@router.get("/me/leaves", response_model=List[DoctorLeaveResponse])
async def list_my_leaves(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Doctor views all their leave requests with clear status badges and date ranges."""
    doc = await get_doctor_for_user(current_user, db)

    leaves_stmt = (
        select(DoctorLeave)
        .where(DoctorLeave.doctor_id == doc.id)
        .order_by(DoctorLeave.start_date.desc(), DoctorLeave.created_at.desc())
    )
    leaves_res = await db.execute(leaves_stmt)
    leaves = leaves_res.scalars().all()

    doc_name = f"Dr. {doc.staff.user.first_name} {doc.staff.user.last_name}" if doc.staff and doc.staff.user else "Doctor"

    results = []
    for l in leaves:
        status_raw = str(l.status.value if hasattr(l.status, "value") else l.status).upper()
        if "APPROV" in status_raw:
            disp = "Leave Confirmed"
            norm_status = "APPROVED"
        elif "REJECT" in status_raw:
            disp = "Rejected"
            norm_status = "REJECTED"
        else:
            disp = "Pending Approval"
            norm_status = "PENDING"

        total_days = (l.end_date - l.start_date).days + 1
        results.append(
            DoctorLeaveResponse(
                id=l.id,
                doctor_id=l.doctor_id,
                doctor_name=doc_name,
                doctor_specialization=doc.specialization,
                doctor_avatar=doc.avatar_url,
                start_date=l.start_date,
                end_date=l.end_date,
                reason=l.reason,
                status=norm_status,
                status_display=disp,
                total_days=total_days,
                created_at=l.created_at
            )
        )
    return results


@router.post("", response_model=DoctorProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor_profile(
    request: DoctorProfileCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Initializes a doctor profile for an existing staff member in the clinic."""
    staff_stmt = select(ClinicStaff).where(
        ClinicStaff.clinic_id == tenant.clinic_id,
        ClinicStaff.user_id == request.user_id,
        ClinicStaff.role == ClinicRole.DOCTOR
    ).options(selectinload(ClinicStaff.user))
    staff_res = await db.execute(staff_stmt)
    staff = staff_res.scalar_one_or_none()

    if not staff:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not registered as a DOCTOR in this clinic's staff directory"
        )

    # Check if profile already exists
    existing_prof = await db.execute(
        select(DoctorProfile).where(
            DoctorProfile.clinic_id == tenant.clinic_id,
            DoctorProfile.user_id == request.user_id
        )
    )
    if existing_prof.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Doctor profile already exists")

    doctor = DoctorProfile(
        clinic_id=tenant.clinic_id,
        user_id=request.user_id,
        staff_id=staff.id,
        specialization=request.specialization,
        license_number=request.license_number,
        qualifications=request.qualifications,
        experience_years=request.experience_years,
        consultation_fee=request.consultation_fee,
        follow_up_fee=request.follow_up_fee,
        follow_up_validity_days=request.follow_up_validity_days,
        bio=request.bio,
        is_available_for_booking=True
    )
    db.add(doctor)
    await db.commit()
    await db.refresh(doctor)

    return DoctorProfileResponse(
        id=doctor.id,
        user_id=doctor.user_id,
        clinic_id=doctor.clinic_id,
        first_name=staff.user.first_name,
        last_name=staff.user.last_name,
        specialization=doctor.specialization,
        license_number=doctor.license_number,
        qualifications=doctor.qualifications,
        consultation_fee=float(doctor.consultation_fee),
        follow_up_fee=float(doctor.follow_up_fee),
        is_available_for_booking=doctor.is_available_for_booking
    )


@router.get("", response_model=List[DoctorProfileResponse])
@router.get("/public", response_model=List[DoctorProfileResponse])
async def list_doctors(
    specialization: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    include_unavailable: bool = Query(False, description="Whether to include doctors currently marked unavailable"),
    clinic_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Publicly lists doctors, their categories, chambers, visiting hours, and consultation fees.
    Accessible without authentication for public visitors and homepage directory.
    """
    stmt = (
        select(DoctorProfile)
        .options(selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user))
    )
    if clinic_id:
        stmt = stmt.where(DoctorProfile.clinic_id == clinic_id)

    if not include_unavailable:
        stmt = stmt.where(DoctorProfile.is_available_for_booking == True)

    filter_spec = specialization or category
    if filter_spec and filter_spec.lower() != "all":
        stmt = stmt.where(DoctorProfile.specialization.ilike(f"%{filter_spec}%"))

    stmt = stmt.order_by(DoctorProfile.created_at.asc())
    res = await db.execute(stmt)
    doctors = res.scalars().all()

    # Pre-fetch active approved leaves for real-time patient visibility
    active_leaves_stmt = select(DoctorLeave).where(
        DoctorLeave.status == LeaveStatus.APPROVED,
        DoctorLeave.end_date >= date.today()
    )
    active_leaves_res = await db.execute(active_leaves_stmt)
    all_active_leaves = active_leaves_res.scalars().all()
    leaves_by_doc = {}
    for l in all_active_leaves:
        leaves_by_doc.setdefault(l.doctor_id, []).append(
            DoctorLeaveResponse(
                id=l.id,
                doctor_id=l.doctor_id,
                start_date=l.start_date,
                end_date=l.end_date,
                reason=l.reason,
                status="APPROVED",
                status_display="Leave Confirmed",
                total_days=(l.end_date - l.start_date).days + 1,
                created_at=l.created_at
            )
        )

    results = []
    for d in doctors:
        first_name = ""
        last_name = ""
        avatar_url = getattr(d, "avatar_url", None)
        if d.staff and d.staff.user:
            first_name = d.staff.user.first_name
            last_name = d.staff.user.last_name
            if not avatar_url:
                avatar_url = d.staff.user.avatar_url
        else:
            u_res = await db.execute(select(User).where(User.id == d.user_id))
            u = u_res.scalar_one_or_none()
            if u:
                first_name = u.first_name
                last_name = u.last_name
                if not avatar_url:
                    avatar_url = u.avatar_url

        doc_leaves = leaves_by_doc.get(d.id, [])
        parsed_sched = []
        if getattr(d, "weekly_schedule", None):
            try:
                parsed_sched = json.loads(d.weekly_schedule)
            except Exception:
                parsed_sched = []

        results.append(
            DoctorProfileResponse(
                id=d.id,
                user_id=d.user_id,
                clinic_id=d.clinic_id,
                first_name=first_name,
                last_name=last_name,
                avatar_url=avatar_url,
                bio=d.bio,
                specialization=d.specialization,
                specialty=d.specialization,
                category=d.specialization,
                license_number=d.license_number,
                qualifications=d.qualifications,
                degrees=d.qualifications,
                chamber_location=d.chamber_location or "Room 101, Main Building",
                visiting_days=d.visiting_days or "Sat - Thu",
                visiting_hours=d.visiting_hours or "5:00 PM - 9:00 PM",
                consultation_fee=float(d.consultation_fee),
                follow_up_fee=float(d.follow_up_fee),
                is_available_for_booking=d.is_available_for_booking,
                current_status=getattr(d, "current_status", "Available") or "Available",
                status_note=getattr(d, "status_note", None),
                available_from_time=getattr(d, "available_from_time", None),
                confirmed_leaves=doc_leaves,
                weekly_schedule=parsed_sched
            )
        )

    return results


@router.put("/{doctor_id}", response_model=DoctorProfileResponse)
async def update_doctor_profile(
    doctor_id: uuid.UUID,
    request: DoctorProfileUpdate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN, ClinicRole.DOCTOR])),
    db: AsyncSession = Depends(get_db)
):
    """Updates doctor consulting fees, specialization, qualifications, and booking availability."""
    stmt = (
        select(DoctorProfile)
        .where(
            DoctorProfile.id == doctor_id,
            DoctorProfile.clinic_id == tenant.clinic_id
        )
        .options(selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user))
    )
    res = await db.execute(stmt)
    doctor = res.scalar_one_or_none()

    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    update_data = request.model_dump(exclude_unset=True)
    if "specialty" in update_data and update_data["specialty"]:
        update_data["specialization"] = update_data.pop("specialty")
    if "category" in update_data and update_data["category"]:
        update_data["specialization"] = update_data.pop("category")
    if "degrees" in update_data and update_data["degrees"]:
        update_data["qualifications"] = update_data.pop("degrees")

    for field, val in update_data.items():
        if val is not None and hasattr(doctor, field):
            setattr(doctor, field, val)

    # Sync department if specialization changed
    if doctor.specialization and doctor.staff:
        doctor.staff.department = doctor.specialization

    await db.commit()
    await db.refresh(doctor)

    return DoctorProfileResponse(
        id=doctor.id,
        user_id=doctor.user_id,
        clinic_id=doctor.clinic_id,
        first_name=doctor.staff.user.first_name if doctor.staff and doctor.staff.user else "",
        last_name=doctor.staff.user.last_name if doctor.staff and doctor.staff.user else "",
        avatar_url=doctor.avatar_url or (doctor.staff.user.avatar_url if doctor.staff and doctor.staff.user else None),
        specialization=doctor.specialization,
        specialty=doctor.specialization,
        category=doctor.specialization,
        license_number=doctor.license_number,
        qualifications=doctor.qualifications,
        degrees=doctor.qualifications,
        chamber_location=doctor.chamber_location or "Room 101, Main Building",
        visiting_days=doctor.visiting_days or "Sat - Thu",
        visiting_hours=doctor.visiting_hours or "5:00 PM - 9:00 PM",
        consultation_fee=float(doctor.consultation_fee),
        follow_up_fee=float(doctor.follow_up_fee),
        is_available_for_booking=doctor.is_available_for_booking
    )


@router.post("/{doctor_id}/schedules", response_model=DoctorScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor_schedule(
    doctor_id: uuid.UUID,
    request: DoctorScheduleCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.DOCTOR])),
    db: AsyncSession = Depends(get_db)
):
    """Configures weekly shift start/end times and break windows for a specific day."""
    # Delete existing schedule for this day to allow clean overwrite
    existing = await db.execute(
        select(DoctorSchedule).where(
            DoctorSchedule.clinic_id == tenant.clinic_id,
            DoctorSchedule.doctor_id == doctor_id,
            DoctorSchedule.day_of_week == request.day_of_week
        )
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)
        await db.flush()

    schedule = DoctorSchedule(
        clinic_id=tenant.clinic_id,
        doctor_id=doctor_id,
        day_of_week=request.day_of_week,
        shift_start_time=request.shift_start_time,
        shift_end_time=request.shift_end_time,
        slot_duration_minutes=request.slot_duration_minutes,
        buffer_time_minutes=request.buffer_time_minutes,
        is_active=True
    )
    db.add(schedule)
    await db.flush()

    for b in request.breaks:
        d_break = DoctorBreak(
            schedule_id=schedule.id,
            break_name=b.break_name,
            start_time=b.start_time,
            end_time=b.end_time
        )
        db.add(d_break)

    await db.commit()
    await db.refresh(schedule)

    stmt = select(DoctorSchedule).where(DoctorSchedule.id == schedule.id).options(selectinload(DoctorSchedule.breaks))
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/{doctor_id}/slots", response_model=AvailableSlotsResponse)
async def get_available_slots(
    doctor_id: uuid.UUID,
    slot_date: date = Query(..., alias="date", description="Target booking date (YYYY-MM-DD)"),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Smart Slot Generator:
    Calculates non-overlapping slots based on weekly shifts, intra-shift breaks,
    approved leaves, and current appointment reservations.
    """
    doc_res = await db.execute(select(DoctorProfile.clinic_id).where(DoctorProfile.id == doctor_id))
    doc_clinic_id = doc_res.scalar_one_or_none()
    effective_clinic_id = doc_clinic_id or tenant.clinic_id

    return await generate_doctor_slots(
        db=db,
        clinic_id=effective_clinic_id,
        doctor_id=doctor_id,
        target_date=slot_date
    )


@router.post("/{doctor_id}/leaves", response_model=DoctorLeaveResponse, status_code=status.HTTP_201_CREATED)
async def record_doctor_leave(
    doctor_id: uuid.UUID,
    request: DoctorLeaveCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.DOCTOR])),
    db: AsyncSession = Depends(get_db)
):
    """Registers blackout dates / holiday leave for a doctor."""
    leave = DoctorLeave(
        clinic_id=tenant.clinic_id,
        doctor_id=doctor_id,
        start_date=request.start_date,
        end_date=request.end_date,
        reason=request.reason
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)
    return leave


# ==============================================================================
# SUPER ADMIN LEAVE APPROVAL ENDPOINTS (/api/v1/admin/leaves)
# ==============================================================================

@admin_leaves_router.get("", response_model=List[DoctorLeaveResponse])
async def list_all_doctor_leaves(
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Super Admin reviews all submitted doctor leave requests."""
    stmt = (
        select(DoctorLeave)
        .options(
            selectinload(DoctorLeave.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user)
        )
        .order_by(DoctorLeave.created_at.desc())
    )
    res = await db.execute(stmt)
    leaves = res.scalars().all()

    results = []
    for l in leaves:
        first_name = ""
        last_name = ""
        avatar_url = None
        specialization = "Specialist"
        if l.doctor:
            specialization = l.doctor.specialization
            avatar_url = l.doctor.avatar_url
            if l.doctor.staff and l.doctor.staff.user:
                first_name = l.doctor.staff.user.first_name
                last_name = l.doctor.staff.user.last_name
                if not avatar_url:
                    avatar_url = l.doctor.staff.user.avatar_url

        doc_name = f"Dr. {first_name} {last_name}".strip() if (first_name or last_name) else "Doctor"

        status_raw = str(l.status.value if hasattr(l.status, "value") else l.status).upper()
        if "APPROV" in status_raw:
            disp = "Leave Confirmed"
            norm_status = "APPROVED"
        elif "REJECT" in status_raw:
            disp = "Rejected"
            norm_status = "REJECTED"
        else:
            disp = "Pending Approval"
            norm_status = "PENDING"

        total_days = (l.end_date - l.start_date).days + 1
        results.append(
            DoctorLeaveResponse(
                id=l.id,
                doctor_id=l.doctor_id,
                doctor_name=doc_name,
                doctor_specialization=specialization,
                doctor_avatar=avatar_url,
                start_date=l.start_date,
                end_date=l.end_date,
                reason=l.reason,
                status=norm_status,
                status_display=disp,
                total_days=total_days,
                created_at=l.created_at
            )
        )
    return results


@admin_leaves_router.patch("/{leave_id}", response_model=DoctorLeaveResponse)
@admin_leaves_router.put("/{leave_id}", response_model=DoctorLeaveResponse)
async def update_leave_status(
    leave_id: uuid.UUID,
    payload: LeaveStatusUpdate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Super Admin one-click Approve or Reject for doctor leave requests."""
    stmt = (
        select(DoctorLeave)
        .where(DoctorLeave.id == leave_id)
        .options(
            selectinload(DoctorLeave.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user)
        )
    )
    res = await db.execute(stmt)
    leave = res.scalar_one_or_none()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    status_str = payload.status.upper()
    if "APPROV" in status_str:
        leave.status = LeaveStatus.APPROVED
        norm_status = "APPROVED"
        disp = "Leave Confirmed"
    elif "REJECT" in status_str:
        leave.status = LeaveStatus.REJECTED
        norm_status = "REJECTED"
        disp = "Rejected"
    else:
        leave.status = LeaveStatus.PENDING
        norm_status = "PENDING"
        disp = "Pending Approval"

    await db.commit()
    await db.refresh(leave)

    doc_name = "Doctor"
    spec = "Specialist"
    avatar = None
    if leave.doctor:
        spec = leave.doctor.specialization
        avatar = leave.doctor.avatar_url
        if leave.doctor.staff and leave.doctor.staff.user:
            doc_name = f"Dr. {leave.doctor.staff.user.first_name} {leave.doctor.staff.user.last_name}"
            if not avatar:
                avatar = leave.doctor.staff.user.avatar_url

    total_days = (leave.end_date - leave.start_date).days + 1
    return DoctorLeaveResponse(
        id=leave.id,
        doctor_id=leave.doctor_id,
        doctor_name=doc_name,
        doctor_specialization=spec,
        doctor_avatar=avatar,
        start_date=leave.start_date,
        end_date=leave.end_date,
        reason=leave.reason,
        status=norm_status,
        status_display=disp,
        total_days=total_days,
        created_at=leave.created_at
    )
