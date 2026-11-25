"""Clinic Management & Staff Onboarding API Endpoints."""
import uuid
from typing import List
from datetime import datetime, timezone, timedelta, time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import hash_password
from app.core.deps import get_current_user, get_current_tenant, require_roles, TenantContext
from app.models.tenant import Clinic, ClinicSubscription, SubscriptionPlan, SubscriptionStatus
from app.models.user import User, ClinicStaff, ClinicRole, SystemRole
from app.models.doctor import DoctorProfile, DoctorSchedule, DoctorBreak
from app.models.nurse import NurseProfile
from app.schemas.clinic import (
    ClinicCreate, ClinicUpdate, ClinicResponse, StaffCreate, StaffResponse, DoctorFeeUpdate
)

router = APIRouter(prefix="/clinics", tags=["Clinic Management"])


@router.post("", response_model=ClinicResponse, status_code=status.HTTP_201_CREATED)
async def create_clinic(
    request: ClinicCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Onboards a new clinic tenant, initializes default subscription tier,
    and assigns the creator as the initial Clinic Admin.
    """
    existing_slug = await db.execute(select(Clinic).where(Clinic.slug == request.slug))
    if existing_slug.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A clinic with this unique slug already exists. Please pick another URL slug."
        )

    clinic = Clinic(
        name=request.name,
        slug=request.slug,
        email=request.email,
        phone=request.phone,
        address_line1=request.address_line1,
        address_line2=request.address_line2,
        city=request.city,
        state=request.state,
        postal_code=request.postal_code,
        country=request.country,
        timezone=request.timezone,
        currency=request.currency,
        is_active=True
    )
    db.add(clinic)
    await db.flush()

    # Create Initial Subscription
    now = datetime.now(timezone.utc)
    subscription = ClinicSubscription(
        clinic_id=clinic.id,
        plan=request.plan,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
        trial_end=now + timedelta(days=14),
        max_doctors=5 if request.plan == SubscriptionPlan.STARTER else 20
    )
    db.add(subscription)

    # Link creator as Clinic Admin
    admin_staff = ClinicStaff(
        clinic_id=clinic.id,
        user_id=current_user.id,
        role=ClinicRole.CLINIC_ADMIN,
        designation="Managing Director",
        is_active=True
    )
    db.add(admin_staff)

    await db.commit()
    await db.refresh(clinic)
    return clinic


@router.get("/current", response_model=ClinicResponse)
async def get_current_clinic_details(
    tenant: TenantContext = Depends(get_current_tenant)
):
    """Returns the profile, settings, and letterhead template of the current active clinic."""
    return tenant.clinic


@router.put("/current", response_model=ClinicResponse)
async def update_current_clinic(
    request: ClinicUpdate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Updates clinic settings, contact details, and letterhead configuration."""
    clinic = tenant.clinic
    update_data = request.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(clinic, field, value)

    await db.commit()
    await db.refresh(clinic)
    return clinic


@router.get("/staff", response_model=List[StaffResponse])
async def list_clinic_staff(
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Lists all staff members (doctors, receptionists, admins) for the current clinic with doctor fees."""
    stmt = (
        select(ClinicStaff)
        .where(ClinicStaff.clinic_id == tenant.clinic_id)
        .options(selectinload(ClinicStaff.user))
    )
    res = await db.execute(stmt)
    staff_members = res.scalars().all()

    # Fetch doctor profiles for this clinic
    doc_stmt = select(DoctorProfile).where(DoctorProfile.clinic_id == tenant.clinic_id)
    doc_res = await db.execute(doc_stmt)
    doc_profiles = doc_res.scalars().all()
    doc_by_staff = {d.staff_id: d for d in doc_profiles}
    doc_by_user = {d.user_id: d for d in doc_profiles}

    # Fetch nurse profiles
    nurse_stmt = select(NurseProfile)
    nurse_res = await db.execute(nurse_stmt)
    nurse_profiles = nurse_res.scalars().all()
    nurse_by_user = {n.user_id: n for n in nurse_profiles}

    results = []
    for s in staff_members:
        doc = doc_by_staff.get(s.id) or doc_by_user.get(s.user_id)
        nurse = nurse_by_user.get(s.user_id)
        is_doc = s.role == ClinicRole.DOCTOR
        is_nurse = s.role == ClinicRole.NURSE

        results.append(
            StaffResponse(
                id=s.id,
                user_id=s.user_id,
                clinic_id=s.clinic_id,
                email=s.user.email,
                first_name=s.user.first_name,
                last_name=s.user.last_name,
                role=s.role,
                designation=(nurse.education if (is_nurse and nurse) else s.designation) or ("Registered Nurse" if is_nurse else None),
                department=(f"Home Care ({nurse.service_location})" if (is_nurse and nurse) else s.department) or ("Home Care Nursing" if is_nurse else None),
                is_active=s.is_active,
                created_at=s.created_at,
                doctor_id=doc.id if doc else None,
                specialization=doc.specialization if doc else (f"Home Care ({nurse.service_location})" if (is_nurse and nurse) else s.department),
                specialty=doc.specialization if doc else (f"Home Care ({nurse.service_location})" if (is_nurse and nurse) else s.department),
                qualifications=doc.qualifications if doc else (nurse.education if (is_nurse and nurse) else s.designation),
                degrees=doc.qualifications if doc else (nurse.education if (is_nurse and nurse) else s.designation),
                chamber_location=doc.chamber_location if doc else (nurse.service_location if (is_nurse and nurse) else None),
                visiting_days=doc.visiting_days if doc else ("Daily Shifts" if is_nurse else None),
                visiting_hours=doc.visiting_hours if doc else ("Morning / Evening / 24hr" if is_nurse else None),
                consultation_fee=float(doc.consultation_fee) if doc and doc.consultation_fee is not None else (float(nurse.service_fee_bdt) if (is_nurse and nurse) else (1000.0 if is_doc else None)),
                follow_up_fee=float(doc.follow_up_fee) if doc and doc.follow_up_fee is not None else (0.0 if is_nurse else (500.0 if is_doc else None)),
                is_available_for_booking=doc.is_available_for_booking if doc else (nurse.is_available if (is_nurse and nurse) else (True if is_doc else None))
            )
        )
    return results


@router.post("/staff", response_model=StaffResponse, status_code=status.HTTP_201_CREATED)
async def add_clinic_staff(
    request: StaffCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Enrolls a new staff member (Admin, Doctor, Receptionist) into the clinic with auto-created DoctorProfile."""
    # Check if user already exists in platform
    user_res = await db.execute(select(User).where(User.email == request.email))
    user = user_res.scalar_one_or_none()

    if not user:
        user = User(
            email=request.email,
            hashed_password=hash_password(request.temporary_password),
            first_name=request.first_name,
            last_name=request.last_name,
            phone=request.phone,
            system_role=SystemRole.STAFF,
            is_active=True
        )
        db.add(user)
        await db.flush()

    # Check if already staff in this clinic
    existing_staff_res = await db.execute(
        select(ClinicStaff).where(
            ClinicStaff.clinic_id == tenant.clinic_id,
            ClinicStaff.user_id == user.id
        )
    )
    if existing_staff_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User is already registered as staff in this clinic"
        )

    staff = ClinicStaff(
        clinic_id=tenant.clinic_id,
        user_id=user.id,
        role=request.role,
        designation=request.designation or ("Specialist Physician" if request.role == ClinicRole.DOCTOR else ("Registered Home Care Nurse" if request.role == ClinicRole.NURSE else "Staff Member")),
        department=request.department or request.specialization or ("Cardiology" if request.role == ClinicRole.DOCTOR else ("Home Nursing" if request.role == ClinicRole.NURSE else None)),
        is_active=True
    )
    db.add(staff)
    await db.flush()

    if request.role == ClinicRole.NURSE:
        user.system_role = SystemRole.NURSE
        np_stmt = select(NurseProfile).where(NurseProfile.user_id == user.id)
        np_res = await db.execute(np_stmt)
        if not np_res.scalar_one_or_none():
            fee = request.consultation_fee if request.consultation_fee is not None else 1200.0
            nurse_prof = NurseProfile(
                clinic_id=tenant.clinic_id,
                user_id=user.id,
                full_name=f"Nurse {request.first_name} {request.last_name}".strip(),
                phone=request.phone or "01700000000",
                email=request.email,
                education=request.qualifications or request.degrees or "B.Sc in Nursing",
                experience_years=request.designation or "5+ years",
                service_location=request.chamber_location or "Dhaka Central",
                service_fee_bdt=fee,
                bio=f"Dedicated registered nurse providing professional in-home medical and nursing care.",
                is_available=True if request.is_available is None else request.is_available
            )
            db.add(nurse_prof)
            await db.flush()

    doctor_obj = None
    if request.role == ClinicRole.DOCTOR:
        # Check if doctor profile already exists
        existing_doc_res = await db.execute(
            select(DoctorProfile).where(
                DoctorProfile.clinic_id == tenant.clinic_id,
                DoctorProfile.user_id == user.id
            )
        )
        doctor_obj = existing_doc_res.scalar_one_or_none()
        if not doctor_obj:
            spec = request.specialization or request.specialty or request.department or staff.designation or "General Medicine"
            consult_fee = request.consultation_fee if request.consultation_fee is not None else 1000.0
            follow_fee = request.follow_up_fee if request.follow_up_fee is not None else 500.0
            license_num = request.license_number or f"MED-{staff.id.hex[:6].upper()}"
            quals = request.degrees or request.qualifications or staff.designation or "MBBS, MD"
            chamber = request.chamber_location or "Room 101, Main Building"
            v_days = request.visiting_days or "Sat - Thu"
            v_hours = request.visiting_hours or "5:00 PM - 9:00 PM"

            doctor_obj = DoctorProfile(
                clinic_id=tenant.clinic_id,
                user_id=user.id,
                staff_id=staff.id,
                specialization=spec,
                license_number=license_num,
                qualifications=quals,
                chamber_location=chamber,
                visiting_days=v_days,
                visiting_hours=v_hours,
                experience_years=5,
                consultation_fee=consult_fee,
                follow_up_fee=follow_fee,
                follow_up_validity_days=14,
                bio=f"Senior medical consultant specializing in {spec}.",
                is_available_for_booking=True if request.is_available is None else request.is_available
            )
            db.add(doctor_obj)
            await db.flush()

            # Create default weekly schedule (Monday to Saturday, 08:00 - 17:00)
            for day in range(6):
                sched = DoctorSchedule(
                    clinic_id=tenant.clinic_id,
                    doctor_id=doctor_obj.id,
                    day_of_week=day,
                    shift_start_time=time(8, 0),
                    shift_end_time=time(17, 0),
                    slot_duration_minutes=20,
                    buffer_time_minutes=5,
                    is_active=True
                )
                db.add(sched)
                await db.flush()

                d_break = DoctorBreak(
                    schedule_id=sched.id,
                    break_name="Lunch Break",
                    start_time=time(12, 0),
                    end_time=time(13, 0)
                )
                db.add(d_break)

    await db.commit()
    await db.refresh(staff)

    return StaffResponse(
        id=staff.id,
        user_id=user.id,
        clinic_id=tenant.clinic_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        role=staff.role,
        designation=staff.designation,
        department=staff.department,
        is_active=staff.is_active,
        created_at=staff.created_at,
        doctor_id=doctor_obj.id if doctor_obj else None,
        specialization=doctor_obj.specialization if doctor_obj else staff.department,
        specialty=doctor_obj.specialization if doctor_obj else staff.department,
        qualifications=doctor_obj.qualifications if doctor_obj else staff.designation,
        degrees=doctor_obj.qualifications if doctor_obj else staff.designation,
        chamber_location=doctor_obj.chamber_location if doctor_obj else None,
        visiting_days=doctor_obj.visiting_days if doctor_obj else None,
        visiting_hours=doctor_obj.visiting_hours if doctor_obj else None,
        consultation_fee=float(doctor_obj.consultation_fee) if doctor_obj and doctor_obj.consultation_fee is not None else None,
        follow_up_fee=float(doctor_obj.follow_up_fee) if doctor_obj and doctor_obj.follow_up_fee is not None else None,
        is_available_for_booking=doctor_obj.is_available_for_booking if doctor_obj else None
    )


@router.put("/staff/{staff_id}/doctor-fee", response_model=StaffResponse)
async def update_staff_doctor_fee(
    staff_id: uuid.UUID,
    request: DoctorFeeUpdate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Updates doctor consultation and follow-up fees, specialization, and availability status."""
    staff_stmt = (
        select(ClinicStaff)
        .where(
            ClinicStaff.id == staff_id,
            ClinicStaff.clinic_id == tenant.clinic_id
        )
        .options(selectinload(ClinicStaff.user))
    )
    staff_res = await db.execute(staff_stmt)
    staff = staff_res.scalar_one_or_none()

    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")

    if staff.role == ClinicRole.NURSE:
        np_stmt = select(NurseProfile).where(NurseProfile.user_id == staff.user_id)
        np_res = await db.execute(np_stmt)
        nurse_p = np_res.scalar_one_or_none()
        if not nurse_p:
            nurse_p = NurseProfile(
                clinic_id=tenant.clinic_id,
                user_id=staff.user_id,
                full_name=f"Nurse {staff.user.first_name} {staff.user.last_name}".strip(),
                phone=staff.user.phone or "01700000000",
                email=staff.user.email,
                education=request.qualifications or request.degrees or "B.Sc in Nursing",
                experience_years="5+ years",
                service_location=request.chamber_location or "Dhaka Central",
                service_fee_bdt=request.consultation_fee,
                bio="Dedicated registered home care nurse.",
                is_available=True if request.is_available_for_booking is None else request.is_available_for_booking
            )
            db.add(nurse_p)
        else:
            if request.consultation_fee is not None:
                nurse_p.service_fee_bdt = request.consultation_fee
            if request.chamber_location is not None:
                nurse_p.service_location = request.chamber_location
            if request.degrees or request.qualifications:
                nurse_p.education = request.degrees or request.qualifications
            if request.is_available_for_booking is not None:
                nurse_p.is_available = request.is_available_for_booking
        await db.commit()
        await db.refresh(staff)
        return StaffResponse(
            id=staff.id,
            user_id=staff.user_id,
            clinic_id=tenant.clinic_id,
            email=staff.user.email,
            first_name=staff.user.first_name,
            last_name=staff.user.last_name,
            role=staff.role,
            designation=nurse_p.education,
            department=f"Home Care ({nurse_p.service_location})",
            is_active=staff.is_active,
            created_at=staff.created_at,
            doctor_id=None,
            specialization=f"Home Care ({nurse_p.service_location})",
            specialty=f"Home Care ({nurse_p.service_location})",
            qualifications=nurse_p.education,
            degrees=nurse_p.education,
            chamber_location=nurse_p.service_location,
            visiting_days="Daily Shifts",
            visiting_hours="Morning / Evening / 24hr",
            consultation_fee=float(nurse_p.service_fee_bdt),
            follow_up_fee=0.0,
            is_available_for_booking=nurse_p.is_available
        )

    # Fetch or auto-create doctor profile
    doc_stmt = select(DoctorProfile).where(
        DoctorProfile.clinic_id == tenant.clinic_id,
        DoctorProfile.staff_id == staff.id
    )
    doc_res = await db.execute(doc_stmt)
    doctor = doc_res.scalar_one_or_none()

    if not doctor:
        # Check by user_id
        u_doc_stmt = select(DoctorProfile).where(
            DoctorProfile.clinic_id == tenant.clinic_id,
            DoctorProfile.user_id == staff.user_id
        )
        u_doc_res = await db.execute(u_doc_stmt)
        doctor = u_doc_res.scalar_one_or_none()

    if not doctor:
        # Create doctor profile
        spec = request.specialization or request.specialty or staff.department or "General Medicine"
        quals = request.degrees or request.qualifications or "MBBS, MD"
        doctor = DoctorProfile(
            clinic_id=tenant.clinic_id,
            user_id=staff.user_id,
            staff_id=staff.id,
            specialization=spec,
            license_number=f"MED-{staff.id.hex[:6].upper()}",
            qualifications=quals,
            chamber_location=request.chamber_location or "Room 101, Main Building",
            visiting_days=request.visiting_days or "Sat - Thu",
            visiting_hours=request.visiting_hours or "5:00 PM - 9:00 PM",
            experience_years=5,
            consultation_fee=request.consultation_fee,
            follow_up_fee=request.follow_up_fee,
            follow_up_validity_days=14,
            bio=f"Medical specialist in {spec}.",
            is_available_for_booking=True if request.is_available_for_booking is None else request.is_available_for_booking
        )
        db.add(doctor)
    else:
        doctor.consultation_fee = request.consultation_fee
        doctor.follow_up_fee = request.follow_up_fee
        spec = request.specialization or request.specialty
        if spec:
            doctor.specialization = spec
            staff.department = spec
        quals = request.degrees or request.qualifications
        if quals:
            doctor.qualifications = quals
        if request.chamber_location is not None:
            doctor.chamber_location = request.chamber_location
        if request.visiting_days is not None:
            doctor.visiting_days = request.visiting_days
        if request.visiting_hours is not None:
            doctor.visiting_hours = request.visiting_hours
        if request.is_available_for_booking is not None:
            doctor.is_available_for_booking = request.is_available_for_booking

    await db.commit()
    await db.refresh(staff)
    await db.refresh(doctor)

    return StaffResponse(
        id=staff.id,
        user_id=staff.user_id,
        clinic_id=tenant.clinic_id,
        email=staff.user.email,
        first_name=staff.user.first_name,
        last_name=staff.user.last_name,
        role=staff.role,
        designation=staff.designation,
        department=staff.department,
        is_active=staff.is_active,
        created_at=staff.created_at,
        doctor_id=doctor.id,
        specialization=doctor.specialization,
        specialty=doctor.specialization,
        qualifications=doctor.qualifications,
        degrees=doctor.qualifications,
        chamber_location=doctor.chamber_location,
        visiting_days=doctor.visiting_days,
        visiting_hours=doctor.visiting_hours,
        consultation_fee=float(doctor.consultation_fee),
        follow_up_fee=float(doctor.follow_up_fee),
        is_available_for_booking=doctor.is_available_for_booking
    )
