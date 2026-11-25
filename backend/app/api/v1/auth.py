"""Authentication and Tenant-Switching API Endpoints."""
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token, create_refresh_token, decode_token
)
from app.core.deps import get_current_user
from app.models.user import User, ClinicStaff, SystemRole, ClinicRole
from app.models.tenant import Clinic
from app.models.patient import Patient, Gender, BloodGroup
from app.models.doctor import DoctorProfile
from app.schemas.auth import (
    LoginRequest, RegisterUserRequest, TokenResponse, UserResponse,
    RefreshTokenRequest, ClinicMembershipInfo, PatientSelfRegisterRequest, ProfileUpdateRequest
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def format_user_response(user: User) -> UserResponse:
    """Helper to convert User model with clinic memberships into UserResponse."""
    memberships = []
    for m in user.clinic_memberships:
        if m.clinic:
            memberships.append(
                ClinicMembershipInfo(
                    clinic_id=m.clinic_id,
                    clinic_name=m.clinic.name,
                    clinic_slug=m.clinic.slug,
                    role=m.role,
                    designation=m.designation,
                    is_active=m.is_active
                )
            )
    return UserResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        avatar_url=user.avatar_url,
        system_role=user.system_role,
        is_active=user.is_active,
        clinic_memberships=memberships,
        created_at=user.created_at
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterUserRequest, db: AsyncSession = Depends(get_db)):
    """Registers a new base user account."""
    existing_stmt = select(User).where(User.email == request.email)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists"
        )

    user = User(
        email=request.email,
        hashed_password=hash_password(request.password),
        first_name=request.first_name,
        last_name=request.last_name,
        phone=request.phone,
        system_role=request.system_role,
        is_active=True,
        is_email_verified=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    stmt = select(User).where(User.id == user.id).options(selectinload(User.clinic_memberships))
    res = await db.execute(stmt)
    user = res.scalar_one()

    return format_user_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Authenticates credentials and returns JWT access and refresh tokens."""
    stmt = (
        select(User)
        .where(User.email == request.email)
        .options(
            selectinload(User.clinic_memberships).selectinload(ClinicStaff.clinic)
        )
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended. Please contact your clinic administrator."
        )

    active_memberships = [m for m in user.clinic_memberships if m.is_active]
    default_clinic_id = active_memberships[0].clinic_id if active_memberships else None

    if not default_clinic_id:
        pat_res = await db.execute(select(Patient.clinic_id).where(Patient.user_id == user.id).limit(1))
        default_clinic_id = pat_res.scalar_one_or_none()

    if not default_clinic_id:
        c_res = await db.execute(select(Clinic.id).where(Clinic.is_active == True).limit(1))
        default_clinic_id = c_res.scalar_one_or_none()

    claims = {
        "email": user.email,
        "system_role": user.system_role.value,
        "active_clinic_id": str(default_clinic_id) if default_clinic_id else None
    }

    access_token = create_access_token(subject=str(user.id), claims=claims)
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=format_user_response(user),
        active_clinic_id=default_clinic_id
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refreshes expired access tokens using a valid refresh token."""
    try:
        payload = decode_token(request.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = uuid.UUID(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    stmt = select(User).where(User.id == user_id, User.is_active == True).options(
        selectinload(User.clinic_memberships).selectinload(ClinicStaff.clinic)
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    active_memberships = [m for m in user.clinic_memberships if m.is_active]
    default_clinic_id = active_memberships[0].clinic_id if active_memberships else None

    if not default_clinic_id:
        pat_res = await db.execute(select(Patient.clinic_id).where(Patient.user_id == user.id).limit(1))
        default_clinic_id = pat_res.scalar_one_or_none()

    if not default_clinic_id:
        c_res = await db.execute(select(Clinic.id).where(Clinic.is_active == True).limit(1))
        default_clinic_id = c_res.scalar_one_or_none()

    claims = {
        "email": user.email,
        "system_role": user.system_role.value,
        "active_clinic_id": str(default_clinic_id) if default_clinic_id else None
    }

    new_access_token = create_access_token(subject=str(user.id), claims=claims)
    new_refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=format_user_response(user),
        active_clinic_id=default_clinic_id
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Returns the authenticated user profile with active tenant memberships."""
    stmt = select(User).where(User.id == current_user.id).options(
        selectinload(User.clinic_memberships).selectinload(ClinicStaff.clinic)
    )
    res = await db.execute(stmt)
    user = res.scalar_one()
    return format_user_response(user)


@router.post("/patient-register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def patient_register(request: PatientSelfRegisterRequest, db: AsyncSession = Depends(get_db)):
    """Registers a new patient account and automatically returns JWT session."""
    import datetime
    import random

    existing_stmt = select(User).where(User.email == request.email)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists"
        )

    if request.phone:
        p_stmt = select(User).where(User.phone == request.phone)
        p_res = await db.execute(p_stmt)
        if p_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this phone number already exists"
            )

    c_res = await db.execute(select(Clinic).limit(1))
    clinic = c_res.scalar_one_or_none()
    clinic_id = clinic.id if clinic else None

    first_name = (request.first_name or "").strip()
    last_name = (request.last_name or "").strip()
    if not first_name:
        parts = (request.full_name or "Patient User").strip().split(" ")
        first_name = parts[0]
        last_name = " ".join(parts[1:]) if len(parts) > 1 else "User"
    if not last_name:
        last_name = "User"

    user = User(
        email=request.email,
        phone=request.phone,
        hashed_password=hash_password(request.password),
        first_name=first_name,
        last_name=last_name,
        system_role=SystemRole.PATIENT,
        is_active=True,
        is_email_verified=True
    )
    db.add(user)
    await db.flush()

    today = datetime.date.today()
    birth_year = today.year - (request.age or 30)
    calculated_dob = datetime.date(birth_year, 1, 1)

    resolved_gender = Gender.MALE
    req_gender_str = str(getattr(request.gender, "value", request.gender) or "MALE").upper()
    if req_gender_str == "FEMALE":
        resolved_gender = Gender.FEMALE
    elif req_gender_str == "OTHER":
        resolved_gender = Gender.OTHER

    bg_map = {
        "A+": BloodGroup.A_POSITIVE, "A-": BloodGroup.A_NEGATIVE,
        "B+": BloodGroup.B_POSITIVE, "B-": BloodGroup.B_NEGATIVE,
        "AB+": BloodGroup.AB_POSITIVE, "AB-": BloodGroup.AB_NEGATIVE,
        "O+": BloodGroup.O_POSITIVE, "O-": BloodGroup.O_NEGATIVE,
    }
    req_bg_str = str(getattr(request.blood_group, "value", request.blood_group) or "O+").upper()
    resolved_bg = bg_map.get(req_bg_str, BloodGroup.O_POSITIVE)
    mrn = f"MRN-{today.year}-{random.randint(10000, 99999)}"

    if clinic_id:
        patient = Patient(
            clinic_id=clinic_id,
            user_id=user.id,
            mrn=mrn,
            first_name=first_name,
            last_name=last_name,
            date_of_birth=calculated_dob,
            gender=resolved_gender,
            blood_group=resolved_bg,
            email=request.email,
            phone=request.phone,
            address_line=request.address or "Dhaka, Bangladesh",
            allergies=[],
            chronic_conditions=[]
        )
        db.add(patient)

    await db.commit()

    stmt = select(User).where(User.id == user.id).options(
        selectinload(User.clinic_memberships).selectinload(ClinicStaff.clinic)
    )
    res = await db.execute(stmt)
    user = res.scalar_one()

    claims = {
        "email": user.email,
        "system_role": user.system_role.value,
        "active_clinic_id": str(clinic_id) if clinic_id else None
    }
    access_token = create_access_token(subject=str(user.id), claims=claims)
    refresh_token = create_refresh_token(subject=str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=format_user_response(user),
        active_clinic_id=clinic_id
    )


@router.get("/profile")
async def get_profile(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Returns profile with patient or doctor details."""
    user_stmt = select(User).where(User.id == current_user.id).options(
        selectinload(User.clinic_memberships).selectinload(ClinicStaff.clinic)
    )
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one()

    patient_stmt = select(Patient).where(Patient.user_id == current_user.id)
    p_res = await db.execute(patient_stmt)
    patient = p_res.scalar_one_or_none()

    doc_stmt = select(DoctorProfile).where(DoctorProfile.user_id == current_user.id)
    d_res = await db.execute(doc_stmt)
    doctor = d_res.scalar_one_or_none()

    return {
        "user": format_user_response(user),
        "patient": {
            "id": str(patient.id),
            "mrn": patient.mrn,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            "gender": patient.gender.value if patient.gender else None,
            "blood_group": patient.blood_group.value if patient.blood_group else None,
            "email": patient.email,
            "phone": patient.phone,
            "address_line": patient.address_line,
            "allergies": patient.allergies or [],
            "chronic_conditions": patient.chronic_conditions or [],
            "notes": patient.notes
        } if patient else None,
        "doctor": {
            "id": str(doctor.id),
            "specialization": doctor.specialization,
            "qualifications": doctor.qualifications,
            "license_number": doctor.license_number,
            "experience_years": doctor.experience_years,
            "consultation_fee": float(doctor.consultation_fee) if doctor.consultation_fee is not None else 0.0,
            "follow_up_fee": float(doctor.follow_up_fee) if doctor.follow_up_fee is not None else 0.0,
            "bio": doctor.bio,
            "signature_image_url": doctor.signature_image_url
        } if doctor else None
    }


@router.put("/profile")
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Updates user information and patient/doctor specific details."""
    import datetime
    user = await db.get(User, current_user.id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if request.first_name:
        user.first_name = request.first_name
    if request.last_name:
        user.last_name = request.last_name
    if request.phone:
        user.phone = request.phone
    if request.avatar_url is not None:
        if request.avatar_url.startswith("data:image/"):
            import os, time, base64
            upload_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "uploads", "avatars")
            os.makedirs(upload_dir, exist_ok=True)
            header, base64_data = request.avatar_url.split(",", 1)
            ext = ".jpg" if "jpeg" in header or "jpg" in header else ".png"
            filename = f"user_{current_user.id}_{int(time.time())}{ext}"
            filepath = os.path.join(upload_dir, filename)
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(base64_data))
            user.avatar_url = f"/uploads/avatars/{filename}"
        else:
            user.avatar_url = request.avatar_url

    p_stmt = select(Patient).where(Patient.user_id == current_user.id)
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()

    if patient:
        if request.first_name:
            patient.first_name = request.first_name
        if request.last_name:
            patient.last_name = request.last_name
        if request.phone:
            patient.phone = request.phone
        if request.address_line is not None:
            patient.address_line = request.address_line
        if request.allergies is not None:
            patient.allergies = request.allergies
        if request.date_of_birth:
            try:
                patient.date_of_birth = datetime.date.fromisoformat(request.date_of_birth)
            except Exception:
                pass
        if request.gender:
            if request.gender.upper() == "FEMALE":
                patient.gender = Gender.FEMALE
            elif request.gender.upper() == "MALE":
                patient.gender = Gender.MALE
            else:
                patient.gender = Gender.OTHER
        if request.blood_group:
            bg_map = {
                "A+": BloodGroup.A_POSITIVE, "A-": BloodGroup.A_NEGATIVE,
                "B+": BloodGroup.B_POSITIVE, "B-": BloodGroup.B_NEGATIVE,
                "AB+": BloodGroup.AB_POSITIVE, "AB-": BloodGroup.AB_NEGATIVE,
                "O+": BloodGroup.O_POSITIVE, "O-": BloodGroup.O_NEGATIVE,
            }
            if request.blood_group.upper() in bg_map:
                patient.blood_group = bg_map[request.blood_group.upper()]

    d_stmt = select(DoctorProfile).where(
        (DoctorProfile.user_id == current_user.id) |
        (DoctorProfile.staff_id.in_(select(ClinicStaff.id).where(ClinicStaff.user_id == current_user.id)))
    )
    d_res = await db.execute(d_stmt)
    doctor = d_res.scalar_one_or_none()

    if doctor:
        if user.avatar_url is not None:
            doctor.avatar_url = user.avatar_url
        if request.specialization:
            doctor.specialization = request.specialization
        if request.qualifications:
            doctor.qualifications = request.qualifications
        if request.license_number:
            doctor.license_number = request.license_number
        if request.consultation_fee is not None:
            doctor.consultation_fee = request.consultation_fee
        if request.bio is not None:
            doctor.bio = request.bio
        if request.signature_image_url is not None:
            doctor.signature_image_url = request.signature_image_url

    await db.commit()
    await db.refresh(user)

    return await get_profile(current_user=user, db=db)

