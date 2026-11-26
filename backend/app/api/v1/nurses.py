"""Nurse Profiles and Home Care Nursing Service API Endpoints."""
import os
import time
import base64
import uuid
from typing import Optional, List, Union, Any
from datetime import date, datetime, timezone
from pydantic import BaseModel, Field, EmailStr, model_validator
from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, File, Form, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.models.user import User, ClinicStaff, SystemRole, ClinicRole
from app.models.patient import Patient
from app.models.tenant import Clinic
from app.models.nurse import NurseProfile, NurseBooking, NurseBookingStatus, NurseReview
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, InvoiceItemType

router = APIRouter(tags=["Home Care Nurses & Bookings"])


# ------------------------------------------------------------------------------
# Schemas
# ------------------------------------------------------------------------------
class NurseProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    clinic_id: Optional[uuid.UUID] = None
    full_name: str
    phone: str
    email: str
    avatar_url: Optional[str] = None
    education: str
    experience_years: str
    service_location: str
    service_fee_bdt: float
    hourly_rate_bdt: float = 300.0
    bio: Optional[str] = None
    is_available: bool
    average_rating: float = 0.0
    total_reviews: int = 0

    class Config:
        from_attributes = True


class UpdateNurseProfileRequest(BaseModel):
    phone: Optional[str] = None
    bio: Optional[str] = None
    service_location: Optional[str] = None
    education: Optional[str] = None
    experience_years: Optional[str] = None
    service_fee_bdt: Optional[float] = None
    is_available: Optional[bool] = None
    avatar_url: Optional[str] = None


class CreateNurseRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone: str
    education: str
    experience_years: str
    service_location: str
    service_fee_bdt: float = 1200.0
    bio: Optional[str] = None
    avatar_url: Optional[str] = None


class CreateNurseBookingRequest(BaseModel):
    nurse_id: uuid.UUID
    service_date: Union[date, str]
    shift_time: Optional[str] = None
    shift_details: Optional[str] = None
    shift: Optional[str] = None
    contracted_hours: Optional[float] = 4.0
    hours: Optional[float] = None
    patient_address: Optional[str] = None
    address: Optional[str] = None
    service_address: Optional[str] = None
    care_notes: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # shift_time alias support
            if not data.get("shift_time"):
                data["shift_time"] = data.get("shift_details") or data.get("shift") or "Day Shift (8:00 AM - 4:00 PM)"

            # contracted_hours alias support
            if data.get("contracted_hours") is None and data.get("hours") is not None:
                data["contracted_hours"] = data.get("hours")
            try:
                data["contracted_hours"] = float(data.get("contracted_hours") or 4.0)
            except (ValueError, TypeError):
                data["contracted_hours"] = 4.0

            # patient_address alias support
            if not data.get("patient_address"):
                data["patient_address"] = data.get("address") or data.get("service_address") or data.get("location") or "Dhaka, Bangladesh"

            # care_notes alias support
            if not data.get("care_notes") and data.get("notes"):
                data["care_notes"] = data.get("notes")

            # service_date parsing if string
            sd = data.get("service_date")
            if isinstance(sd, str):
                try:
                    data["service_date"] = date.fromisoformat(sd.strip())
                except Exception:
                    pass
        return data


class NurseBookingResponse(BaseModel):
    id: uuid.UUID
    booking_code: str
    nurse_id: uuid.UUID
    patient_id: uuid.UUID
    invoice_id: Optional[uuid.UUID] = None
    invoice_number: Optional[str] = None
    service_date: date
    shift_time: str
    patient_address: str
    care_notes: Optional[str] = None
    fee_bdt: float
    status: str
    created_at: datetime
    nurse_name: Optional[str] = None
    nurse_phone: Optional[str] = None
    nurse_location: Optional[str] = None
    nurse_avatar: Optional[str] = None
    patient_name: Optional[str] = None
    patient_phone: Optional[str] = None
    payment_status: Optional[str] = "Due"
    contracted_hours: float = 4.0
    hourly_rate_bdt: float = 300.0
    duty_status: str = "Awaiting Payment"
    duty_started_at: Optional[datetime] = None
    duty_ended_at: Optional[datetime] = None
    actual_worked_minutes: int = 0
    overtime_hours: float = 0.0
    overtime_due_bdt: float = 0.0
    overtime_invoice_id: Optional[uuid.UUID] = None
    overtime_invoice_number: Optional[str] = None
    has_reviewed: bool = False
    submitted_rating: Optional[int] = None
    submitted_comment: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateNurseBookingStatusRequest(BaseModel):
    status: str = Field(..., description="Confirmed, Completed, or Cancelled")


class CreateNurseReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="1 to 5 star rating")
    comment: Optional[str] = Field(None, max_length=1000, description="Optional patient review")


