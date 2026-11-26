"""Lab Facilities, Diagnostic Tests catalog, and Patient Lab Orders API routes."""
import os
import re
import uuid
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User, SystemRole, ClinicRole, AuditAction
from app.models.patient import Patient
from app.models.emr import LabTest, PatientLabReport
from app.models.billing import Invoice, InvoiceItem, InvoiceStatus, InvoiceItemType
from app.core.deps import get_current_user, log_audit_event

public_router = APIRouter(prefix="/public/lab-tests", tags=["Public Lab Facilities & Tests"])
admin_router = APIRouter(prefix="/admin/lab-tests", tags=["Admin Lab Tests Catalog"])
patient_reports_router = APIRouter(prefix="/admin/patient-lab-reports", tags=["Admin Patient Lab Orders & Reports"])

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_DIR = os.path.join(BACKEND_ROOT, "uploads", "patient-lab-reports")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def is_admin_authorized(user: User) -> bool:
    if user.system_role in [SystemRole.SUPER_ADMIN, SystemRole.LAB_ASSISTANT]:
        return True
    for m in getattr(user, "clinic_memberships", []):
        if m.is_active and m.role in [ClinicRole.CLINIC_ADMIN, ClinicRole.SUPER_ADMIN, ClinicRole.LAB_ASSISTANT]:
            return True
    return False


class LabTestCreateRequest(BaseModel):
    test_code: Optional[str] = Field(default=None, max_length=50)
    test_name: Optional[str] = Field(default=None, max_length=200)
    name: Optional[str] = Field(default=None, max_length=200)
    category: Optional[str] = Field(default=None, max_length=100)
    department: Optional[str] = Field(default=None, max_length=100)
    sample_type: Optional[str] = Field(default=None, max_length=100)
    price_bdt: Optional[float] = Field(default=None, ge=0)
    fee_bdt: Optional[float] = Field(default=None, ge=0)
    report_delivery_time: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = Field(default=True)
    description: Optional[str] = Field(default=None, max_length=1000)


