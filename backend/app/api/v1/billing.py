"""Billing, Invoicing, and Hospital Payment Management API Endpoints."""
import uuid
from typing import List, Optional
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_tenant, get_current_user, require_roles, TenantContext, log_audit_event
from app.models.billing import Invoice, InvoiceItem, PaymentTransaction, InvoiceStatus, PaymentMode, InvoiceItemType
from app.models.patient import Patient
from app.models.unit import HospitalUnit
from app.models.doctor import DoctorProfile
from app.models.tenant import Clinic
from app.models.user import User, ClinicRole, SystemRole, AuditAction
from app.models.nurse import NurseBooking
from app.schemas.billing import (
    InvoiceCreate, InvoiceResponse, PaymentCreate, PaymentResponse,
    ConfirmUnitBillRequest, ConfirmPaymentRequest, LineItemBreakdown
)

router = APIRouter(prefix="/billing", tags=["Billing & Invoices"])
invoices_router = APIRouter(prefix="/invoices", tags=["Invoices API"])
reception_router = APIRouter(prefix="/reception", tags=["Reception Desk API"])


async def generate_invoice_number(db: AsyncSession, clinic_id: uuid.UUID) -> str:
    """Generates tenant-scoped sequential invoice code e.g. INV-202611-0004."""
    month_str = datetime.now().strftime("%Y%m")
    prefix = f"INV-{month_str}-"
    count_stmt = select(func.count(Invoice.id)).where(
        Invoice.clinic_id == clinic_id,
        Invoice.invoice_number.like(f"{prefix}%")
    )
    count_res = await db.execute(count_stmt)
    total_month = count_res.scalar() or 0
    return f"{prefix}{total_month + 1:04d}"


def build_line_items(inv: Invoice, doc_prof: Optional[DoctorProfile] = None) -> List[LineItemBreakdown]:
    amt = float(inv.amount_bdt if inv.amount_bdt is not None else inv.total_amount)

    # 1. If explicit invoice items exist in DB:
    items_list = []
    try:
        if "items" in inv.__dict__ and inv.items:
            items_list = list(inv.items)
    except Exception:
        items_list = []

    if items_list and len(items_list) > 0:
        res_items = []
        for it in items_list:
            loc = "Main Hospital Facility"
            if inv.unit:
                loc = f"Floor {inv.unit.floor or '1'}, {inv.unit.category} Ward • {inv.unit.unit_code}"
            elif doc_prof and doc_prof.chamber_location:
                loc = f"{doc_prof.specialization or 'OPD'} • {doc_prof.chamber_location}"
            elif inv.doctor:
                loc = "OPD Consultation Chamber 101"

            res_items.append(LineItemBreakdown(
                service=it.description,
                location=loc,
                reason=inv.notes or f"Clinical Service: {it.description}",
                unit_price=float(it.unit_price),
                qty=it.quantity,
                total=float(it.total_price)
            ))
        return res_items

    # 2. Bed / ICU / CCU Admission
    if (inv.bill_type and any(k in inv.bill_type.upper() for k in ["BED", "ICU", "CCU", "CABIN"])) or inv.unit_id or inv.unit:
        unit_code = inv.unit.unit_code if inv.unit else "BED-101"
        cat = inv.unit.category if inv.unit else "Inpatient Bed"
        floor = inv.unit.floor if inv.unit else "1st Floor"
        daily_rate = float(inv.unit.daily_price if (inv.unit and inv.unit.daily_price) else 2000.0)

        days = max(1, int(round(amt / daily_rate))) if daily_rate > 0 else 1
        unit_price = round(amt / days, 2) if days > 0 else amt

        return [
            LineItemBreakdown(
                service=f"{cat} Admission & Inpatient Care ({unit_code})",
                location=f"Floor {floor}, {cat} Unit • Bed {unit_code}",
                reason=inv.notes or f"Inpatient Bed Occupancy ({days} Day(s) @ ৳{unit_price:,.0f}/day)",
                unit_price=float(unit_price),
                qty=days,
                total=amt
            )
        ]

    # 3. Doctor Visit / OPD Consultation
    d_name = f"Dr. {inv.doctor.first_name} {inv.doctor.last_name}".strip() if inv.doctor else "Medical Specialist"
    spec = doc_prof.specialization if doc_prof else "General Consultation"
    chamber = doc_prof.chamber_location if (doc_prof and doc_prof.chamber_location) else "OPD Chamber 101, Main Block"

    return [
        LineItemBreakdown(
            service="Consultant Consultation Fee",
            location=f"{spec} • {chamber}",
            reason=inv.description or f"OPD Consultation with {d_name}",
            unit_price=amt,
            qty=1,
            total=amt
        )
    ]


