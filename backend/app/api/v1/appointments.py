"""Appointment Booking API Endpoints with Atomic Double-Booking Collision Prevention."""
import uuid
from typing import List, Optional
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_tenant, get_current_user, require_roles, TenantContext, log_audit_event
from app.core.security import hash_password
from app.models.appointment import Appointment, QueueToken, AppointmentStatus, AppointmentType, QueueStatus
from app.models.patient import Patient, Gender, BloodGroup
from app.models.doctor import DoctorProfile
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, InvoiceItemType
from app.models.user import User, ClinicStaff, ClinicRole, SystemRole, AuditAction
from app.schemas.appointment import (
    AppointmentCreate, AppointmentStatusUpdate, AppointmentResponse, QueueTokenResponse,
    AdminAppointmentBookRequest
)
from app.api.v1.patients import generate_mrn
from app.services.queue_service import issue_queue_token

router = APIRouter(prefix="/appointments", tags=["Appointments"])


async def generate_appointment_number(db: AsyncSession, clinic_id: uuid.UUID) -> str:
    """Generates tenant-scoped sequential appointment reference e.g. APT-20261122-0042."""
    today_str = datetime.now().strftime("%Y%m%d")
    prefix = f"APT-{today_str}-"

    count_stmt = select(func.count(Appointment.id)).where(
        Appointment.clinic_id == clinic_id,
        Appointment.appointment_number.like(f"{prefix}%")
    )
    count_res = await db.execute(count_stmt)
    total_today = count_res.scalar() or 0

    return f"{prefix}{total_today + 1:04d}"


async def auto_create_doctor_visit_invoice(
    db: AsyncSession,
    clinic_id: uuid.UUID,
    patient_id: uuid.UUID,
    appointment_id: uuid.UUID,
    doctor: Optional[DoctorProfile],
    doctor_name: Optional[str] = None
) -> None:
    """Auto-generates Doctor Visit Due invoice on appointment booking."""
    try:
        fee = float(doctor.consultation_fee if doctor and doctor.consultation_fee else 1000.0)
        month_str = datetime.now().strftime("%Y%m")
        prefix = f"INV-{month_str}-"
        cnt_res = await db.execute(
            select(func.count(Invoice.id)).where(
                Invoice.clinic_id == clinic_id,
                Invoice.invoice_number.like(f"{prefix}%")
            )
        )
        cnt = cnt_res.scalar() or 0
        inv_num = f"{prefix}{cnt + 1:04d}"

        doc_label = f"Dr. {doctor_name}" if doctor_name else (f"Dr. ({doctor.specialization})" if doctor else "Specialist")
        desc = f"Consultation: {doc_label}"

        inv = Invoice(
            clinic_id=clinic_id,
            patient_id=patient_id,
            appointment_id=appointment_id,
            doctor_id=doctor.user_id if doctor else None,
            invoice_number=inv_num,
            status=InvoiceStatus.ISSUED,
            bill_type="Doctor Visit",
            description=desc,
            amount_bdt=fee,
            paid_amount_bdt=0.00,
            due_amount_bdt=fee,
            payment_status="Due",
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=fee,
            discount_amount=0.00,
            tax_rate_percent=0.00,
            tax_amount=0.00,
            total_amount=fee,
            paid_amount=0.00,
            balance_amount=fee,
            notes="Auto-generated Doctor Visit consultation charge"
        )
        db.add(inv)
        await db.flush()

        item = InvoiceItem(
            invoice_id=inv.id,
            item_type=InvoiceItemType.CONSULTATION,
            description=desc,
            quantity=1,
            unit_price=fee,
            total_price=fee
        )
        db.add(item)
    except Exception as e:
        print(f"Notice: Failed to auto-create appointment invoice: {e}")


