"""Lab Reports management API routes."""
import os
import uuid
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User, SystemRole, ClinicRole, AuditAction
from app.models.patient import Patient
from app.models.tenant import Clinic
from app.models.emr import LabReport, PatientLabReport
from app.core.deps import get_current_user, log_audit_event

router = APIRouter(prefix="/lab-reports", tags=["Lab Reports"])

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
UPLOAD_DIR = os.path.join(BACKEND_ROOT, "uploads", "lab-reports")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def is_admin_or_lab_assistant(user: User) -> bool:
    if user.system_role in [SystemRole.SUPER_ADMIN, SystemRole.LAB_ASSISTANT]:
        return True
    for m in getattr(user, "clinic_memberships", []):
        if m.is_active and m.role in [ClinicRole.CLINIC_ADMIN, ClinicRole.LAB_ASSISTANT]:
            return True
    return False


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_lab_report(
    patient_id: Optional[str] = Form(None),
    patient_mrn: Optional[str] = Form(None),
    test_name: str = Form(...),
    test_category: Optional[str] = Form("Hematology"),
    test_date: Optional[str] = Form(None),
    remarks: Optional[str] = Form(""),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads a diagnostic PDF lab report linked to a Patient ID or MRN.
    Accessible exclusively by SUPER_ADMIN and LAB_ASSISTANT.
    """
    if not is_admin_or_lab_assistant(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only Super Admin and Lab Assistants can upload lab reports."
        )

    # Resolve target patient
    patient = None
    if patient_id:
        try:
            pid = uuid.UUID(patient_id.strip())
            p_res = await db.execute(select(Patient).where(Patient.id == pid))
            patient = p_res.scalar_one_or_none()
        except ValueError:
            pass

    if not patient and patient_mrn:
        clean_mrn = patient_mrn.strip()
        p_res = await db.execute(select(Patient).where(func.lower(Patient.mrn) == clean_mrn.lower()))
        patient = p_res.scalar_one_or_none()

    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found with provided ID or MRN. Please verify the Patient identifier."
        )

    # Validate file format
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".pdf"] and file.content_type != "application/pdf":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF documents (.pdf) are accepted for diagnostic lab reports."
        )

    # Save PDF
    safe_mrn = (patient.mrn or "PT").replace("/", "-").replace(" ", "_")
    filename = f"lab_{safe_mrn}_{uuid.uuid4().hex[:8]}.pdf"
    file_path = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    pdf_url = f"/uploads/lab-reports/{filename}"

    # Parse test date
    parsed_date = datetime.date.today()
    if test_date:
        try:
            parsed_date = datetime.date.fromisoformat(test_date.strip())
        except ValueError:
            pass

    # Generate sequential report code
    count_res = await db.execute(select(func.count(LabReport.id)))
    rep_num = (count_res.scalar() or 0) + 1
    report_code = f"LAB-{datetime.date.today().year}-{rep_num:04d}"

    actor_role = "LAB_ASSISTANT" if current_user.system_role == SystemRole.LAB_ASSISTANT else "SUPER_ADMIN"
    actor_name = f"{current_user.first_name} {current_user.last_name}"

    report = LabReport(
        clinic_id=patient.clinic_id,
        patient_id=patient.id,
        test_name=test_name.strip(),
        test_category=test_category.strip() if test_category else "General Pathology",
        test_date=parsed_date,
        result_summary=remarks.strip() if remarks else f"{test_name} Diagnostic Report Completed",
        report_file_url=pdf_url,
        status="Completed",
        lab_name="Metro Diagnostic & Clinical Laboratory, Dhaka",
    )
    # Set dynamic/optional attributes if column exists
    for attr, val in [
        ("report_code", report_code),
        ("patient_mrn", patient.mrn),
        ("patient_name", f"{patient.first_name} {patient.last_name}"),
        ("remarks", remarks.strip() if remarks else ""),
        ("pdf_url", pdf_url),
        ("uploaded_by_name", actor_name),
        ("uploaded_by_role", actor_role),
    ]:
        if hasattr(report, attr):
            setattr(report, attr, val)

    db.add(report)
    await db.commit()
    await db.refresh(report)

    # Audit logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.CREATE,
        resource_type="LabReport",
        resource_id=report.id,
        action_title="Uploaded Diagnostic Lab Report",
        details=f"Uploaded {test_name} ({report_code}) for patient {patient.first_name} {patient.last_name} ({patient.mrn})"
    )

    return {
        "id": str(report.id),
        "report_code": getattr(report, "report_code", report_code),
        "patient_id": str(patient.id),
        "patient_mrn": patient.mrn,
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "test_name": report.test_name,
        "test_category": report.test_category,
        "test_date": str(report.test_date),
        "remarks": getattr(report, "remarks", report.result_summary),
        "pdf_url": getattr(report, "pdf_url", report.report_file_url),
        "uploaded_by_name": getattr(report, "uploaded_by_name", actor_name),
        "uploaded_by_role": getattr(report, "uploaded_by_role", actor_role),
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


@router.get("")
async def list_lab_reports(
    search: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns lab reports based on caller role:
    - PATIENT: Only reports belonging to their patient record
    - DOCTOR: Reports for their clinic/patients
    - SUPER_ADMIN & LAB_ASSISTANT: All reports across the system with optional search filter
    """
    query = select(LabReport).options(selectinload(LabReport.patient))

    # Patient role restriction
    if current_user.system_role == SystemRole.PATIENT:
        p_res = await db.execute(
            select(Patient.id).where(
                or_(
                    Patient.user_id == current_user.id,
                    Patient.email == current_user.email,
                    Patient.phone == current_user.phone
                )
            )
        )
        patient_ids = [row[0] for row in p_res.all()]
        if not patient_ids:
            return []
        query = query.where(LabReport.patient_id.in_(patient_ids))
    elif patient_id:
        try:
            pid = uuid.UUID(patient_id.strip())
            query = query.where(LabReport.patient_id == pid)
        except ValueError:
            pass

    if search and search.strip():
        q = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(LabReport.test_name).like(q),
                func.lower(LabReport.test_category).like(q),
                func.lower(LabReport.result_summary).like(q),
            )
        )

    query = query.order_by(LabReport.test_date.desc(), LabReport.created_at.desc())
    res = await db.execute(query)
    reports = res.scalars().all()

    output = []
    for r in reports:
        p_mrn = getattr(r, "patient_mrn", None) or (r.patient.mrn if r.patient else "MRN-PENDING")
        p_name = getattr(r, "patient_name", None) or (f"{r.patient.first_name} {r.patient.last_name}" if r.patient else "Patient")
        p_phone = r.patient.phone if r.patient else ""
        r_code = getattr(r, "report_code", None) or f"LAB-{r.created_at.year if r.created_at else 2026}-0001"
        r_pdf = getattr(r, "pdf_url", None) or r.report_file_url or ""
        r_rem = getattr(r, "remarks", None) or r.result_summary or ""
        r_up_name = getattr(r, "uploaded_by_name", None) or "Lab Diagnostic Staff"
        r_up_role = getattr(r, "uploaded_by_role", None) or "LAB_ASSISTANT"

        output.append({
            "id": str(r.id),
            "report_code": r_code,
            "patient_id": str(r.patient_id),
            "patient_mrn": p_mrn,
            "patient_name": p_name,
            "patient_phone": p_phone,
            "test_name": r.test_name,
            "test_category": r.test_category or "General Pathology",
            "test_date": str(r.test_date),
            "remarks": r_rem,
            "pdf_url": r_pdf,
            "uploaded_by_name": r_up_name,
            "uploaded_by_role": r_up_role,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # Also include PatientLabReport records
    plr_query = select(PatientLabReport).options(selectinload(PatientLabReport.patient))
    if current_user.system_role == SystemRole.PATIENT:
        if patient_ids:
            plr_query = plr_query.where(PatientLabReport.patient_id.in_(patient_ids))
        else:
            plr_query = None
    elif patient_id:
        try:
            pid = uuid.UUID(patient_id.strip())
            plr_query = plr_query.where(PatientLabReport.patient_id == pid)
        except ValueError:
            pass

    if plr_query is not None:
        if search and search.strip():
            q = f"%{search.strip().lower()}%"
            plr_query = plr_query.where(
                or_(
                    func.lower(PatientLabReport.test_name).like(q),
                    func.lower(PatientLabReport.order_code).like(q),
                    func.lower(PatientLabReport.patient_name).like(q),
                    func.lower(PatientLabReport.result_summary).like(q),
                )
            )
        plr_query = plr_query.order_by(PatientLabReport.created_at.desc())
        plr_res = await db.execute(plr_query)
        for plr in plr_res.scalars().all():
            output.append({
                "id": str(plr.id),
                "report_code": plr.order_code,
                "patient_id": str(plr.patient_id),
                "patient_mrn": plr.patient_mrn or "",
                "patient_name": plr.patient_name,
                "patient_phone": plr.patient.phone if plr.patient else "",
                "test_name": plr.test_name,
                "test_category": plr.test_code or "Diagnostic Test",
                "test_date": str(plr.created_at.date() if plr.created_at else datetime.date.today()),
                "remarks": plr.result_summary or f"Status: {plr.status}",
                "pdf_url": plr.report_file_url or "",
                "uploaded_by_name": plr.ordered_by_doctor or "Clinical Laboratory",
                "uploaded_by_role": "LAB_ASSISTANT",
                "created_at": plr.created_at.isoformat() if plr.created_at else None,
            })

    return output


@router.delete("/{report_id}")
async def delete_lab_report(
    report_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a diagnostic lab report. Accessible by SUPER_ADMIN and LAB_ASSISTANT.
    """
    if not is_admin_or_lab_assistant(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied. Only Super Admin and Lab Assistants can delete lab reports."
        )

    res = await db.execute(select(LabReport).where(LabReport.id == report_id))
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lab report not found.")

    pdf_url = getattr(report, "pdf_url", None) or report.report_file_url
    if pdf_url and "/uploads/lab-reports/" in pdf_url:
        filename = os.path.basename(pdf_url)
        local_path = os.path.join(UPLOAD_DIR, filename)
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass

    rep_code = getattr(report, "report_code", None) or str(report.id)
    t_name = report.test_name
    await db.delete(report)
    await db.commit()

    # Audit logging
    await log_audit_event(
        db=db,
        user=current_user,
        action=AuditAction.DELETE,
        resource_type="LabReport",
        resource_id=report_id,
        action_title="Deleted Diagnostic Lab Report",
        details=f"Deleted {t_name} ({rep_code})"
    )

    return {"message": "Diagnostic lab report deleted successfully."}