def map_invoice_response(
    inv: Invoice,
    doc_profile_map: Optional[dict] = None,
    review_map: Optional[dict] = None,
    booking_map: Optional[dict] = None
) -> InvoiceResponse:
    p_name = None
    p_mrn = None
    p_phone = None
    p_address = None
    if inv.patient:
        p_name = f"{inv.patient.first_name} {inv.patient.last_name}".strip()
        p_mrn = inv.patient.mrn
        p_phone = inv.patient.phone
        addr_parts = [p for p in [inv.patient.address_line, inv.patient.city] if p]
        p_address = ", ".join(addr_parts) if addr_parts else "Registered Patient Address"

    doc_prof = doc_profile_map.get(inv.doctor_id) if (doc_profile_map and inv.doctor_id) else None

    d_name = None
    d_specialty = None
    chamber_loc = None
    if inv.doctor:
        d_name = f"Dr. {inv.doctor.first_name} {inv.doctor.last_name}".strip()
        d_specialty = doc_prof.specialization if doc_prof else "Consultant Physician"
        chamber_loc = doc_prof.chamber_location if (doc_prof and doc_prof.chamber_location) else "OPD Chamber 101, Main Block"
    elif doc_prof:
        d_specialty = doc_prof.specialization
        chamber_loc = doc_prof.chamber_location

    u_code = None
    if inv.unit:
        u_code = inv.unit.unit_code

    conf_name = None
    if inv.confirmed_by:
        conf_name = f"{inv.confirmed_by.first_name} {inv.confirmed_by.last_name}".strip()

    amt = float(inv.amount_bdt if inv.amount_bdt is not None else inv.total_amount)
    paid = float(inv.paid_amount_bdt if inv.paid_amount_bdt is not None else inv.paid_amount)
    due = float(inv.due_amount_bdt if inv.due_amount_bdt is not None else inv.balance_amount)

    pay_status = inv.payment_status or ("Paid" if (inv.status == InvoiceStatus.PAID or due <= 0) else "Due")

    line_items = build_line_items(inv, doc_prof)

    # Resolve linked nurse booking ID and review status
    nb_id = getattr(inv, "nurse_booking_id", None)
    if not nb_id and booking_map and inv.id in booking_map:
        nb_id = booking_map[inv.id]

    has_reviewed = False
    submitted_rating = None
    if nb_id and review_map and nb_id in review_map:
        has_reviewed = True
        submitted_rating = review_map[nb_id].rating

    return InvoiceResponse(
        id=inv.id,
        clinic_id=inv.clinic_id,
        patient_id=inv.patient_id,
        appointment_id=inv.appointment_id,
        doctor_id=inv.doctor_id,
        unit_id=inv.unit_id,
        invoice_number=inv.invoice_number,
        status=inv.status,
        bill_type=inv.bill_type or "Doctor Visit",
        description=inv.description or ("Doctor Consultation" if inv.appointment_id else "Hospital Medical Service"),
        amount_bdt=amt,
        paid_amount_bdt=paid,
        due_amount_bdt=due,
        payment_status=pay_status,
        payment_method=inv.payment_method,
        confirmed_by_receptionist_id=inv.confirmed_by_receptionist_id,
        confirmed_by_name=conf_name,
        paid_at=inv.paid_at,
        issue_date=inv.issue_date,
        due_date=inv.due_date,
        subtotal=float(inv.subtotal),
        discount_amount=float(inv.discount_amount),
        tax_rate_percent=float(inv.tax_rate_percent),
        tax_amount=float(inv.tax_amount),
        total_amount=float(inv.total_amount),
        paid_amount=float(inv.paid_amount),
        balance_amount=float(inv.balance_amount),
        notes=inv.notes,
        created_at=inv.created_at,
        patient_name=p_name,
        patient_mrn=p_mrn,
        patient_phone=p_phone,
        patient_address=p_address,
        doctor_name=d_name,
        doctor_specialty=d_specialty,
        chamber_location=chamber_loc,
        unit_code=u_code,
        nurse_booking_id=nb_id,
        has_reviewed=has_reviewed,
        submitted_rating=submitted_rating,
        line_items=line_items,
        items=[],
        payments=[]
    )


# ==============================================================================
# INVOICE LISTING & RETRIEVAL
# ==============================================================================