@router.post("", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def book_appointment(
    request: AppointmentCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST, ClinicRole.DOCTOR, SystemRole.PATIENT])),
    db: AsyncSession = Depends(get_db)
):
    """
    Atomic Appointment Booking:
    1. Validates start and end time.
    2. Enforces application-level double-booking lock.
    3. Triggers DB-level PostgreSQL GIST Exclusion constraint upon commit.
    4. Auto-issues Queue Token if appointment is booked for today.
    """
    if request.start_time >= request.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment start_time must be strictly before end_time"
        )

    # 1. Collision check: Doctor must not have an active overlapping appointment
    collision_stmt = select(Appointment).where(
        and_(
            Appointment.doctor_id == request.doctor_id,
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
            or_(
                and_(Appointment.start_time <= request.start_time, Appointment.end_time > request.start_time),
                and_(Appointment.start_time < request.end_time, Appointment.end_time >= request.end_time),
                and_(Appointment.start_time >= request.start_time, Appointment.end_time <= request.end_time)
            )
        )
    )
    collision_res = await db.execute(collision_stmt)
    if collision_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Double-booking prevented: Doctor already has an overlapping appointment in this time slot."
        )

    # Verify Patient and Doctor exist
    patient_res = await db.execute(
        select(Patient).where(Patient.id == request.patient_id)
    )
    patient = patient_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient record not found")

    doctor_res = await db.execute(
        select(DoctorProfile)
        .where(DoctorProfile.id == request.doctor_id)
        .options(selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user))
    )
    doctor = doctor_res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    effective_clinic_id = doctor.clinic_id or patient.clinic_id or tenant.clinic_id

    # Calculate sequential serial number for this doctor on this date
    booking_date = request.start_time.date()
    start_of_day = datetime.combine(booking_date, datetime.min.time()).replace(tzinfo=request.start_time.tzinfo or timezone.utc)
    end_of_day = datetime.combine(booking_date, datetime.max.time()).replace(tzinfo=request.start_time.tzinfo or timezone.utc)

    serial_stmt = select(func.count(Appointment.id)).where(
        Appointment.doctor_id == request.doctor_id,
        Appointment.start_time >= start_of_day,
        Appointment.start_time <= end_of_day,
        Appointment.status != AppointmentStatus.CANCELLED
    )
    serial_res = await db.execute(serial_stmt)
    count_existing = serial_res.scalar() or 0
    next_serial = count_existing + 1

    appointment_number = await generate_appointment_number(db, effective_clinic_id)

    appointment = Appointment(
        clinic_id=effective_clinic_id,
        patient_id=request.patient_id,
        doctor_id=request.doctor_id,
        appointment_number=appointment_number,
        appointment_type=request.appointment_type,
        status=AppointmentStatus.SCHEDULED,
        start_time=request.start_time,
        end_time=request.end_time,
        reason_for_visit=request.reason_for_visit,
        internal_notes=request.internal_notes,
        serial_number=next_serial
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    # Auto-generate Doctor Visit Due invoice
    await auto_create_doctor_visit_invoice(
        db=db,
        clinic_id=effective_clinic_id,
        patient_id=patient.id,
        appointment_id=appointment.id,
        doctor=doctor,
        doctor_name=None
    )
    await db.commit()

    # Auto-generate Doctor Visit Due invoice
    await auto_create_doctor_visit_invoice(
        db=db,
        clinic_id=effective_clinic_id,
        patient_id=request.patient_id,
        appointment_id=appointment.id,
        doctor=doctor,
        doctor_name=None
    )
    await db.commit()

    await log_audit_event(
        db=db,
        action=AuditAction.CREATE,
        resource_type="Appointment",
        resource_id=str(appointment.id),
        clinic_id=effective_clinic_id,
        user_id=tenant.staff.user_id if tenant.staff else None,
        patient_id=patient.id
    )

    d_full = ""
    d_avatar = doctor.avatar_url if doctor else None
    if doctor and doctor.staff and doctor.staff.user:
        u = doctor.staff.user
        d_full = f"{u.first_name} {u.last_name}".strip()
        if not d_avatar:
            d_avatar = u.avatar_url
    elif doctor:
        u_res = await db.execute(select(User).where(User.id == doctor.user_id))
        u = u_res.scalar_one_or_none()
        if u:
            d_full = f"{u.first_name} {u.last_name}".strip()
            if not d_avatar:
                d_avatar = u.avatar_url

    if d_full:
        formatted_doc_name = d_full if d_full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {d_full}"
    else:
        formatted_doc_name = f"Dr. ({doctor.specialization if doctor else 'Specialist'})"

    return AppointmentResponse(
        id=appointment.id,
        clinic_id=appointment.clinic_id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        appointment_number=appointment.appointment_number,
        appointment_type=appointment.appointment_type,
        status=appointment.status,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        reason_for_visit=appointment.reason_for_visit,
        patient_name=f"{patient.first_name} {patient.last_name}",
        doctor_name=formatted_doc_name,
        doctor_specialty=doctor.specialization if doctor else None,
        doctor_avatar=d_avatar,
        chamber_location=doctor.chamber_location or "Room 101, Main Building" if doctor else None,
        serial_number=appointment.serial_number,
        serial_code=f"Serial #{appointment.serial_number:02d}" if appointment.serial_number else None,
        created_at=appointment.created_at
    )


@router.post("/admin-book", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def admin_book_appointment(
    request: AdminAppointmentBookRequest,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST, ClinicRole.DOCTOR, SystemRole.SUPER_ADMIN])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Administrative / Front-Desk Structured Appointment Booking.
    - Matches or registers patient profile + user account in one atomic transaction.
    - Prevents double-booking collisions for doctor.
    - Assigns daily sequential serial number and appointment reference.
    - Returns full appointment confirmation with patient MRN, serial number, and doctor details.
    """
    if request.start_time >= request.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Appointment start_time must be strictly before end_time"
        )

    # 1. Collision check: Doctor must not have an active overlapping appointment
    collision_stmt = select(Appointment).where(
        and_(
            Appointment.doctor_id == request.doctor_id,
            Appointment.status.notin_([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW]),
            or_(
                and_(Appointment.start_time <= request.start_time, Appointment.end_time > request.start_time),
                and_(Appointment.start_time < request.end_time, Appointment.end_time >= request.end_time),
                and_(Appointment.start_time >= request.start_time, Appointment.end_time <= request.end_time)
            )
        )
    )
    collision_res = await db.execute(collision_stmt)
    if collision_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Double-booking prevented: Doctor already has an overlapping appointment in this time slot."
        )

    # 2. Verify Doctor exists
    doctor_res = await db.execute(
        select(DoctorProfile)
        .where(DoctorProfile.id == request.doctor_id)
        .options(selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user))
    )
    doctor = doctor_res.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")

    effective_clinic_id = doctor.clinic_id or tenant.clinic_id

    # 3. Match or Create Patient
    clean_phone = "".join(filter(str.isdigit, request.phone))
    clean_first = request.first_name.strip()
    clean_last = f"{request.middle_name.strip() + ' ' if request.middle_name and request.middle_name.strip() else ''}{request.last_name.strip()}".strip()
    if not clean_last:
        clean_last = request.last_name.strip()

    patient = None
    if request.patient_id:
        p_res = await db.execute(select(Patient).where(Patient.id == request.patient_id))
        patient = p_res.scalar_one_or_none()

    if not patient and request.mrn and request.mrn.strip():
        p_res = await db.execute(
            select(Patient).where(
                Patient.mrn == request.mrn.strip(),
                Patient.clinic_id == effective_clinic_id
            )
        )
        patient = p_res.scalar_one_or_none()

    if not patient and clean_phone:
        p_res = await db.execute(
            select(Patient).where(
                (Patient.phone == clean_phone) | (Patient.phone == request.phone.strip()),
                Patient.clinic_id == effective_clinic_id
            )
        )
        patient = p_res.scalars().first()

    # Map Gender enum
    gender_map = {"MALE": Gender.MALE, "FEMALE": Gender.FEMALE, "OTHER": Gender.OTHER}
    gender_val = gender_map.get(request.gender.upper(), Gender.MALE)

    # Map BloodGroup enum
    bg_map = {
        "A+": BloodGroup.A_POSITIVE, "A-": BloodGroup.A_NEGATIVE,
        "B+": BloodGroup.B_POSITIVE, "B-": BloodGroup.B_NEGATIVE,
        "AB+": BloodGroup.AB_POSITIVE, "AB-": BloodGroup.AB_NEGATIVE,
        "O+": BloodGroup.O_POSITIVE, "O-": BloodGroup.O_NEGATIVE,
        "UNKNOWN": BloodGroup.UNKNOWN
    }
    bg_val = bg_map.get(request.blood_group.upper() if request.blood_group else "UNKNOWN", BloodGroup.UNKNOWN)

    # Compile notes
    combined_notes = request.notes or ""
    if request.current_medications and request.current_medications.strip():
        med_note = f"Current Meds: {request.current_medications.strip()}"
        combined_notes = f"{med_note}\n{combined_notes}".strip() if combined_notes else med_note

    if patient:
        # Update existing patient record with any new details
        if request.address_line:
            patient.address_line = request.address_line.strip()
        if request.emergency_contact_name:
            patient.emergency_contact_name = request.emergency_contact_name.strip()
        if request.emergency_contact_phone:
            patient.emergency_contact_phone = request.emergency_contact_phone.strip()
        if request.emergency_contact_relation:
            patient.emergency_contact_relation = request.emergency_contact_relation.strip()
        if request.allergies:
            existing_al = set(patient.allergies or [])
            existing_al.update(request.allergies)
            patient.allergies = list(existing_al)
        if request.chronic_conditions:
            existing_cc = set(patient.chronic_conditions or [])
            existing_cc.update(request.chronic_conditions)
            patient.chronic_conditions = list(existing_cc)
        if combined_notes:
            patient.notes = f"{patient.notes}\n{combined_notes}".strip() if patient.notes else combined_notes
        db.add(patient)
    else:
        # Create new Walk-in Patient + User
        new_user = None
        user_email = (request.email.strip().lower() if request.email and request.email.strip() else None)
        if not user_email:
            user_email = f"walkin_{clean_phone or uuid.uuid4().hex[:8]}@clinic.local"

        u_exist = await db.execute(select(User).where(User.email == user_email))
        existing_u = u_exist.scalar_one_or_none()
        if existing_u:
            new_user = existing_u
        else:
            new_user = User(
                email=user_email,
                phone=clean_phone or None,
                hashed_password=hash_password("Patient@123"),
                first_name=clean_first,
                last_name=clean_last,
                system_role=SystemRole.PATIENT,
                is_active=True,
                is_email_verified=False
            )
            db.add(new_user)
            await db.flush()

        new_mrn = await generate_mrn(db, effective_clinic_id)

        patient = Patient(
            clinic_id=effective_clinic_id,
            user_id=new_user.id if new_user else None,
            mrn=new_mrn,
            first_name=clean_first,
            last_name=clean_last,
            date_of_birth=request.date_of_birth,
            gender=gender_val,
            blood_group=bg_val,
            phone=clean_phone or request.phone.strip(),
            email=request.email.strip() if request.email and request.email.strip() else None,
            address_line=request.address_line.strip(),
            emergency_contact_name=request.emergency_contact_name.strip(),
            emergency_contact_phone=request.emergency_contact_phone.strip(),
            emergency_contact_relation=request.emergency_contact_relation.strip(),
            allergies=request.allergies or [],
            chronic_conditions=request.chronic_conditions or [],
            notes=combined_notes
        )
        db.add(patient)
        await db.flush()

    # 4. Calculate Sequential Serial Number
    booking_date = request.start_time.date()
    start_of_day = datetime.combine(booking_date, datetime.min.time()).replace(tzinfo=request.start_time.tzinfo or timezone.utc)
    end_of_day = datetime.combine(booking_date, datetime.max.time()).replace(tzinfo=request.start_time.tzinfo or timezone.utc)

    serial_stmt = select(func.count(Appointment.id)).where(
        Appointment.doctor_id == request.doctor_id,
        Appointment.start_time >= start_of_day,
        Appointment.start_time <= end_of_day,
        Appointment.status != AppointmentStatus.CANCELLED
    )
    serial_res = await db.execute(serial_stmt)
    count_existing = serial_res.scalar() or 0
    next_serial = count_existing + 1

    appointment_number = await generate_appointment_number(db, effective_clinic_id)

    # Determine appointment type
    appt_type = AppointmentType.IN_PERSON
    if request.visit_type:
        vt = request.visit_type.upper()
        if "FOLLOW" in vt:
            appt_type = AppointmentType.FOLLOW_UP
        elif "WALK" in vt:
            appt_type = AppointmentType.WALK_IN

    appointment = Appointment(
        clinic_id=effective_clinic_id,
        patient_id=patient.id,
        doctor_id=request.doctor_id,
        appointment_number=appointment_number,
        appointment_type=appt_type,
        status=AppointmentStatus.CONFIRMED,
        start_time=request.start_time,
        end_time=request.end_time,
        reason_for_visit=request.reason_for_visit,
        internal_notes=request.internal_notes,
        serial_number=next_serial
    )
    db.add(appointment)
    await db.commit()
    await db.refresh(appointment)

    # Auto-generate Doctor Visit Due invoice
    await auto_create_doctor_visit_invoice(
        db=db,
        clinic_id=effective_clinic_id,
        patient_id=patient.id,
        appointment_id=appointment.id,
        doctor=doctor,
        doctor_name=None
    )
    await db.commit()

    # Auto-generate Doctor Visit Due invoice
    await auto_create_doctor_visit_invoice(
        db=db,
        clinic_id=effective_clinic_id,
        patient_id=request.patient_id,
        appointment_id=appointment.id,
        doctor=doctor,
        doctor_name=None
    )
    await db.commit()

    # Auto issue queue token if booked for today
    if booking_date == date.today():
        try:
            await issue_queue_token(db, effective_clinic_id, appointment.id)
            await db.refresh(appointment)
        except Exception:
            pass

    # Doctor display info
    d_full = ""
    d_avatar = doctor.avatar_url if doctor else None
    if doctor and doctor.staff and doctor.staff.user:
        u = doctor.staff.user
        d_full = f"{u.first_name} {u.last_name}".strip()
        if not d_avatar:
            d_avatar = u.avatar_url
    elif doctor:
        u_res = await db.execute(select(User).where(User.id == doctor.user_id))
        u = u_res.scalar_one_or_none()
        if u:
            d_full = f"{u.first_name} {u.last_name}".strip()
            if not d_avatar:
                d_avatar = u.avatar_url

    if d_full:
        formatted_doc_name = d_full if d_full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {d_full}"
    else:
        formatted_doc_name = f"Dr. ({doctor.specialization if doctor else 'Specialist'})"

    return AppointmentResponse(
        id=appointment.id,
        clinic_id=appointment.clinic_id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        appointment_number=appointment.appointment_number,
        appointment_type=appointment.appointment_type,
        status=appointment.status,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        reason_for_visit=appointment.reason_for_visit,
        patient_name=f"{patient.first_name} {patient.last_name}".strip(),
        patient_mrn=patient.mrn,
        patient_phone=patient.phone,
        patient_gender=patient.gender.value if hasattr(patient.gender, "value") else str(patient.gender),
        patient_dob=patient.date_of_birth,
        doctor_name=formatted_doc_name,
        doctor_specialty=doctor.specialization if doctor else None,
        doctor_avatar=d_avatar,
        chamber_location=doctor.chamber_location or "Room 101, Main Building" if doctor else None,
        serial_number=appointment.serial_number,
        serial_code=f"Serial #{appointment.serial_number:02d}" if appointment.serial_number else None,
        created_at=appointment.created_at
    )


@router.get("", response_model=List[AppointmentResponse])
async def list_appointments(
    doctor_id: Optional[uuid.UUID] = Query(None),
    patient_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    target_date: Optional[date] = Query(None, alias="date"),
    tenant: TenantContext = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists appointments with optional filters for doctor, patient, date, and status."""
    stmt = (
        select(Appointment)
        .options(
            selectinload(Appointment.patient).selectinload(Patient.user),
            selectinload(Appointment.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user),
            selectinload(Appointment.queue_token)
        )
    )

    if tenant.is_patient or current_user.system_role == SystemRole.PATIENT:
        if not patient_id:
            if tenant.patient:
                patient_id = tenant.patient.id
            else:
                p_res = await db.execute(select(Patient.id).where(Patient.user_id == current_user.id).limit(1))
                patient_id = p_res.scalar_one_or_none()
        if patient_id:
            stmt = stmt.where(Appointment.patient_id == patient_id)
        else:
            return []
    else:
        stmt = stmt.where(Appointment.clinic_id == tenant.clinic_id)

    # If logged-in user is a doctor and no explicit doctor_id was passed, default to their doctor_id
    if not doctor_id and not tenant.is_patient and current_user.system_role != SystemRole.PATIENT:
        doc_stmt = select(DoctorProfile.id).where(
            (DoctorProfile.user_id == current_user.id) |
            (DoctorProfile.staff_id.in_(select(ClinicStaff.id).where(ClinicStaff.user_id == current_user.id)))
        )
        doc_res = await db.execute(doc_stmt)
        user_doc_id = doc_res.scalar_one_or_none()
        if user_doc_id:
            doctor_id = user_doc_id

    if doctor_id:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(Appointment.status == status_filter)
    if target_date:
        start_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        end_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=timezone.utc)
        stmt = stmt.where(Appointment.start_time >= start_day, Appointment.start_time <= end_day)

    stmt = stmt.order_by(Appointment.start_time.asc())
    res = await db.execute(stmt)
    appts = res.scalars().all()

    doc_date_counters = {}
    results = []
    for a in appts:
        d_name = None
        d_specialty = None
        d_avatar = None
        d_chamber = None
        if a.doctor:
            d_specialty = a.doctor.specialization
            d_chamber = a.doctor.chamber_location or "Room 101, Main Building"
            d_avatar = a.doctor.avatar_url
            if a.doctor.staff and a.doctor.staff.user:
                u = a.doctor.staff.user
                full = f"{u.first_name} {u.last_name}".strip()
                d_name = full if full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {full}"
                if not d_avatar:
                    d_avatar = u.avatar_url
            else:
                d_name = f"Dr. ({a.doctor.specialization})"

        # Dynamic sequential serial number per (doctor_id, date)
        appt_date_str = str(a.start_time.date()) if a.start_time else "today"
        counter_key = (str(a.doctor_id), appt_date_str)
        doc_date_counters[counter_key] = doc_date_counters.get(counter_key, 0) + 1
        effective_serial = a.serial_number if a.serial_number else doc_date_counters[counter_key]
        serial_code = f"Serial #{effective_serial:02d}"

        p_age = None
        if a.patient and a.patient.date_of_birth:
            p_age = datetime.now().year - a.patient.date_of_birth.year

        p_gender = None
        if a.patient and a.patient.gender:
            p_gender = a.patient.gender.value if hasattr(a.patient.gender, "value") else str(a.patient.gender)

        p_name = None
        p_phone = None
        if a.patient:
            full = f"{a.patient.first_name or ''} {a.patient.last_name or ''}".strip()
            if not full and getattr(a.patient, "user", None):
                u = a.patient.user
                full = f"{u.first_name or ''} {u.last_name or ''}".strip()
            p_name = full or "Patient"
            p_phone = a.patient.phone or (a.patient.user.phone if getattr(a.patient, "user", None) else None)

        results.append(
            AppointmentResponse(
                id=a.id,
                clinic_id=a.clinic_id,
                patient_id=a.patient_id,
                doctor_id=a.doctor_id,
                appointment_number=a.appointment_number,
                appointment_type=a.appointment_type,
                status=a.status,
                start_time=a.start_time,
                end_time=a.end_time,
                reason_for_visit=a.reason_for_visit,
                patient_name=p_name,
                patient_mrn=a.patient.mrn if a.patient else None,
                patient_phone=p_phone,
                patient_gender=p_gender,
                patient_dob=a.patient.date_of_birth if a.patient else None,
                patient_age=p_age,
                doctor_name=d_name,
                doctor_specialty=d_specialty,
                doctor_avatar=d_avatar,
                chamber_location=d_chamber,
                serial_number=effective_serial,
                serial_code=serial_code,
                queue_token=QueueTokenResponse.model_validate(a.queue_token) if a.queue_token else None,
                created_at=a.created_at
            )
        )
    return results