class LabTestUpdateRequest(BaseModel):
    test_code: Optional[str] = Field(None, max_length=50)
    test_name: Optional[str] = Field(None, max_length=200)
    name: Optional[str] = Field(None, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    sample_type: Optional[str] = Field(None, max_length=100)
    price_bdt: Optional[float] = Field(None, ge=0)
    fee_bdt: Optional[float] = Field(None, ge=0)
    report_delivery_time: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None
    description: Optional[str] = None


class AssignLabTestRequest(BaseModel):
    patient_id: str
    lab_test_id: Optional[str] = None
    test_name: Optional[str] = None
    test_code: Optional[str] = None
    fee_bdt: Optional[float] = None
    ordered_by_doctor: Optional[str] = "Attending Physician"
    notes: Optional[str] = None


class UpdatePatientLabReportRequest(BaseModel):
    status: Optional[str] = None  # "Sample Collected", "Processing", "Report Ready"
    result_summary: Optional[str] = None
    report_file_url: Optional[str] = None
    ordered_by_doctor: Optional[str] = None
    fee_bdt: Optional[float] = None


def serialize_lab_test(t: LabTest) -> dict:
    return {
        "id": str(t.id),
        "clinic_id": str(t.clinic_id) if t.clinic_id else None,
        "test_code": t.test_code,
        "test_name": t.test_name,
        "category": t.category,
        "sample_type": t.sample_type,
        "price_bdt": float(t.price_bdt) if t.price_bdt is not None else 0.0,
        "report_delivery_time": t.report_delivery_time,
        "is_active": t.is_active,
        "description": t.description or "",
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def serialize_patient_lab_report(r: PatientLabReport) -> dict:
    inv = getattr(r, "invoice", None)
    return {
        "id": str(r.id),
        "order_code": r.order_code,
        "patient_id": str(r.patient_id),
        "patient_name": r.patient_name,
        "patient_mrn": r.patient_mrn or "",
        "patient_phone": r.patient.phone if r.patient else "",
        "lab_test_id": str(r.lab_test_id) if r.lab_test_id else None,
        "test_name": r.test_name,
        "test_code": r.test_code or "",
        "fee_bdt": float(r.fee_bdt) if r.fee_bdt is not None else 0.0,
        "ordered_by_doctor": r.ordered_by_doctor or "Attending Physician",
        "status": r.status or "Sample Collected",
        "result_summary": r.result_summary or "",
        "report_file_url": r.report_file_url or "",
        "invoice_id": str(r.invoice_id) if r.invoice_id else None,
        "invoice_number": inv.invoice_number if inv else None,
        "invoice_payment_status": inv.payment_status if inv else (inv.status.value if inv and hasattr(inv.status, "value") else "Due"),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


# ==========================================
# PUBLIC ENDPOINTS (No Authentication)
# ==========================================

@public_router.get("")
async def get_public_lab_tests(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    """
    Public directory of hospital diagnostic tests & lab facilities.
    Filtered to active tests only.
    """
    query = select(LabTest).where(LabTest.is_active == True)

    if category and category.strip() and category.strip().lower() != "all" and category.strip().lower() != "all tests":
        query = query.where(func.lower(LabTest.category) == category.strip().lower())

    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(LabTest.test_name).like(q),
                func.lower(LabTest.test_code).like(q),
                func.lower(LabTest.category).like(q),
                func.lower(LabTest.sample_type).like(q),
                func.lower(LabTest.description).like(q),
            )
        )

    query = query.order_by(LabTest.test_code.asc(), LabTest.test_name.asc()).limit(limit)
    res = await db.execute(query)
    tests = res.scalars().all()
    return [serialize_lab_test(t) for t in tests]


# ==========================================
# ADMIN LAB TESTS CATALOG
# ==========================================

@admin_router.get("")
async def get_admin_lab_tests(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all diagnostic tests (active and inactive) for admin management.
    """
    if not is_admin_authorized(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only Super Admin or Clinic Admin can access lab test catalog management."
        )

    query = select(LabTest)

    if category and category.strip() and category.strip().lower() != "all" and category.strip().lower() != "all tests":
        query = query.where(func.lower(LabTest.category) == category.strip().lower())

    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(LabTest.test_name).like(q),
                func.lower(LabTest.test_code).like(q),
                func.lower(LabTest.category).like(q),
                func.lower(LabTest.sample_type).like(q),
                func.lower(LabTest.description).like(q),
            )
        )

    query = query.order_by(LabTest.test_code.asc(), LabTest.test_name.asc())
    res = await db.execute(query)
    tests = res.scalars().all()
    return [serialize_lab_test(t) for t in tests]


@admin_router.post("", status_code=status.HTTP_201_CREATED)
async def create_lab_test(
    payload: LabTestCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new diagnostic lab test in the hospital catalog.
    Auto-generates unique test_code (e.g. LAB-16) if omitted or colliding.
    Accepts flexible field names (test_name/name, category/department, price_bdt/fee_bdt).
    """
    if not is_admin_authorized(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only Super Admin or Clinic Admin can add lab tests."
        )

    # Resolve flexible fields
    test_name = (payload.test_name or payload.name or "").strip()
    if not test_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Diagnostic test name is required."
        )

    category = (payload.category or payload.department or "Pathology").strip()
    sample_type = (payload.sample_type or "Blood").strip()
    price_bdt = float(payload.price_bdt if payload.price_bdt is not None else (payload.fee_bdt if payload.fee_bdt is not None else 500.0))
    report_delivery_time = (payload.report_delivery_time or "Same Day (4 Hours)").strip()
    description = (payload.description or "").strip()

    # Resolve or auto-generate unique test_code
    provided_code = payload.test_code.strip().upper() if payload.test_code and payload.test_code.strip() else None

    # Fetch all existing codes to prevent collision
    all_codes_res = await db.execute(select(LabTest.test_code))
    existing_codes = set(c.upper() for c in all_codes_res.scalars().all())

    if not provided_code or provided_code in existing_codes:
        # Compute highest sequential LAB-XX
        highest = 0
        for c in existing_codes:
            m = re.search(r"LAB-(\d+)", c, re.IGNORECASE)
            if m:
                highest = max(highest, int(m.group(1)))
        next_num = highest + 1
        test_code = f"LAB-{next_num:02d}"
        while test_code in existing_codes:
            next_num += 1
            test_code = f"LAB-{next_num:02d}"
    else:
        test_code = provided_code

    new_test = LabTest(
        test_code=test_code,
        test_name=test_name,
        category=category,
        sample_type=sample_type,
        price_bdt=price_bdt,
        report_delivery_time=report_delivery_time,
        is_active=payload.is_active,
        description=description,
    )
    db.add(new_test)
    await db.commit()
    await db.refresh(new_test)

    # Safe Audit Logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.CREATE,
        resource_type="LabTest",
        resource_id=str(new_test.id),
        action_title="Added Diagnostic Lab Test",
        details=f"Created {new_test.test_name} ({new_test.test_code}) — ৳{float(new_test.price_bdt)} ({new_test.report_delivery_time})"
    )

    return serialize_lab_test(new_test)


@admin_router.put("/{test_id}")
async def update_lab_test(
    test_id: uuid.UUID,
    payload: LabTestUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates an existing diagnostic lab test's details, fee (৳), or delivery time.
    """
    if not is_admin_authorized(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only Super Admin or Clinic Admin can update lab tests."
        )

    res = await db.execute(select(LabTest).where(LabTest.id == test_id))
    test = res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic lab test not found.")

    if payload.test_code is not None:
        clean_code = payload.test_code.strip().upper()
        if clean_code:
            # Check collision with other tests
            collision = await db.execute(
                select(LabTest).where(
                    func.lower(LabTest.test_code) == clean_code.lower(),
                    LabTest.id != test_id
                )
            )
            if collision.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another test with code '{clean_code}' already exists."
                )
            test.test_code = clean_code

    test_name = payload.test_name or payload.name
    if test_name is not None:
        test.test_name = test_name.strip()
    category = payload.category or payload.department
    if category is not None:
        test.category = category.strip()
    if payload.sample_type is not None:
        test.sample_type = payload.sample_type.strip()
    price = payload.price_bdt if payload.price_bdt is not None else payload.fee_bdt
    if price is not None:
        test.price_bdt = price
    if payload.report_delivery_time is not None:
        test.report_delivery_time = payload.report_delivery_time.strip()
    if payload.is_active is not None:
        test.is_active = payload.is_active
    if payload.description is not None:
        test.description = payload.description.strip()

    await db.commit()
    await db.refresh(test)

    # Safe Audit Logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.UPDATE,
        resource_type="LabTest",
        resource_id=str(test.id),
        action_title="Updated Diagnostic Lab Test",
        details=f"Updated {test.test_name} ({test.test_code}) — ৳{float(test.price_bdt)} ({test.report_delivery_time})"
    )

    return serialize_lab_test(test)


@admin_router.delete("/{test_id}")
async def delete_lab_test(
    test_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a diagnostic lab test from the catalog.
    """
    if not is_admin_authorized(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only Super Admin or Clinic Admin can delete lab tests."
        )

    res = await db.execute(select(LabTest).where(LabTest.id == test_id))
    test = res.scalar_one_or_none()
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Diagnostic lab test not found.")

    test_name = test.test_name
    test_code = test.test_code
    await db.delete(test)
    await db.commit()

    # Safe Audit Logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.DELETE,
        resource_type="LabTest",
        resource_id=str(test_id),
        action_title="Deleted Diagnostic Lab Test",
        details=f"Deleted {test_name} ({test_code})"
    )

    return {"message": f"Diagnostic test '{test_name}' ({test_code}) deleted successfully."}


# =========================================================================
# PATIENT LAB ORDERS & REPORTS (Assign to Patient, Billing Invoice, Upload)
# =========================================================================

@patient_reports_router.get("")
async def get_admin_patient_lab_reports(
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    patient_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all patient diagnostic lab orders & reports with patient name, MRN, fee, status, and PDF link.
    """
    query = (
        select(PatientLabReport)
        .options(selectinload(PatientLabReport.patient), selectinload(PatientLabReport.invoice))
        .order_by(PatientLabReport.created_at.desc())
    )

    if patient_id:
        try:
            pid = uuid.UUID(patient_id.strip())
            query = query.where(PatientLabReport.patient_id == pid)
        except ValueError:
            pass

    if status_filter and status_filter.strip() and status_filter.strip().upper() != "ALL":
        query = query.where(func.lower(PatientLabReport.status) == status_filter.strip().lower())

    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(PatientLabReport.patient_name).like(q),
                func.lower(PatientLabReport.patient_mrn).like(q),
                func.lower(PatientLabReport.order_code).like(q),
                func.lower(PatientLabReport.test_name).like(q),
                func.lower(PatientLabReport.test_code).like(q),
                func.lower(PatientLabReport.ordered_by_doctor).like(q),
                func.lower(PatientLabReport.result_summary).like(q),
            )
        )

    res = await db.execute(query)
    reports = res.scalars().all()
    return [serialize_patient_lab_report(r) for r in reports]


@patient_reports_router.post("", status_code=status.HTTP_201_CREATED)
async def assign_patient_lab_test(
    payload: AssignLabTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Assigns a diagnostic test to a patient:
    1. Creates the PatientLabReport (status = "Sample Collected").
    2. Automatically generates an Invoice (payment_status = "Due", bill_type = "Lab Diagnostic Test").
    """
    # Resolve target patient
    try:
        pid = uuid.UUID(payload.patient_id.strip())
        p_res = await db.execute(select(Patient).where(Patient.id == pid))
        patient = p_res.scalar_one_or_none()
    except ValueError:
        patient = None

    if not patient:
        # Try MRN lookup
        p_res = await db.execute(select(Patient).where(func.lower(Patient.mrn) == payload.patient_id.strip().lower()))
        patient = p_res.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found with the provided identifier or MRN."
        )

    # Resolve Lab Test from catalog if lab_test_id passed
    lab_test = None
    if payload.lab_test_id:
        try:
            tid = uuid.UUID(payload.lab_test_id.strip())
            t_res = await db.execute(select(LabTest).where(LabTest.id == tid))
            lab_test = t_res.scalar_one_or_none()
        except ValueError:
            pass

    test_name = payload.test_name or (lab_test.test_name if lab_test else "Diagnostic Investigation")
    test_code = payload.test_code or (lab_test.test_code if lab_test else "LAB")
    fee_bdt = float(payload.fee_bdt if payload.fee_bdt is not None else (lab_test.price_bdt if lab_test else 500.0))
    ordered_by = payload.ordered_by_doctor or "Attending Physician"

    # Sequential order code: RPT-YYYY-XXXX
    count_res = await db.execute(select(func.count(PatientLabReport.id)))
    count_num = (count_res.scalar() or 0) + 1
    today = datetime.date.today()
    order_code = f"RPT-{today.year}-{count_num:04d}"

    # Generate sequential invoice: INV-LAB-YYYYMM-XXXX
    inv_count_res = await db.execute(select(func.count(Invoice.id)))
    inv_num = (inv_count_res.scalar() or 0) + 1
    invoice_number = f"INV-LAB-{today.strftime('%Y%m')}-{inv_num:04d}"

    # 1. Create Invoice for Receptionist / Patient payment
    invoice = Invoice(
        clinic_id=patient.clinic_id,
        patient_id=patient.id,
        invoice_number=invoice_number,
        status=InvoiceStatus.ISSUED,
        issue_date=today,
        due_date=today,
        subtotal=fee_bdt,
        discount_amount=0.0,
        tax_rate_percent=0.0,
        tax_amount=0.0,
        total_amount=fee_bdt,
        paid_amount=0.0,
        balance_amount=fee_bdt,
        amount_bdt=fee_bdt,
        due_amount_bdt=fee_bdt,
        paid_amount_bdt=0.0,
        payment_status="Due",
        bill_type="Lab Diagnostic Test",
        description=f"Lab Diagnostic Test: {test_name} [{test_code}]",
        notes=f"Diagnostic Order {order_code}. Patient: {patient.first_name} {patient.last_name} ({patient.mrn})",
    )
    db.add(invoice)
    await db.flush()

    inv_item = InvoiceItem(
        clinic_id=patient.clinic_id,
        invoice_id=invoice.id,
        item_type=InvoiceItemType.LAB_TEST,
        description=f"{test_name} ({test_code})",
        quantity=1,
        unit_price=fee_bdt,
        total_price=fee_bdt,
    )
    db.add(inv_item)

    # 2. Create PatientLabReport
    report = PatientLabReport(
        clinic_id=patient.clinic_id,
        order_code=order_code,
        patient_id=patient.id,
        patient_name=f"{patient.first_name} {patient.last_name}",
        patient_mrn=patient.mrn,
        lab_test_id=lab_test.id if lab_test else None,
        test_name=test_name,
        test_code=test_code,
        fee_bdt=fee_bdt,
        ordered_by_doctor=ordered_by,
        status="Sample Collected",
        result_summary=payload.notes or "",
        invoice_id=invoice.id,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Re-fetch with relationships loaded
    q_loaded = (
        select(PatientLabReport)
        .where(PatientLabReport.id == report.id)
        .options(selectinload(PatientLabReport.patient), selectinload(PatientLabReport.invoice))
    )
    res_loaded = await db.execute(q_loaded)
    full_report = res_loaded.scalar_one()

    # Audit Logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.CREATE,
        resource_type="PatientLabReport",
        resource_id=str(report.id),
        patient_id=patient.id,
        action_title="Assigned Diagnostic Lab Test",
        details=f"Assigned {test_name} ({order_code}) to patient {patient.first_name} {patient.last_name} ({patient.mrn}) — Invoice {invoice_number} (৳{fee_bdt})"
    )

    return serialize_patient_lab_report(full_report)


@patient_reports_router.patch("/{report_id}")
async def update_patient_lab_report(
    report_id: uuid.UUID,
    payload: UpdatePatientLabReportRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Updates patient lab report findings, delivery status, and file URL.
    """
    q = (
        select(PatientLabReport)
        .where(PatientLabReport.id == report_id)
        .options(selectinload(PatientLabReport.patient), selectinload(PatientLabReport.invoice))
    )
    res = await db.execute(q)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient lab report not found.")

    if payload.result_summary is not None:
        report.result_summary = payload.result_summary.strip()
    if payload.report_file_url is not None:
        report.report_file_url = payload.report_file_url.strip()
    if payload.ordered_by_doctor is not None:
        report.ordered_by_doctor = payload.ordered_by_doctor.strip()
    if payload.fee_bdt is not None:
        report.fee_bdt = payload.fee_bdt

    if payload.status is not None:
        report.status = payload.status.strip()
    elif payload.result_summary or payload.report_file_url:
        report.status = "Report Ready"

    await db.commit()
    await db.refresh(report)

    # Safe Audit Logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.UPDATE,
        resource_type="PatientLabReport",
        resource_id=str(report.id),
        patient_id=report.patient_id,
        action_title="Updated Patient Lab Report",
        details=f"Updated report {report.order_code} ({report.test_name}) for patient {report.patient_name} — Status: {report.status}"
    )

    return serialize_patient_lab_report(report)


@patient_reports_router.post("/{report_id}/upload")
async def upload_patient_lab_report_file(
    report_id: uuid.UUID,
    file: UploadFile = File(...),
    result_summary: Optional[str] = Form(None),
    status_str: Optional[str] = Form("Report Ready"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a diagnostic report document (PDF, PNG, JPG) and links it directly to the report.
    Automatically marks status = "Report Ready".
    """
    q = (
        select(PatientLabReport)
        .where(PatientLabReport.id == report_id)
        .options(selectinload(PatientLabReport.patient), selectinload(PatientLabReport.invoice))
    )
    res = await db.execute(q)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient lab report not found.")

    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".pdf", ".png", ".jpg", ".jpeg"] and "pdf" not in (file.content_type or ""):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Diagnostic reports accept PDF documents or high-resolution images."
        )

    safe_mrn = (report.patient_mrn or "PT").replace("/", "-").replace(" ", "_")
    filename = f"rep_{safe_mrn}_{report.order_code}_{uuid.uuid4().hex[:6]}{ext or '.pdf'}"
    file_path = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    report_file_url = f"/uploads/patient-lab-reports/{filename}"
    report.report_file_url = report_file_url
    report.status = status_str or "Report Ready"
    if result_summary:
        report.result_summary = result_summary.strip()

    await db.commit()
    await db.refresh(report)

    # Safe Audit Logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.UPDATE,
        resource_type="PatientLabReport",
        resource_id=str(report.id),
        patient_id=report.patient_id,
        action_title="Uploaded Diagnostic Lab Report Document",
        details=f"Uploaded report document for {report.test_name} ({report.order_code}) — Patient: {report.patient_name}"
    )

    return serialize_patient_lab_report(report)