class NurseReviewResponse(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    nurse_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    rating: int
    comment: Optional[str] = None
    average_rating: float
    total_reviews: int
    created_at: datetime


# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def map_nurse_profile_response(nurse: NurseProfile, stats: Optional[dict] = None) -> NurseProfileResponse:
    rate = float(nurse.service_fee_bdt)
    hourly = round(rate / 4.0, 2) if rate >= 600 else rate
    avg_r = float(stats["avg"] if stats and "avg" in stats else getattr(nurse, "average_rating", 0.0) or 0.0)
    tot_r = int(stats["count"] if stats and "count" in stats else getattr(nurse, "total_reviews", 0) or 0)
    return NurseProfileResponse(
        id=nurse.id,
        user_id=nurse.user_id,
        clinic_id=nurse.clinic_id,
        full_name=nurse.full_name,
        phone=nurse.phone,
        email=nurse.email,
        avatar_url=nurse.avatar_url,
        education=nurse.education,
        experience_years=nurse.experience_years,
        service_location=nurse.service_location,
        service_fee_bdt=rate,
        hourly_rate_bdt=hourly,
        bio=nurse.bio,
        is_available=nurse.is_available,
        average_rating=round(avg_r, 1),
        total_reviews=tot_r
    )


def map_booking_response(b: NurseBooking, review: Optional[NurseReview] = None) -> NurseBookingResponse:
    rev = review if review is not None else getattr(b, "review", None)
    has_rev = rev is not None
    sub_rating = rev.rating if rev else None
    sub_comment = rev.comment if rev else None
    return NurseBookingResponse(
        id=b.id,
        booking_code=b.booking_code,
        nurse_id=b.nurse_id,
        patient_id=b.patient_id,
        invoice_id=b.invoice_id,
        invoice_number=b.invoice.invoice_number if b.invoice else None,
        service_date=b.service_date,
        shift_time=b.shift_time,
        patient_address=b.patient_address,
        care_notes=b.care_notes,
        fee_bdt=float(b.fee_bdt or 0.0),
        status=b.status,
        created_at=b.created_at,
        nurse_name=b.nurse.full_name if b.nurse else None,
        nurse_phone=b.nurse.phone if b.nurse else None,
        nurse_location=b.nurse.service_location if b.nurse else None,
        nurse_avatar=b.nurse.avatar_url if b.nurse else None,
        patient_name=f"{b.patient.first_name} {b.patient.last_name}" if b.patient else None,
        patient_phone=b.patient.phone if b.patient else None,
        payment_status=b.payment_status or (b.invoice.payment_status if b.invoice else "Due"),
        contracted_hours=float(b.contracted_hours or 4.0),
        hourly_rate_bdt=float(b.hourly_rate_bdt or 300.0),
        duty_status=b.duty_status or "Awaiting Payment",
        duty_started_at=b.duty_started_at,
        duty_ended_at=b.duty_ended_at,
        actual_worked_minutes=int(b.actual_worked_minutes or 0),
        overtime_hours=float(b.overtime_hours or 0.0),
        overtime_due_bdt=float(b.overtime_due_bdt or 0.0),
        overtime_invoice_id=b.overtime_invoice_id,
        overtime_invoice_number=b.overtime_invoice.invoice_number if getattr(b, "overtime_invoice", None) else None,
        has_reviewed=has_rev,
        submitted_rating=sub_rating,
        submitted_comment=sub_comment
    )


# ------------------------------------------------------------------------------
# 1. Public Nurse Endpoints
# ------------------------------------------------------------------------------
@router.get("/public/nurses", response_model=List[NurseProfileResponse])
async def list_public_nurses(
    location: Optional[str] = Query(None, description="Filter by area or location"),
    db: AsyncSession = Depends(get_db)
):
    """Public endpoint returning all available nurses, filterable by location."""
    stmt = select(NurseProfile).where(NurseProfile.is_available == True)
    if location and location.strip():
        loc_term = f"%{location.strip()}%"
        stmt = stmt.where(NurseProfile.service_location.ilike(loc_term))

    stmt = stmt.order_by(NurseProfile.full_name.asc())
    res = await db.execute(stmt)
    profiles = res.scalars().all()

    # Aggregate rating stats per nurse
    rev_stats_stmt = (
        select(
            NurseReview.nurse_id,
            func.coalesce(func.avg(NurseReview.rating), 0.0).label("avg"),
            func.count(NurseReview.id).label("cnt")
        )
        .group_by(NurseReview.nurse_id)
    )
    rev_stats_res = await db.execute(rev_stats_stmt)
    stats_map = {row.nurse_id: {"avg": float(row.avg), "count": int(row.cnt)} for row in rev_stats_res}

    return [map_nurse_profile_response(p, stats_map.get(p.id)) for p in profiles]


@router.get("/public/nurses/{id}", response_model=NurseProfileResponse)
async def get_public_nurse(id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Public endpoint returning nurse details by ID."""
    stmt = select(NurseProfile).where(NurseProfile.id == id)
    res = await db.execute(stmt)
    nurse = res.scalar_one_or_none()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse profile not found")

    stats_stmt = select(
        func.coalesce(func.avg(NurseReview.rating), 0.0),
        func.count(NurseReview.id)
    ).where(NurseReview.nurse_id == nurse.id)
    stats_res = await db.execute(stats_stmt)
    avg_r, cnt_r = stats_res.one()
    return map_nurse_profile_response(nurse, {"avg": float(avg_r), "count": int(cnt_r)})


# ------------------------------------------------------------------------------
# 2. Super Admin Nurse Creation
# ------------------------------------------------------------------------------
@router.post("/admin/nurses", response_model=NurseProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_nurse_account(
    req: CreateNurseRequest,
    current_user: User = Depends(require_roles([SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Super Admin creates a Nurse user account and NurseProfile."""
    # Check email duplicate
    existing_stmt = select(User).where(User.email == req.email)
    existing_res = await db.execute(existing_stmt)
    if existing_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with this email already exists")

    # Get active clinic
    c_res = await db.execute(select(Clinic).limit(1))
    clinic = c_res.scalar_one_or_none()
    clinic_id = clinic.id if clinic else None

    # Create User
    user = User(
        email=req.email,
        hashed_password=hash_password(req.password),
        first_name=req.first_name,
        last_name=req.last_name,
        phone=req.phone,
        system_role=SystemRole.NURSE,
        is_active=True,
        is_email_verified=True,
        avatar_url=req.avatar_url
    )
    db.add(user)
    await db.flush()

    # Link ClinicStaff if clinic exists
    if clinic_id:
        staff = ClinicStaff(
            clinic_id=clinic_id,
            user_id=user.id,
            role=ClinicRole.NURSE,
            designation="Registered Home Care Nurse",
            department="Home Nursing",
            is_active=True
        )
        db.add(staff)
        await db.flush()

    # Create NurseProfile
    profile = NurseProfile(
        clinic_id=clinic_id,
        user_id=user.id,
        full_name=f"Nurse {req.first_name} {req.last_name}".strip(),
        phone=req.phone,
        email=req.email,
        avatar_url=req.avatar_url,
        education=req.education,
        experience_years=req.experience_years,
        service_location=req.service_location,
        service_fee_bdt=req.service_fee_bdt,
        bio=req.bio,
        is_available=True
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return map_nurse_profile_response(profile)


# ------------------------------------------------------------------------------
# 3. Patient Booking Endpoint (Auth-Gated, with Contracted Hours)
# ------------------------------------------------------------------------------
@router.post("/nurse-bookings", response_model=NurseBookingResponse, status_code=status.HTTP_201_CREATED)
async def book_nurse(
    req: CreateNurseBookingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Patient books a nurse for a date/time/address and contracted duration;
    generates initial Nurse Care Service Invoice with payment_status = 'Due'
    and sets duty_status = 'Awaiting Payment'.
    """
    # Find nurse
    n_stmt = select(NurseProfile).where(NurseProfile.id == req.nurse_id)
    n_res = await db.execute(n_stmt)
    nurse = n_res.scalar_one_or_none()
    if not nurse:
        raise HTTPException(status_code=404, detail="Selected nurse profile not found")

    # Resolve normalized request values
    if isinstance(req.service_date, str):
        try:
            parsed_service_date = date.fromisoformat(req.service_date.strip())
        except Exception:
            parsed_service_date = date.today()
    else:
        parsed_service_date = req.service_date or date.today()

    resolved_address = req.patient_address or "Dhaka, Bangladesh"
    shift_time = req.shift_time or "Day Shift (8:00 AM - 4:00 PM)"
    contracted_hours = float(req.contracted_hours or 4.0)

    # Find or auto-register patient profile for this user
    p_stmt = select(Patient).where(Patient.user_id == current_user.id, Patient.is_deleted == False)
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()

    if not patient:
        c_res = await db.execute(select(Clinic).limit(1))
        clinic = c_res.scalar_one_or_none()
        clinic_id = nurse.clinic_id or (clinic.id if clinic else None)
        if not clinic_id:
            clinic = Clinic(name="Mir Health Hospital", code="CLINIC-01", is_active=True)
            db.add(clinic)
            await db.flush()
            clinic_id = clinic.id

        count_res = await db.execute(select(func.count(Patient.id)))
        total_p = (count_res.scalar() or 0) + 1
        current_year = datetime.now().strftime("%Y")
        mrn = f"MRN-{current_year}-{total_p:05d}"

        first_name = current_user.first_name or "Patient"
        last_name = current_user.last_name or str(current_user.id)[:8]
        phone = current_user.phone or "01700000000"
        email = current_user.email

        from app.models.patient import Gender, BloodGroup
        patient = Patient(
            clinic_id=clinic_id,
            user_id=current_user.id,
            mrn=mrn,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            email=email,
            address_line=resolved_address,
            city="Dhaka",
            gender=Gender.OTHER,
            blood_group=BloodGroup.UNKNOWN,
            date_of_birth=date(1995, 1, 1),
            is_deleted=False
        )
        db.add(patient)
        await db.flush()

    # Generate sequential booking code
    b_count_res = await db.execute(select(func.count(NurseBooking.id)))
    b_total = (b_count_res.scalar() or 0) + 1
    booking_code = f"NRS-{datetime.now().strftime('%Y')}-{b_total:04d}"

    # Generate sequential invoice code
    i_count_res = await db.execute(select(func.count(Invoice.id)))
    i_total = (i_count_res.scalar() or 0) + 1
    invoice_number = f"INV-NRS-{datetime.now().strftime('%Y%m')}-{i_total:04d}"

    # Calculate contracted duration and hourly rate
    hourly_rate_bdt = round(float(nurse.service_fee_bdt) / 4.0, 2) if float(nurse.service_fee_bdt) >= 600 else float(nurse.service_fee_bdt)
    initial_total_bdt = round(contracted_hours * hourly_rate_bdt, 2)
    clinic_id = nurse.clinic_id or patient.clinic_id

    # Create Invoice with payment_status = "Due"
    invoice = Invoice(
        clinic_id=clinic_id,
        patient_id=patient.id,
        invoice_number=invoice_number,
        status=InvoiceStatus.ISSUED,
        issue_date=date.today(),
        due_date=parsed_service_date,
        subtotal=initial_total_bdt,
        discount_amount=0.00,
        tax_rate_percent=0.00,
        tax_amount=0.00,
        total_amount=initial_total_bdt,
        paid_amount=0.00,
        balance_amount=initial_total_bdt,
        notes=f"Home Care Nursing by {nurse.full_name} on {parsed_service_date} ({shift_time}, {contracted_hours}h). Address: {resolved_address}",
        bill_type="Nurse Care Service",
        description=f"Home Nursing Care - {nurse.full_name} ({contracted_hours} hrs @ ৳{hourly_rate_bdt}/hr)",
        amount_bdt=initial_total_bdt,
        paid_amount_bdt=0.00,
        due_amount_bdt=initial_total_bdt,
        payment_status="Due"
    )
    db.add(invoice)
    await db.flush()

    # Create Invoice Item
    item = InvoiceItem(
        invoice_id=invoice.id,
        item_type=InvoiceItemType.OTHER,
        description=f"Home Care Nursing - {nurse.full_name} ({contracted_hours}h @ ৳{hourly_rate_bdt}/hr)",
        quantity=int(contracted_hours) if contracted_hours.is_integer() else contracted_hours,
        unit_price=hourly_rate_bdt,
        total_price=initial_total_bdt
    )
    db.add(item)
    await db.flush()

    # Create NurseBooking with duty_status = 'Awaiting Payment'
    booking = NurseBooking(
        clinic_id=clinic_id,
        booking_code=booking_code,
        nurse_id=nurse.id,
        patient_id=patient.id,
        invoice_id=invoice.id,
        service_date=parsed_service_date,
        shift_time=shift_time,
        patient_address=resolved_address,
        care_notes=req.care_notes,
        fee_bdt=initial_total_bdt,
        contracted_hours=contracted_hours,
        hourly_rate_bdt=hourly_rate_bdt,
        payment_status="Due",
        duty_status="Awaiting Payment",
        status="Pending"
    )
    db.add(booking)
    await db.flush()

    # Link invoice back to booking
    invoice.nurse_booking_id = booking.id

    # Commit cleanly in a single transaction
    await db.commit()
    await db.refresh(booking)

    # Reload relationships
    b_stmt = (
        select(NurseBooking)
        .where(NurseBooking.id == booking.id)
        .options(
            selectinload(NurseBooking.nurse),
            selectinload(NurseBooking.patient),
            selectinload(NurseBooking.invoice),
            selectinload(NurseBooking.overtime_invoice)
        )
    )
    loaded_booking = (await db.execute(b_stmt)).scalar_one()
    return map_booking_response(loaded_booking)


# ------------------------------------------------------------------------------
# 4. Patient View Own Nurse Bookings & Submit Review
# ------------------------------------------------------------------------------
@router.get("/nurse-bookings/patient", response_model=List[NurseBookingResponse])
@router.get("/patient/me/nurse-bookings", response_model=List[NurseBookingResponse])
async def get_patient_nurse_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all nurse bookings for the authenticated patient."""
    p_stmt = select(Patient).where(Patient.user_id == current_user.id, Patient.is_deleted == False)
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()
    if not patient:
        p_stmt2 = select(Patient).where(
            or_(Patient.email == current_user.email, Patient.phone == current_user.phone),
            Patient.is_deleted == False
        )
        p_res2 = await db.execute(p_stmt2)
        patient = p_res2.scalars().first()
    if not patient:
        return []

    stmt = (
        select(NurseBooking)
        .where(NurseBooking.patient_id == patient.id)
        .options(
            selectinload(NurseBooking.nurse),
            selectinload(NurseBooking.patient),
            selectinload(NurseBooking.invoice),
            selectinload(NurseBooking.overtime_invoice),
            selectinload(NurseBooking.review)
        )
        .order_by(NurseBooking.created_at.desc())
    )
    res = await db.execute(stmt)
    bookings = res.scalars().all()
    return [map_booking_response(b) for b in bookings]


@router.post("/nurse-bookings/{booking_id}/review", response_model=NurseReviewResponse, status_code=status.HTTP_201_CREATED)
async def submit_nurse_review(
    booking_id: uuid.UUID,
    req: CreateNurseReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Verified Patient submits a 1-5 star rating and optional feedback review
    for a completed and paid nurse care service.
    """
    # 1. Fetch booking with nurse, patient, invoice, overtime_invoice, and review
    stmt = (
        select(NurseBooking)
        .where(NurseBooking.id == booking_id)
        .options(
            selectinload(NurseBooking.nurse),
            selectinload(NurseBooking.patient),
            selectinload(NurseBooking.invoice),
            selectinload(NurseBooking.overtime_invoice),
            selectinload(NurseBooking.review)
        )
    )
    res = await db.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Nurse booking not found")

    # 2. Check authorization
    p_stmt = select(Patient).where(Patient.user_id == current_user.id, Patient.is_deleted == False)
    p_res = await db.execute(p_stmt)
    current_patient = p_res.scalar_one_or_none()
    if not current_patient:
        p_stmt2 = select(Patient).where(
            or_(Patient.email == current_user.email, Patient.phone == current_user.phone),
            Patient.is_deleted == False
        )
        p_res2 = await db.execute(p_stmt2)
        current_patient = p_res2.scalars().first()

    if current_user.system_role != SystemRole.SUPER_ADMIN:
        if not current_patient:
            raise HTTPException(status_code=403, detail="Only registered patients can submit nurse reviews")
        if booking.patient_id != current_patient.id:
            raise HTTPException(status_code=403, detail="You can only submit reviews for your own bookings")

    # 3. Check payment status
    # Base fee payment status check
    is_base_paid = (booking.payment_status == "Paid") or (booking.invoice and (booking.invoice.payment_status == "Paid" or float(booking.invoice.due_amount_bdt or 0.0) <= 0))
    if not is_base_paid:
        raise HTTPException(
            status_code=400,
            detail="Nurse booking service payment must be completed ('Paid') before submitting a review"
        )

    # Overtime invoice check if overtime was incurred
    if float(booking.overtime_due_bdt or 0.0) > 0:
        ot_is_paid = (booking.overtime_invoice and (booking.overtime_invoice.payment_status == "Paid" or float(booking.overtime_invoice.due_amount_bdt or 0.0) <= 0))
        if not ot_is_paid:
            raise HTTPException(
                status_code=400,
                detail="Overtime fee is still pending. Please pay the overtime invoice before submitting a review"
            )

    # 4. Check if already reviewed
    if booking.review is not None:
        raise HTTPException(status_code=400, detail="A review has already been submitted for this booking")

    exist_check = await db.execute(select(NurseReview).where(NurseReview.booking_id == booking.id))
    if exist_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A review has already been submitted for this booking")

    # 5. Resolve patient display name
    p_name = None
    if booking.patient:
        p_name = f"{booking.patient.first_name} {booking.patient.last_name}".strip()
    elif current_patient:
        p_name = f"{current_patient.first_name} {current_patient.last_name}".strip()
    else:
        p_name = f"{current_user.first_name} {current_user.last_name}".strip() or "Verified Patient"

    # 6. Save review
    review = NurseReview(
        clinic_id=booking.clinic_id,
        booking_id=booking.id,
        nurse_id=booking.nurse_id,
        patient_id=booking.patient_id,
        patient_name=p_name,
        rating=req.rating,
        comment=req.comment.strip() if req.comment else None
    )
    db.add(review)
    await db.flush()

    # 7. Recalculate average rating & total reviews
    stats_stmt = select(
        func.coalesce(func.avg(NurseReview.rating), 0.0),
        func.count(NurseReview.id)
    ).where(NurseReview.nurse_id == booking.nurse_id)
    stats_res = await db.execute(stats_stmt)
    avg_val, cnt_val = stats_res.one()

    nurse = await db.get(NurseProfile, booking.nurse_id)
    if nurse:
        nurse.average_rating = round(float(avg_val), 1)
        nurse.total_reviews = int(cnt_val)

    await db.commit()
    await db.refresh(review)
    if nurse:
        await db.refresh(nurse)

    return NurseReviewResponse(
        id=review.id,
        booking_id=review.booking_id,
        nurse_id=review.nurse_id,
        patient_id=review.patient_id,
        patient_name=review.patient_name,
        rating=review.rating,
        comment=review.comment,
        average_rating=float(nurse.average_rating) if nurse else float(review.rating),
        total_reviews=int(nurse.total_reviews) if nurse else 1,
        created_at=review.created_at
    )


# ------------------------------------------------------------------------------
# 5. Nurse Portal: View My Bookings
# ------------------------------------------------------------------------------
@router.get("/nurse/me/bookings", response_model=List[NurseBookingResponse])
async def get_nurse_me_bookings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns assigned patient care bookings for the logged-in Nurse."""
    n_stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
    n_res = await db.execute(n_stmt)
    nurse = n_res.scalar_one_or_none()
    if not nurse:
        if current_user.system_role == SystemRole.SUPER_ADMIN:
            stmt = (
                select(NurseBooking)
                .options(
                    selectinload(NurseBooking.nurse),
                    selectinload(NurseBooking.patient),
                    selectinload(NurseBooking.invoice),
                    selectinload(NurseBooking.overtime_invoice),
                    selectinload(NurseBooking.review)
                )
                .order_by(NurseBooking.created_at.desc())
            )
            res = await db.execute(stmt)
            bookings = res.scalars().all()
            return [map_booking_response(b) for b in bookings]
        else:
            raise HTTPException(status_code=403, detail="You do not have a registered Nurse profile")

    stmt = (
        select(NurseBooking)
        .where(NurseBooking.nurse_id == nurse.id)
        .options(
            selectinload(NurseBooking.nurse),
            selectinload(NurseBooking.patient),
            selectinload(NurseBooking.invoice),
            selectinload(NurseBooking.overtime_invoice),
            selectinload(NurseBooking.review)
        )
        .order_by(NurseBooking.created_at.desc())
    )
    res = await db.execute(stmt)
    bookings = res.scalars().all()
    return [map_booking_response(b) for b in bookings]


# ------------------------------------------------------------------------------
# 6. Nurse Booking Status Update (Manual)
# ------------------------------------------------------------------------------
@router.patch("/nurse/bookings/{id}/status", response_model=NurseBookingResponse)
async def update_nurse_booking_status(
    id: uuid.UUID,
    req: UpdateNurseBookingStatusRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Nurse or Admin updates patient care booking status (Confirmed, Completed, Cancelled)."""
    stmt = (
        select(NurseBooking)
        .where(NurseBooking.id == id)
        .options(
            selectinload(NurseBooking.nurse),
            selectinload(NurseBooking.patient),
            selectinload(NurseBooking.invoice),
            selectinload(NurseBooking.overtime_invoice)
        )
    )
    res = await db.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Nurse booking not found")

    if current_user.system_role != SystemRole.SUPER_ADMIN:
        n_stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
        n_res = await db.execute(n_stmt)
        nurse = n_res.scalar_one_or_none()
        if not nurse or booking.nurse_id != nurse.id:
            raise HTTPException(status_code=403, detail="Not authorized to update this booking")

    booking.status = req.status
    if req.status == "Completed" and booking.duty_status != "Completed":
        booking.duty_status = "Completed"

    await db.commit()
    await db.refresh(booking)
    return map_booking_response(booking)


# ------------------------------------------------------------------------------
# 7. Nurse Duty Flow: Start Duty (Payment-Gated)
# ------------------------------------------------------------------------------
@router.post("/nurse/bookings/{booking_id}/start-duty", response_model=NurseBookingResponse)
async def start_nurse_duty(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Starts duty timer for the assigned nurse.
    Validates that payment_status == 'Paid' (confirmed by Receptionist).
    Sets duty_status = 'In Progress' and duty_started_at = utcnow().
    """
    stmt = (
        select(NurseBooking)
        .where(NurseBooking.id == booking_id)
        .options(
            selectinload(NurseBooking.nurse),
            selectinload(NurseBooking.patient),
            selectinload(NurseBooking.invoice),
            selectinload(NurseBooking.overtime_invoice)
        )
    )
    res = await db.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Nurse booking not found")

    # Authorize nurse
    if current_user.system_role != SystemRole.SUPER_ADMIN:
        n_stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
        n_res = await db.execute(n_stmt)
        nurse = n_res.scalar_one_or_none()
        if not nurse or booking.nurse_id != nurse.id:
            raise HTTPException(status_code=403, detail="Not authorized to start duty on this booking")

    # Payment Verification: Must be Paid
    inv_paid = booking.invoice and booking.invoice.payment_status == "Paid"
    if booking.payment_status != "Paid" and not inv_paid:
        raise HTTPException(
            status_code=400,
            detail="Cannot start duty: Initial invoice payment must be confirmed by Receptionist before duty can be started."
        )

    now = datetime.now(timezone.utc)
    booking.payment_status = "Paid"
    booking.duty_status = "In Progress"
    booking.duty_started_at = now
    booking.status = "Confirmed"

    await db.commit()
    await db.refresh(booking)
    return map_booking_response(booking)


# ------------------------------------------------------------------------------
# 8. Nurse Duty Flow: End / Off Duty (Automatic Overtime Invoice Generation)
# ------------------------------------------------------------------------------
@router.post("/nurse/bookings/{booking_id}/end-duty", response_model=NurseBookingResponse)
async def end_nurse_duty(
    booking_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Ends duty timer, calculates exact elapsed duration.
    If actual_worked_hours > contracted_hours:
    Calculates overtime_hours and overtime_due_bdt, and automatically generates
    an itemized 'Nurse Overtime Due' Invoice for the patient.
    """
    stmt = (
        select(NurseBooking)
        .where(NurseBooking.id == booking_id)
        .options(
            selectinload(NurseBooking.nurse),
            selectinload(NurseBooking.patient),
            selectinload(NurseBooking.invoice),
            selectinload(NurseBooking.overtime_invoice)
        )
    )
    res = await db.execute(stmt)
    booking = res.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=404, detail="Nurse booking not found")

    # Authorize nurse
    if current_user.system_role != SystemRole.SUPER_ADMIN:
        n_stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
        n_res = await db.execute(n_stmt)
        nurse = n_res.scalar_one_or_none()
        if not nurse or booking.nurse_id != nurse.id:
            raise HTTPException(status_code=403, detail="Not authorized to end duty on this booking")

    now = datetime.now(timezone.utc)
    start_dt = booking.duty_started_at or now

    # Ensure timezone awareness for subtraction
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)

    elapsed_seconds = max(0.0, (now - start_dt).total_seconds())
    actual_worked_minutes = int(elapsed_seconds / 60)
    actual_worked_hours = elapsed_seconds / 3600.0

    booking.duty_ended_at = now
    booking.duty_status = "Completed"
    booking.status = "Completed"
    booking.actual_worked_minutes = actual_worked_minutes

    contracted = float(booking.contracted_hours or 4.0)
    hourly_rate = float(booking.hourly_rate_bdt or 300.0)

    # Automatic Overtime Generation
    if actual_worked_hours > contracted:
        overtime_hours = round(actual_worked_hours - contracted, 2)
        overtime_due_bdt = round(overtime_hours * hourly_rate, 2)
        booking.overtime_hours = overtime_hours
        booking.overtime_due_bdt = overtime_due_bdt

        if overtime_due_bdt > 0:
            i_count_res = await db.execute(select(func.count(Invoice.id)))
            i_total = (i_count_res.scalar() or 0) + 1
            ot_invoice_number = f"INV-NRS-OT-{datetime.now().strftime('%Y%m')}-{i_total:04d}"

            nurse_name = booking.nurse.full_name if booking.nurse else "Nurse"
            ot_invoice = Invoice(
                clinic_id=booking.clinic_id,
                patient_id=booking.patient_id,
                invoice_number=ot_invoice_number,
                status=InvoiceStatus.ISSUED,
                issue_date=date.today(),
                due_date=date.today(),
                subtotal=overtime_due_bdt,
                discount_amount=0.00,
                tax_rate_percent=0.00,
                tax_amount=0.00,
                total_amount=overtime_due_bdt,
                paid_amount=0.00,
                balance_amount=overtime_due_bdt,
                notes=(
                    f"Overtime Duty Care by {nurse_name} on {booking.service_date}. "
                    f"Total Elapsed: {round(actual_worked_hours, 2)}h (Contracted: {contracted}h, Overtime: {overtime_hours}h @ ৳{hourly_rate}/hr)."
                ),
                bill_type="Nurse Overtime Due",
                description=f"Overtime Care ({overtime_hours} hrs extra @ ৳{hourly_rate}/hr)",
                amount_bdt=overtime_due_bdt,
                paid_amount_bdt=0.00,
                due_amount_bdt=overtime_due_bdt,
                payment_status="Due"
            )
            db.add(ot_invoice)
            await db.flush()

            ot_item = InvoiceItem(
                invoice_id=ot_invoice.id,
                item_type=InvoiceItemType.OTHER,
                description=f"Overtime Care ({overtime_hours} hrs extra @ ৳{hourly_rate}/hr)",
                quantity=overtime_hours,
                unit_price=hourly_rate,
                total_price=overtime_due_bdt
            )
            db.add(ot_item)
            await db.flush()

            booking.overtime_invoice_id = ot_invoice.id

    await db.commit()
    await db.refresh(booking)
    return map_booking_response(booking)


# ------------------------------------------------------------------------------
# 9. Nurse Profile & DP Upload Endpoints
# ------------------------------------------------------------------------------
@router.get("/nurse/me/profile", response_model=NurseProfileResponse)
async def get_nurse_me_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns profile for currently logged in Nurse or first profile for Admin."""
    stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
    res = await db.execute(stmt)
    nurse = res.scalar_one_or_none()
    if not nurse and current_user.system_role == SystemRole.SUPER_ADMIN:
        first_res = await db.execute(select(NurseProfile).limit(1))
        nurse = first_res.scalar_one_or_none()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse profile not found")

    stats_stmt = select(
        func.coalesce(func.avg(NurseReview.rating), 0.0),
        func.count(NurseReview.id)
    ).where(NurseReview.nurse_id == nurse.id)
    stats_res = await db.execute(stats_stmt)
    avg_r, cnt_r = stats_res.one()
    return map_nurse_profile_response(nurse, {"avg": float(avg_r), "count": int(cnt_r)})


@router.put("/nurse/me/profile", response_model=NurseProfileResponse)
async def update_nurse_profile(
    req: UpdateNurseProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Nurse updates their own profile details (bio, location, phone, availability)."""
    stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
    res = await db.execute(stmt)
    nurse = res.scalar_one_or_none()
    if not nurse and current_user.system_role == SystemRole.SUPER_ADMIN:
        first_res = await db.execute(select(NurseProfile).limit(1))
        nurse = first_res.scalar_one_or_none()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse profile not found")

    user = await db.get(User, nurse.user_id)
    if req.phone is not None:
        nurse.phone = req.phone
        if user:
            user.phone = req.phone
    if req.bio is not None:
        nurse.bio = req.bio
    if req.service_location is not None:
        nurse.service_location = req.service_location
    if req.education is not None:
        nurse.education = req.education
    if req.experience_years is not None:
        nurse.experience_years = req.experience_years
    if req.service_fee_bdt is not None:
        nurse.service_fee_bdt = req.service_fee_bdt
    if req.is_available is not None:
        nurse.is_available = req.is_available
    if req.avatar_url is not None:
        nurse.avatar_url = req.avatar_url
        if user:
            user.avatar_url = req.avatar_url

    await db.commit()
    await db.refresh(nurse)

    stats_stmt = select(
        func.coalesce(func.avg(NurseReview.rating), 0.0),
        func.count(NurseReview.id)
    ).where(NurseReview.nurse_id == nurse.id)
    stats_res = await db.execute(stats_stmt)
    avg_r, cnt_r = stats_res.one()
    return map_nurse_profile_response(nurse, {"avg": float(avg_r), "count": int(cnt_r)})


@router.patch("/nurse/me/availability")
async def toggle_nurse_me_availability(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Toggles availability status for current nurse."""
    stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
    res = await db.execute(stmt)
    nurse = res.scalar_one_or_none()
    if not nurse and current_user.system_role == SystemRole.SUPER_ADMIN:
        first_res = await db.execute(select(NurseProfile).limit(1))
        nurse = first_res.scalar_one_or_none()
    if not nurse:
        raise HTTPException(status_code=404, detail="Nurse profile not found")
    nurse.is_available = not nurse.is_available
    await db.commit()
    return {"is_available": nurse.is_available}


@router.post("/nurse/me/avatar")
async def upload_nurse_avatar(
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads, optimizes, and stores a nurse's profile picture (DP) as /uploads/avatars/...
    Syncs with both User.avatar_url and NurseProfile.avatar_url.
    """
    backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    upload_dir = os.path.join(backend_root, "uploads", "avatars")
    os.makedirs(upload_dir, exist_ok=True)

    filename = None
    if file and file.filename:
        ext = os.path.splitext(file.filename)[1].lower() or ".png"
        filename = f"nurse_{current_user.id}_{int(time.time())}{ext}"
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
                filename = f"nurse_{current_user.id}_{int(time.time())}{ext}"
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
                ext = ".jpg" if ("jpeg" in header or "jpg" in header) else ".png"
                filename = f"nurse_{current_user.id}_{int(time.time())}{ext}"
                filepath = os.path.join(upload_dir, filename)
                with open(filepath, "wb") as f:
                    f.write(base64.b64decode(base64_data))
            elif data_url.startswith("/uploads/"):
                filename = os.path.basename(data_url)

    if not filename:
        raise HTTPException(status_code=400, detail="No image file or valid image data provided")

    relative_url = f"/uploads/avatars/{filename}"

    # Sync User.avatar_url
    user = await db.get(User, current_user.id)
    if user:
        user.avatar_url = relative_url

    # Sync NurseProfile.avatar_url
    n_stmt = select(NurseProfile).where(NurseProfile.user_id == current_user.id)
    n_res = await db.execute(n_stmt)
    nurse = n_res.scalar_one_or_none()
    if not nurse and current_user.system_role == SystemRole.SUPER_ADMIN:
        f_res = await db.execute(select(NurseProfile).limit(1))
        nurse = f_res.scalar_one_or_none()
    if nurse:
        nurse.avatar_url = relative_url

    await db.commit()
    return {"avatar_url": relative_url, "message": "Nurse profile photo uploaded successfully"}