@router.get("/invoices", response_model=List[InvoiceResponse])
@invoices_router.get("", response_model=List[InvoiceResponse])
async def list_invoices(
    patient_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    bill_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Lists clinic billing invoices with search & filters (All, Due, Paid)."""
    # Fetch doctor profiles for rich metadata lookup
    dp_res = await db.execute(select(DoctorProfile).where(DoctorProfile.clinic_id == tenant.clinic_id))
    doc_profiles = dp_res.scalars().all()
    doc_map = {}
    for dp in doc_profiles:
        doc_map[dp.user_id] = dp
        doc_map[dp.id] = dp

    stmt = (
        select(Invoice)
        .where(Invoice.clinic_id == tenant.clinic_id)
        .options(
            selectinload(Invoice.patient),
            selectinload(Invoice.doctor),
            selectinload(Invoice.unit),
            selectinload(Invoice.confirmed_by),
            selectinload(Invoice.items),
            selectinload(Invoice.payments)
        )
        .order_by(Invoice.created_at.desc())
    )

    if patient_id:
        stmt = stmt.where(Invoice.patient_id == patient_id)

    if status_filter and status_filter.upper() != "ALL":
        if status_filter.upper() in ["PAID", "DUE"]:
            stmt = stmt.where(Invoice.payment_status == status_filter.capitalize())
        else:
            try:
                inv_st = InvoiceStatus(status_filter.upper())
                stmt = stmt.where(Invoice.status == inv_st)
            except ValueError:
                pass

    if bill_type and bill_type.upper() != "ALL":
        stmt = stmt.where(Invoice.bill_type.ilike(f"%{bill_type}%"))

    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.join(Patient, Invoice.patient_id == Patient.id).where(
            or_(
                Invoice.invoice_number.ilike(s),
                Invoice.description.ilike(s),
                Patient.first_name.ilike(s),
                Patient.last_name.ilike(s),
                Patient.mrn.ilike(s),
                Patient.phone.ilike(s)
            )
        )

    res = await db.execute(stmt)
    invoices = res.scalars().all()
    return [map_invoice_response(inv, doc_map) for inv in invoices]


@router.get("/invoices/my", response_model=List[InvoiceResponse])
@invoices_router.get("/my", response_model=List[InvoiceResponse])
async def get_my_invoices(
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Returns all invoices for the authenticated patient."""
    p_stmt = select(Patient).where(
        Patient.user_id == current_user.id,
        Patient.is_deleted == False
    )
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

    # Fetch doctor profiles
    dp_res = await db.execute(select(DoctorProfile).where(DoctorProfile.clinic_id == tenant.clinic_id))
    doc_profiles = dp_res.scalars().all()
    doc_map = {}
    for dp in doc_profiles:
        doc_map[dp.user_id] = dp
        doc_map[dp.id] = dp

    stmt = (
        select(Invoice)
        .where(Invoice.patient_id == patient.id)
        .options(
            selectinload(Invoice.patient),
            selectinload(Invoice.doctor),
            selectinload(Invoice.unit),
            selectinload(Invoice.confirmed_by),
            selectinload(Invoice.items),
            selectinload(Invoice.payments)
        )
        .order_by(Invoice.created_at.desc())
    )
    res = await db.execute(stmt)
    invoices = res.scalars().all()

    # Look up nurse bookings and reviews for nurse-related invoices
    booking_map = {}
    review_map = {}
    from app.models.nurse import NurseBooking, NurseReview
    nb_res = await db.execute(select(NurseBooking).where(NurseBooking.patient_id == patient.id))
    patient_bookings = nb_res.scalars().all()
    b_ids = [b.id for b in patient_bookings]
    for b in patient_bookings:
        if b.invoice_id:
            booking_map[b.invoice_id] = b.id
        if b.overtime_invoice_id:
            booking_map[b.overtime_invoice_id] = b.id

    if b_ids:
        rev_res = await db.execute(select(NurseReview).where(NurseReview.booking_id.in_(b_ids)))
        for rev in rev_res.scalars().all():
            review_map[rev.booking_id] = rev

    return [map_invoice_response(inv, doc_map, review_map, booking_map) for inv in invoices]


@router.get("/invoices/my-summary")
@invoices_router.get("/my-summary")
async def get_my_invoices_summary(
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Returns total due, total paid, and pending bills summary for the patient."""
    p_stmt = select(Patient).where(
        Patient.user_id == current_user.id,
        Patient.is_deleted == False
    )
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
        return {
            "total_due_bdt": 0.0,
            "total_paid_bdt": 0.0,
            "total_invoices": 0,
            "has_due_bills": False
        }

    stmt = select(
        func.coalesce(func.sum(Invoice.amount_bdt), 0.0),
        func.coalesce(func.sum(Invoice.paid_amount_bdt), 0.0),
        func.coalesce(func.sum(Invoice.due_amount_bdt), 0.0),
        func.count(Invoice.id)
    ).where(Invoice.patient_id == patient.id)
    res = await db.execute(stmt)
    tot_amt, tot_paid, tot_due, count_inv = res.one()

    return {
        "total_due_bdt": float(tot_due),
        "total_paid_bdt": float(tot_paid),
        "total_invoices": count_inv,
        "has_due_bills": float(tot_due) > 0.0
    }


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
@invoices_router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves full itemized invoice details and payment history."""
    try:
        inv_uuid = uuid.UUID(str(invoice_id)) if not isinstance(invoice_id, uuid.UUID) else invoice_id
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    dp_res = await db.execute(select(DoctorProfile).where(DoctorProfile.clinic_id == tenant.clinic_id))
    doc_profiles = dp_res.scalars().all()
    doc_map = {}
    for dp in doc_profiles:
        doc_map[dp.user_id] = dp
        doc_map[dp.id] = dp

    stmt = (
        select(Invoice)
        .where(Invoice.id == inv_uuid)
        .options(
            selectinload(Invoice.patient),
            selectinload(Invoice.doctor),
            selectinload(Invoice.unit),
            selectinload(Invoice.confirmed_by),
            selectinload(Invoice.items),
            selectinload(Invoice.payments)
        )
    )
    res = await db.execute(stmt)
    invoice = res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return map_invoice_response(invoice, doc_map)


# ==============================================================================
# RECEPTION DESK: PENDING UNITS & CONFIRMATION WORKFLOW
# ==============================================================================

@router.get("/pending-units")
@reception_router.get("/pending-units", include_in_schema=False)
async def list_pending_reception_units(
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists doctor-assigned Hospital Units (Bed, Cabin, ICU, CCU) that are pending
    Receptionist confirmation and admission billing generation.
    """
    stmt = (
        select(HospitalUnit)
        .where(
            HospitalUnit.clinic_id == tenant.clinic_id,
            HospitalUnit.status == "BOOKED",
            HospitalUnit.confirmation_status == "Pending Reception",
            HospitalUnit.is_deleted == False
        )
        .options(
            selectinload(HospitalUnit.patient),
            selectinload(HospitalUnit.doctor)
        )
        .order_by(HospitalUnit.assigned_at.desc())
    )
    res = await db.execute(stmt)
    units = res.scalars().all()

    result = []
    for u in units:
        p_name = f"{u.patient.first_name} {u.patient.last_name}".strip() if u.patient else "Patient"
        p_mrn = u.patient.mrn if u.patient else "MRN-N/A"
        p_phone = u.patient.phone if u.patient else ""

        d_name = f"Dr. {u.doctor.first_name} {u.doctor.last_name}".strip() if u.doctor else "Doctor"

        result.append({
            "unit_id": str(u.id),
            "unit_code": u.unit_code,
            "unit_name": u.unit_name,
            "category": u.category,
            "floor": u.floor,
            "daily_price": float(u.daily_price or 0.0),
            "patient_id": str(u.current_patient_id) if u.current_patient_id else None,
            "patient_name": p_name,
            "patient_mrn": p_mrn,
            "patient_phone": p_phone,
            "doctor_id": str(u.current_doctor_id) if u.current_doctor_id else None,
            "doctor_name": d_name,
            "assigned_at": u.assigned_at.isoformat() if u.assigned_at else None,
            "notes": u.notes,
            "confirmation_status": u.confirmation_status
        })
    return result


@router.post("/confirm-unit-bill", response_model=InvoiceResponse, operation_id="confirm_unit_bill_post")
@router.patch("/confirm-unit-bill", response_model=InvoiceResponse, include_in_schema=False)
@reception_router.api_route("/confirm-unit-bill", methods=["POST", "PATCH"], response_model=InvoiceResponse, include_in_schema=False)
async def confirm_unit_bill(
    payload: ConfirmUnitBillRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Receptionist confirms Doctor's Bed/ICU/CCU assignment, sets number of days & daily rate,
    marks unit as Confirmed, and generates a 'Bed / ICU / CCU' Due invoice.
    """
    # 1. Fetch unit (support SQLite string or UUID)
    try:
        unit_uuid = uuid.UUID(str(payload.unit_id)) if not isinstance(payload.unit_id, uuid.UUID) else payload.unit_id
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital unit not found.")

    u_stmt = (
        select(HospitalUnit)
        .where(
            HospitalUnit.id == unit_uuid,
            HospitalUnit.is_deleted == False
        )
        .options(selectinload(HospitalUnit.patient), selectinload(HospitalUnit.doctor))
    )
    u_res = await db.execute(u_stmt)
    unit = u_res.scalar_one_or_none()
    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital unit not found.")

    # 2. Fetch patient
    target_patient_id = payload.patient_id or unit.current_patient_id
    if not target_patient_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No patient assigned to this unit.")

    try:
        pat_uuid = uuid.UUID(str(target_patient_id)) if not isinstance(target_patient_id, uuid.UUID) else target_patient_id
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    p_stmt = select(Patient).where(
        Patient.id == pat_uuid,
        Patient.is_deleted == False
    )
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")

    # 3. Calculate billing totals
    days = max(1, payload.days)
    daily_rate = float(
        payload.daily_rate_bdt
        if payload.daily_rate_bdt is not None
        else (payload.daily_rate if payload.daily_rate is not None else (unit.daily_price or 0.0))
    )
    total_amount = round(days * daily_rate, 2)

    clinic_id = unit.clinic_id or tenant.clinic_id
    inv_num = await generate_invoice_number(db, clinic_id)
    today = date.today()
    desc = f"{unit.unit_code} Admission ({days} Day{'s' if days > 1 else ''} @ ৳{daily_rate:,.0f}/day)"

    invoice = Invoice(
        clinic_id=clinic_id,
        patient_id=patient.id,
        unit_id=unit.id,
        doctor_id=unit.current_doctor_id,
        invoice_number=inv_num,
        status=InvoiceStatus.ISSUED,
        bill_type="Bed / ICU / CCU",
        description=desc,
        amount_bdt=total_amount,
        paid_amount_bdt=0.00,
        due_amount_bdt=total_amount,
        payment_status="Due",
        issue_date=today,
        due_date=today,
        subtotal=total_amount,
        discount_amount=0.00,
        tax_rate_percent=0.00,
        tax_amount=0.00,
        total_amount=total_amount,
        paid_amount=0.00,
        balance_amount=total_amount,
        notes=payload.notes or f"Unit admission confirmed by receptionist: {unit.unit_code}"
    )
    db.add(invoice)
    await db.flush()

    inv_item = InvoiceItem(
        invoice_id=invoice.id,
        item_type=InvoiceItemType.ROOM_CHARGE,
        description=desc,
        quantity=days,
        unit_price=daily_rate,
        total_price=total_amount
    )
    db.add(inv_item)

    # 4. Update unit confirmation status
    unit.confirmation_status = "Confirmed"

    await db.commit()
    await db.refresh(invoice)

    stmt = (
        select(Invoice)
        .where(Invoice.id == invoice.id)
        .options(
            selectinload(Invoice.patient),
            selectinload(Invoice.doctor),
            selectinload(Invoice.unit),
            selectinload(Invoice.items),
            selectinload(Invoice.payments),
            selectinload(Invoice.confirmed_by)
        )
    )
    fresh_inv = (await db.execute(stmt)).scalar_one()
    return map_invoice_response(fresh_inv)


# ==============================================================================
# RECEPTION DESK: PAYMENT COLLECTION & CONFIRMATION
# ==============================================================================

@router.post("/invoices/{invoice_id}/confirm-payment", response_model=InvoiceResponse, operation_id="confirm_invoice_payment_post")
@router.patch("/invoices/{invoice_id}/confirm-payment", response_model=InvoiceResponse, include_in_schema=False)
@router.api_route("/invoices/{invoice_id}/pay", methods=["PATCH", "POST"], response_model=InvoiceResponse, include_in_schema=False)
@invoices_router.api_route("/{invoice_id}/confirm-payment", methods=["PATCH", "POST"], response_model=InvoiceResponse, include_in_schema=False)
@invoices_router.api_route("/{invoice_id}/pay", methods=["PATCH", "POST"], response_model=InvoiceResponse, include_in_schema=False)
@reception_router.api_route("/invoices/{invoice_id}/confirm-payment", methods=["PATCH", "POST"], response_model=InvoiceResponse, include_in_schema=False)
@reception_router.api_route("/invoices/{invoice_id}/pay", methods=["PATCH", "POST"], response_model=InvoiceResponse, include_in_schema=False)
async def confirm_invoice_payment(
    invoice_id: str,
    payload: ConfirmPaymentRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST, SystemRole.SUPER_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Receptionist / Super Admin confirms payment for a Due invoice:
    - Marks payment_status = 'Paid'
    - Sets due_amount_bdt = 0 and records full paid_amount_bdt
    - Sets payment_method (Cash, bKash/Nagad, Card) and paid_at
    - Creates tamper-evident PaymentTransaction
    """
    try:
        inv_uuid = uuid.UUID(str(invoice_id)) if not isinstance(invoice_id, uuid.UUID) else invoice_id
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    stmt = (
        select(Invoice)
        .where(Invoice.id == inv_uuid)
        .options(
            selectinload(Invoice.patient),
            selectinload(Invoice.doctor),
            selectinload(Invoice.unit),
            selectinload(Invoice.items),
            selectinload(Invoice.payments),
            selectinload(Invoice.confirmed_by)
        )
    )
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found.")

    if inv.payment_status == "Paid":
        return map_invoice_response(inv)

    amt_requested = payload.amount_paid if payload.amount_paid is not None else payload.amount_bdt
    amt_to_pay = float(amt_requested) if (amt_requested is not None and amt_requested > 0) else float(inv.due_amount_bdt if inv.due_amount_bdt is not None else inv.balance_amount)
    if amt_to_pay <= 0:
        amt_to_pay = float(inv.amount_bdt if inv.amount_bdt is not None else inv.total_amount)

    inv.status = InvoiceStatus.PAID
    inv.payment_status = "Paid"
    inv.paid_amount_bdt = float(inv.amount_bdt if inv.amount_bdt is not None else inv.total_amount)
    inv.due_amount_bdt = 0.00
    inv.paid_amount = float(inv.total_amount)
    inv.balance_amount = 0.00
    inv.payment_method = payload.payment_method
    inv.confirmed_by_receptionist_id = current_user.id
    inv.paid_at = datetime.now(timezone.utc)

    m_lower = (payload.payment_method or "").lower()
    if "bkash" in m_lower or "nagad" in m_lower or "mobile" in m_lower:
        pm = PaymentMode.MOBILE_BANKING
    elif "card" in m_lower:
        pm = PaymentMode.CREDIT_CARD
    else:
        pm = PaymentMode.CASH

    txn = PaymentTransaction(
        clinic_id=inv.clinic_id,
        invoice_id=inv.id,
        patient_id=inv.patient_id,
        received_by_id=current_user.id,
        transaction_reference=f"TXN-{uuid.uuid4().hex[:10].upper()}",
        payment_mode=pm,
        amount=amt_to_pay,
        payment_date=datetime.now(timezone.utc),
        notes=payload.notes or f"Paid via {payload.payment_method} at Reception Desk"
    )
    db.add(txn)

    await log_audit_event(
        db=db,
        action=AuditAction.UPDATE,
        action_title="Collected Invoice Payment",
        resource_type="Invoices & Billing",
        resource_id=str(inv.invoice_number),
        clinic_id=inv.clinic_id,
        user=current_user,
        patient_id=inv.patient_id,
        details=f"Received payment of ৳{amt_to_pay:,.2f} via {payload.payment_method} for Invoice #{inv.invoice_number} ({inv.bill_type})",
        payload_diff={
            "invoice_number": inv.invoice_number,
            "bill_type": inv.bill_type,
            "amount_paid": amt_to_pay,
            "payment_method": payload.payment_method
        }
    )

    # Automatically update linked NurseBooking to Paid and Ready to Start
    nb_stmt = select(NurseBooking).where(NurseBooking.invoice_id == inv.id)
    nb_res = await db.execute(nb_stmt)
    nurse_bookings = nb_res.scalars().all()
    for nb in nurse_bookings:
        nb.payment_status = "Paid"
        if nb.duty_status == "Awaiting Payment" or not nb.duty_status:
            nb.duty_status = "Ready to Start"

    # Also handle Nurse Overtime invoice settlement
    nb_ot_stmt = select(NurseBooking).where(NurseBooking.overtime_invoice_id == inv.id)
    nb_ot_res = await db.execute(nb_ot_stmt)
    ot_bookings = nb_ot_res.scalars().all()
    for ob in ot_bookings:
        ob.overtime_due_bdt = 0.0

    await db.commit()

    fresh_stmt = (
        select(Invoice)
        .where(Invoice.id == inv.id)
        .options(
            selectinload(Invoice.patient),
            selectinload(Invoice.doctor),
            selectinload(Invoice.unit),
            selectinload(Invoice.items),
            selectinload(Invoice.payments),
            selectinload(Invoice.confirmed_by)
        )
    )
    fresh_inv = (await db.execute(fresh_stmt)).scalar_one()
    return map_invoice_response(fresh_inv)


# ==============================================================================
# PRINTABLE A4 CLINICAL RECEIPT
# ==============================================================================

@router.get("/invoices/{invoice_id}/print-html", response_class=Response)
@invoices_router.get("/{invoice_id}/print-html", response_class=Response)
async def print_invoice_html(
    invoice_id: str,
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Returns a clinical-grade print-ready A4 receipt in BDT with clinic letterhead."""
    try:
        inv_uuid = uuid.UUID(str(invoice_id)) if not isinstance(invoice_id, uuid.UUID) else invoice_id
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    stmt = (
        select(Invoice)
        .where(Invoice.id == inv_uuid)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.patient),
            selectinload(Invoice.doctor),
            selectinload(Invoice.unit),
            selectinload(Invoice.confirmed_by)
        )
    )
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

    target_clinic_id = inv.clinic_id or tenant.clinic_id
    clinic_res = await db.execute(select(Clinic).where(Clinic.id == target_clinic_id))
    clinic = clinic_res.scalar_one_or_none()
    if not clinic:
        clinic_fallback = await db.execute(select(Clinic).where(Clinic.is_active == True).limit(1))
        clinic = clinic_fallback.scalar_one()

    # Load Doctor Profile if available
    doc_prof = None
    if inv.doctor_id:
        dp_res = await db.execute(
            select(DoctorProfile).where(
                DoctorProfile.clinic_id == tenant.clinic_id,
                or_(DoctorProfile.user_id == inv.doctor_id, DoctorProfile.id == inv.doctor_id)
            )
        )
        doc_prof = dp_res.scalar_one_or_none()

    p_name = f"{inv.patient.first_name} {inv.patient.last_name}".strip() if inv.patient else "Patient"
    p_mrn = inv.patient.mrn if inv.patient else "MRN-N/A"
    p_phone = inv.patient.phone if inv.patient else "N/A"
    addr_parts = [p for p in [inv.patient.address_line, inv.patient.city] if p] if inv.patient else []
    p_address = ", ".join(addr_parts) if addr_parts else "Registered Address"

    d_name = f"Dr. {inv.doctor.first_name} {inv.doctor.last_name}".strip() if inv.doctor else "Hospital Medical Staff"
    d_specialty = doc_prof.specialization if doc_prof else ("Inpatient Medicine" if inv.unit_id else "General OPD")
    chamber_loc = doc_prof.chamber_location if (doc_prof and doc_prof.chamber_location) else ("OPD Chamber 101, Main Block" if not inv.unit_id else f"Floor {inv.unit.floor or '1'}, {inv.unit.category}")

    amt = float(inv.amount_bdt if inv.amount_bdt is not None else inv.total_amount)
    paid = float(inv.paid_amount_bdt if inv.paid_amount_bdt is not None else inv.paid_amount)
    due = float(inv.due_amount_bdt if inv.due_amount_bdt is not None else inv.balance_amount)

    is_paid = (inv.payment_status or "").upper() == "PAID" or inv.status == InvoiceStatus.PAID or due <= 0
    primary_color = "#059669"
    if clinic.letterhead_template and isinstance(clinic.letterhead_template, dict):
        primary_color = clinic.letterhead_template.get("primary_color", "#059669")

    status_stamp = (
        f'<div style="display:inline-block; border: 2.5px solid {primary_color}; color: {primary_color}; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; padding: 6px 16px; border-radius: 6px; text-transform: uppercase;">✓ PAID IN FULL</div>'
        if is_paid else
        '<div style="display:inline-block; border: 2.5px solid #e11d48; color: #e11d48; font-size: 15px; font-weight: 800; letter-spacing: 1.5px; padding: 6px 16px; border-radius: 6px; text-transform: uppercase;">⚠ PAYMENT DUE</div>'
    )

    conf_name = f"{inv.confirmed_by.first_name} {inv.confirmed_by.last_name}".strip() if inv.confirmed_by else "Reception Billing Officer"
    line_items = build_line_items(inv, doc_prof)

    table_rows_html = ""
    for idx, it in enumerate(line_items):
        table_rows_html += f"""
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #64748b;">{idx + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
            <div style="font-weight: 700; color: #0f172a;">{it.service}</div>
            <div style="font-size: 11px; color: #059669; font-weight: 600; margin-top: 2px;">📍 {it.location}</div>
          </td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; color: #334155;">{it.reason}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 600;">৳{it.unit_price:,.2f}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600;">{it.qty}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">৳{it.total:,.2f}</td>
        </tr>
        """

    clinic_address = clinic.address_line1 or "Hospital Central Road, Dhaka, Bangladesh"
    clinic_phone = clinic.phone or "+880 1800 000000"
    clinic_email = clinic.email or "billing@metrohealth.com"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Hospital Money Receipt - {inv.invoice_number}</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 14mm 16mm;
    }}
    * {{
      box-sizing: border-box;
    }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
    }}
    .receipt-container {{
      max-width: 820px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 36px 40px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    }}
    .header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid {primary_color};
      padding-bottom: 20px;
      margin-bottom: 24px;
    }}
    .brand-logo {{
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: {primary_color};
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 24px;
    }}
    .hospital-title {{
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }}
    .hospital-sub {{
      font-size: 11.5px;
      color: #64748b;
      margin-top: 3px;
    }}
    .info-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
      font-size: 12.5px;
    }}
    .info-box {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
    }}
    .box-title {{
      font-size: 11px;
      font-weight: 800;
      color: #059669;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }}
    .info-row {{
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
    }}
    .info-label {{
      color: #64748b;
    }}
    .info-val {{
      font-weight: 600;
      color: #0f172a;
      text-align: right;
    }}
    .table {{
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
      font-size: 12.5px;
    }}
    .table th {{
      background: #f1f5f9;
      border-top: 1px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
      padding: 10px;
      font-size: 11px;
      font-weight: 800;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }}
    .financial-section {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      gap: 20px;
    }}
    .totals-box {{
      width: 320px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 16px;
      font-size: 13px;
    }}
    .totals-row {{
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid #f1f5f9;
    }}
    .totals-total {{
      border-top: 2px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 4px;
      font-size: 15px;
      font-weight: 800;
    }}
    .footer-signatures {{
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      border-top: 1px dashed #cbd5e1;
      padding-top: 28px;
      margin-top: 24px;
      text-align: center;
      font-size: 11px;
      color: #475569;
    }}
    .sig-line {{
      width: 140px;
      border-bottom: 1px solid #94a3b8;
      margin: 0 auto 6px auto;
    }}
    .official-seal {{
      width: 86px;
      height: 86px;
      border: 2px dashed #059669;
      border-radius: 50%;
      margin: 0 auto 4px auto;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #059669;
      font-weight: 800;
      font-size: 9px;
      text-transform: uppercase;
      transform: rotate(-10deg);
    }}
    @media print {{
      body {{
        background: #ffffff !important;
        padding: 0 !important;
      }}
      .receipt-container {{
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }}
      .no-print {{
        display: none !important;
      }}
    }}
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 820px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center;">
    <a href="/dashboard/billing" style="color: #64748b; text-decoration: none; font-size: 13px; font-weight: 600;">← Back to Billing Desk</a>
    <button onclick="window.print()" style="background: #059669; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 2px 6px rgba(5, 150, 105, 0.3);">
      <span>🖨️ Print Receipt / Save PDF (A4)</span>
    </button>
  </div>

  <div class="receipt-container" id="printable-receipt">
    <!-- Header -->
    <div class="header">
      <div style="display: flex; align-items: center; gap: 14px;">
        <div class="brand-logo">✚</div>
        <div>
          <div class="hospital-title">{clinic.name}</div>
          <div class="hospital-sub">{clinic_address}</div>
          <div class="hospital-sub">Hotline: {clinic_phone} • Email: {clinic_email}</div>
          <div style="margin-top: 4px; font-size: 12px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.5px;">
            Official Clinical Invoice & Money Receipt
          </div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 16px; font-weight: 800; font-family: monospace; color: #0f172a;">{inv.invoice_number}</div>
        <div style="font-size: 11.5px; color: #64748b; margin-top: 2px;">Issue Date: {inv.created_at.strftime('%d %B %Y')}</div>
        <div style="font-size: 11px; color: #64748b;">Time: {inv.created_at.strftime('%I:%M %p')}</div>
        <div style="margin-top: 10px;">{status_stamp}</div>
      </div>
    </div>

    <!-- Info Grid -->
    <div class="info-grid">
      <!-- Patient Information -->
      <div class="info-box">
        <div class="box-title">Patient Demographics</div>
        <div class="info-row">
          <span class="info-label">Patient Name:</span>
          <span class="info-val">{p_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Hospital MRN:</span>
          <span class="info-val font-mono">{p_mrn}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Contact Phone:</span>
          <span class="info-val">{p_phone}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Registered Address:</span>
          <span class="info-val">{p_address}</span>
        </div>
      </div>

      <!-- Clinical & Service Info -->
      <div class="info-box">
        <div class="box-title">Clinical & Service Reference</div>
        <div class="info-row">
          <span class="info-label">Consulting Physician:</span>
          <span class="info-val">{d_name}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Department / Specialty:</span>
          <span class="info-val">{d_specialty}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Chamber / Ward Location:</span>
          <span class="info-val">{chamber_loc}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Payment Channel:</span>
          <span class="info-val font-bold text-slate-800">{inv.payment_method or "Pending Settlement"}</span>
        </div>
      </div>
    </div>

    <!-- Itemized Breakdown Table ("Where, Why & Amount") -->
    <table class="table">
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">#</th>
          <th style="width: 250px; text-align: left;">Service / Ward & Location</th>
          <th style="text-align: left;">Clinical Reason / Description</th>
          <th style="width: 100px; text-align: right;">Rate (৳)</th>
          <th style="width: 60px; text-align: center;">Qty/Days</th>
          <th style="width: 110px; text-align: right;">Subtotal (৳)</th>
        </tr>
      </thead>
      <tbody>
        {table_rows_html}
      </tbody>
    </table>

    <!-- Financial Summary Box -->
    <div class="financial-section">
      <div style="font-size: 11.5px; color: #64748b; max-width: 360px; line-height: 1.5;">
        <p style="margin: 0 0 6px 0; font-weight: 700; color: #0f172a;">Official Billing Certification:</p>
        All charges are audited and documented in Bangladesh Taka (৳ BDT) under the National Healthcare Protocol.
        For queries or refunds, present this original receipt at the hospital reception within 7 days.
      </div>

      <div class="totals-box">
        <div class="totals-row">
          <span style="color: #64748b;">Subtotal / Total Billed:</span>
          <span style="font-family: monospace; font-weight: 700;">৳{amt:,.2f}</span>
        </div>
        <div class="totals-row" style="color: #059669;">
          <span>Amount Paid:</span>
          <span style="font-family: monospace; font-weight: 700;">৳{paid:,.2f}</span>
        </div>
        <div class="totals-row totals-total" style="color: {'#059669' if due <= 0 else '#e11d48'};">
          <span>Balance Outstanding Due:</span>
          <span style="font-family: monospace;">৳{due:,.2f}</span>
        </div>
      </div>
    </div>

    <!-- Signatures & Verification Stamp -->
    <div class="footer-signatures">
      <div>
        <div class="sig-line"></div>
        <div style="font-weight: 700; color: #0f172a;">Received By</div>
        <div style="font-size: 10px; color: #64748b;">{conf_name}</div>
        <div style="font-size: 10px; color: #94a3b8;">Reception Billing Desk</div>
      </div>

      <div>
        <div class="official-seal">
          <div>METRO<br>SEAL<br>VERIFIED</div>
        </div>
        <div style="font-weight: 700; color: #0f172a;">Hospital Official Seal</div>
      </div>

      <div>
        <div style="font-family: monospace; font-size: 10px; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; display: inline-block; background: #f8fafc; margin-bottom: 4px;">
          ||| |||| || ||||| ||||||<br>
          {inv.invoice_number}
        </div>
        <div style="font-weight: 700; color: #0f172a;">Verification ID</div>
        <div style="font-size: 10px; color: #64748b;">Computer Generated Receipt</div>
      </div>
    </div>
  </div>
</body>
</html>"""
    return Response(content=html, media_type="text/html")
    return Response(content=html, media_type="text/html")