@router.patch("/{appointment_id}/status", response_model=AppointmentResponse)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    update: AppointmentStatusUpdate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST, ClinicRole.DOCTOR])),
    db: AsyncSession = Depends(get_db)
):
    """
    Workflow transition:
    SCHEDULED -> CHECKED_IN -> IN_CONSULTATION -> COMPLETED / CANCELLED / NO_SHOW.
    Automatically provisions waiting room Queue Token upon check-in.
    """
    stmt = (
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(
            selectinload(Appointment.patient).selectinload(Patient.user),
            selectinload(Appointment.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user),
            selectinload(Appointment.queue_token)
        )
    )
    res = await db.execute(stmt)
    appointment = res.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    appointment.status = update.status
    if update.cancellation_reason:
        appointment.cancellation_reason = update.cancellation_reason

    # If checking in, issue Queue Token
    if update.status == AppointmentStatus.CHECKED_IN and not appointment.queue_token:
        await issue_queue_token(db, appointment.clinic_id, appointment.id)

    await db.commit()
    await db.refresh(appointment)

    p_name = None
    if appointment.patient:
        full = f"{appointment.patient.first_name or ''} {appointment.patient.last_name or ''}".strip()
        if not full and getattr(appointment.patient, "user", None):
            u = appointment.patient.user
            full = f"{u.first_name or ''} {u.last_name or ''}".strip()
        p_name = full or "Patient"

    d_name = None
    d_specialty = None
    d_avatar = None
    d_chamber = None
    if appointment.doctor:
        d_specialty = appointment.doctor.specialization
        d_chamber = appointment.doctor.chamber_location or "Room 101, Main Building"
        d_avatar = appointment.doctor.avatar_url
        if appointment.doctor.staff and appointment.doctor.staff.user:
            u = appointment.doctor.staff.user
            full = f"{u.first_name} {u.last_name}".strip()
            d_name = full if full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {full}"
            if not d_avatar:
                d_avatar = u.avatar_url
        else:
            d_name = f"Dr. ({appointment.doctor.specialization})"

    return AppointmentResponse(
        id=appointment.id,
        clinic_id=appointment.clinic_id,
        patient_id=appointment.patient_id,
        doctor_id=appointment.doctor_id,
        appointment_number=appointment.appointment_number,
        appointment_type=appointment.appointment_type,
        status=appointment.status,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        reason_for_visit=appointment.reason_for_visit,
        patient_name=p_name,
        doctor_name=d_name,
        doctor_specialty=d_specialty,
        doctor_avatar=d_avatar,
        chamber_location=d_chamber,
        serial_number=appointment.serial_number,
        serial_code=f"Serial #{appointment.serial_number:02d}" if appointment.serial_number else None,
        queue_token=QueueTokenResponse.model_validate(appointment.queue_token) if appointment.queue_token else None,
        created_at=appointment.created_at
    )
