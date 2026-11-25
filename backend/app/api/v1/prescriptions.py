"""Digital E-Prescription API Endpoints with Instant PDF & QR Code Verification."""
import uuid
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_tenant, get_current_user, require_roles, TenantContext, log_audit_event
from app.models.prescription import MedicineMaster, Prescription, PrescriptionItem
from app.models.emr import Encounter, VitalSign
from app.models.patient import Patient
from app.models.doctor import DoctorProfile
from app.models.tenant import Clinic
from app.models.unit import HospitalUnit
from app.models.appointment import Appointment, AppointmentStatus, QueueStatus
from app.models.user import User, ClinicStaff, ClinicRole, SystemRole, AuditAction
from app.schemas.prescription import (
    MedicineCreate, MedicineResponse, PrescriptionCreate, PrescriptionResponse,
    DirectConsultationPrescriptionCreate, PrescriptionListItemResponse,
    PrescriptionItemResponse, PrescriptionVerifyResponse
)
from app.services.pdf_service import (
    generate_verification_hash, build_prescription_pdf, build_prescription_html
)

router = APIRouter(prefix="/prescriptions", tags=["E-Prescriptions"])


async def generate_rx_code(db: AsyncSession, clinic_id: uuid.UUID) -> str:
    """Generates tenant-scoped sequential prescription reference e.g. RX-20261122-0089."""
    today_str = datetime.now().strftime("%Y%m%d")
    prefix = f"RX-{today_str}-"
    count_stmt = select(func.count(Prescription.id)).where(
        Prescription.clinic_id == clinic_id,
        Prescription.prescription_code.like(f"{prefix}%")
    )
    count_res = await db.execute(count_stmt)
    total_today = count_res.scalar() or 0
    return f"{prefix}{total_today + 1:04d}"


# Formulary / Medicine Catalog Endpoints
@router.get("/medicines", response_model=List[MedicineResponse])
async def search_medicines(
    search: Optional[str] = Query(None, description="Search brand or generic name"),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Searches the standard drug formulary and clinic-specific inventory."""
    stmt = select(MedicineMaster).where(
        or_(MedicineMaster.clinic_id == tenant.clinic_id, MedicineMaster.clinic_id.is_(None)),
        MedicineMaster.is_active == True
    )
    if search:
        search_filter = f"%{search}%"
        stmt = stmt.where(
            or_(
                MedicineMaster.brand_name.ilike(search_filter),
                MedicineMaster.generic_name.ilike(search_filter)
            )
        )
    stmt = stmt.limit(50)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/medicines", response_model=MedicineResponse, status_code=status.HTTP_201_CREATED)
async def add_medicine_to_catalog(
    request: MedicineCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.CLINIC_ADMIN, ClinicRole.DOCTOR])),
    db: AsyncSession = Depends(get_db)
):
    """Adds a custom medicine to the clinic's local formulary."""
    medicine = MedicineMaster(
        clinic_id=tenant.clinic_id,
        brand_name=request.brand_name,
        generic_name=request.generic_name,
        dosage_form=request.dosage_form,
        strength=request.strength,
        manufacturer=request.manufacturer,
        is_active=True
    )
    db.add(medicine)
    await db.commit()
    await db.refresh(medicine)
    return medicine


# Prescription Endpoints
@router.get("", response_model=List[PrescriptionListItemResponse])
async def list_prescriptions(
    patient_id: Optional[uuid.UUID] = Query(None),
    doctor_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    tenant: TenantContext = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists electronic prescriptions for patients, doctors, and clinic admins.
    Automatically scopes to patient's own prescriptions for patient users.
    """
    stmt = (
        select(Prescription)
        .options(
            selectinload(Prescription.items),
            selectinload(Prescription.patient),
            selectinload(Prescription.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user),
            selectinload(Prescription.encounter)
        )
        .order_by(Prescription.created_at.desc())
    )

    if tenant.is_patient or current_user.system_role == SystemRole.PATIENT:
        p_id = tenant.patient.id if tenant.patient else None
        if not p_id:
            p_res = await db.execute(select(Patient.id).where(Patient.user_id == current_user.id).limit(1))
            p_id = p_res.scalar_one_or_none()
        if p_id:
            stmt = stmt.where(Prescription.patient_id == p_id)
        else:
            return []
    else:
        # Check if caller is a Doctor
        doc_stmt = select(DoctorProfile.id).where(DoctorProfile.user_id == current_user.id)
        doc_res = await db.execute(doc_stmt)
        user_doc_id = doc_res.scalar_one_or_none()
        if user_doc_id and not doctor_id and not tenant.is_super_admin:
            stmt = stmt.where(Prescription.doctor_id == user_doc_id)
        elif doctor_id:
            stmt = stmt.where(Prescription.doctor_id == doctor_id)
        else:
            stmt = stmt.where(Prescription.clinic_id == tenant.clinic_id)

    if patient_id and (not tenant.is_patient):
        stmt = stmt.where(Prescription.patient_id == patient_id)

    res = await db.execute(stmt)
    prescriptions = res.scalars().all()

    # Query active booked units for this clinic to enrich prescription facility
    units_res = await db.execute(
        select(HospitalUnit).where(
            HospitalUnit.clinic_id == tenant.clinic_id,
            HospitalUnit.status == "BOOKED",
            HospitalUnit.is_deleted == False
        )
    )
    booked_units_by_patient = {
        u.current_patient_id: u for u in units_res.scalars().all() if u.current_patient_id
    }

    results = []
    for rx in prescriptions:
        doc_display = "Doctor"
        doc_spec = rx.doctor.specialization if rx.doctor else "General Medicine"
        if rx.doctor:
            if rx.doctor.staff and rx.doctor.staff.user:
                u = rx.doctor.staff.user
                full = f"{u.first_name} {u.last_name}".strip()
                doc_display = full if full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {full}"
            else:
                u_res = await db.execute(select(User).where(User.id == rx.doctor.user_id))
                u = u_res.scalar_one_or_none()
                if u:
                    full = f"{u.first_name} {u.last_name}".strip()
                    doc_display = full if full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {full}"

        p_name = f"{rx.patient.first_name} {rx.patient.last_name}" if rx.patient else "Patient"
        p_mrn = rx.patient.mrn if rx.patient else "N/A"
        p_phone = rx.patient.phone if rx.patient else None
        p_gender = rx.patient.gender.value if rx.patient and hasattr(rx.patient.gender, "value") else (str(rx.patient.gender) if rx.patient else None)
        p_age = (datetime.now().year - rx.patient.date_of_birth.year) if rx.patient and rx.patient.date_of_birth else None

        diagnosis = rx.encounter.chief_complaint if rx.encounter else None
        active_unit = booked_units_by_patient.get(rx.patient_id)
        if active_unit:
            bed_assignment = f"{active_unit.category} [{active_unit.unit_code}] - ৳ {active_unit.daily_price:.0f}/day"
        else:
            bed_assignment = rx.diet_instructions or "OPD"

        if search:
            s_lower = search.lower()
            if (s_lower not in rx.prescription_code.lower() and
                s_lower not in p_name.lower() and
                s_lower not in p_mrn.lower() and
                s_lower not in doc_display.lower()):
                continue

        results.append(
            PrescriptionListItemResponse(
                id=rx.id,
                clinic_id=rx.clinic_id,
                encounter_id=rx.encounter_id,
                appointment_id=rx.encounter.appointment_id if rx.encounter else None,
                patient_id=rx.patient_id,
                doctor_id=rx.doctor_id,
                prescription_code=rx.prescription_code,
                patient_name=p_name,
                patient_mrn=p_mrn,
                patient_phone=p_phone,
                patient_age=p_age,
                patient_gender=p_gender,
                doctor_name=doc_display,
                doctor_specialization=doc_spec,
                diagnosis=diagnosis,
                bed_assignment=bed_assignment,
                general_advice=rx.general_advice,
                diet_instructions=rx.diet_instructions,
                follow_up_date=rx.follow_up_date,
                verification_hash=rx.verification_hash,
                is_finalized=rx.is_finalized,
                created_at=rx.created_at,
                items=[
                    PrescriptionItemResponse(
                        id=item.id,
                        prescription_id=item.prescription_id,
                        medicine_id=item.medicine_id,
                        medicine_name=item.medicine_name,
                        generic_name=item.generic_name,
                        dosage=item.dosage,
                        frequency=item.frequency,
                        duration=item.duration,
                        meal_timing=item.meal_timing,
                        instructions=item.instructions
                    )
                    for item in rx.items
                ],
                items_count=len(rx.items)
            )
        )

    return results


@router.post("/consultation", response_model=PrescriptionListItemResponse, status_code=status.HTTP_201_CREATED)
async def submit_consultation_treatment(
    request: DirectConsultationPrescriptionCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN, SystemRole.SUPER_ADMIN])),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    One-stop clinical consultation submission:
    1. Loads appointment and verifies patient and doctor.
    2. Creates/updates Encounter and records SOAP & Vitals.
    3. Issues digital E-Prescription with QR verification token.
    4. Automatically marks Appointment as COMPLETED (and advances queue).
    """
    appt_stmt = (
        select(Appointment)
        .where(Appointment.id == request.appointment_id)
        .options(
            selectinload(Appointment.patient),
            selectinload(Appointment.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user),
            selectinload(Appointment.queue_token),
            selectinload(Appointment.encounter)
        )
    )
    appt_res = await db.execute(appt_stmt)
    appointment = appt_res.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    patient = appointment.patient
    doctor = appointment.doctor
    clinic_id = appointment.clinic_id or tenant.clinic_id

    chief_complaint = request.symptoms or appointment.reason_for_visit or "Clinical Consultation"
    clinical_summary = f"Diagnosis: {request.diagnosis or 'Consultation'} | Facility: {request.bed_assignment or 'OPD'}"
    encounter = appointment.encounter
    if not encounter:
        encounter = Encounter(
            clinic_id=clinic_id,
            appointment_id=appointment.id,
            patient_id=patient.id,
            doctor_id=doctor.id,
            encounter_date=datetime.now(timezone.utc),
            chief_complaint=chief_complaint,
            clinical_summary=clinical_summary,
            is_finalized=True
        )
        db.add(encounter)
        await db.flush()
    else:
        encounter.chief_complaint = chief_complaint
        encounter.clinical_summary = clinical_summary
        encounter.is_finalized = True

    if request.vitals:
        v = request.vitals
        vital_entry = VitalSign(
            clinic_id=clinic_id,
            encounter_id=encounter.id,
            patient_id=patient.id,
            recorded_by_id=current_user.id,
            systolic_bp=int(v.get("systolic", 120)) if v.get("systolic") else None,
            diastolic_bp=int(v.get("diastolic", 80)) if v.get("diastolic") else None,
            pulse_rate=int(v.get("pulse", 72)) if v.get("pulse") else None,
            temperature_celsius=float(v.get("temp", 37.0)) if v.get("temp") else None,
            weight_kg=float(v.get("weight", 70.0)) if v.get("weight") else None,
            height_cm=float(v.get("height", 175.0)) if v.get("height") else None,
            bmi=float(v.get("bmi", 22.8)) if v.get("bmi") else None
        )
        db.add(vital_entry)

    rx_code = await generate_rx_code(db, clinic_id)
    now_iso = datetime.now(timezone.utc).isoformat()
    v_hash = generate_verification_hash(
        clinic_id=str(clinic_id),
        doctor_license=doctor.license_number,
        patient_mrn=patient.mrn,
        prescription_code=rx_code,
        created_at_iso=now_iso
    )

    prescription = Prescription(
        clinic_id=clinic_id,
        encounter_id=encounter.id,
        patient_id=patient.id,
        doctor_id=doctor.id,
        prescription_code=rx_code,
        general_advice=request.general_advice or "Follow doctor instructions carefully and take medications on time.",
        diet_instructions=request.bed_assignment or "OPD",
        follow_up_date=request.follow_up_date,
        verification_hash=v_hash,
        is_finalized=True,
        signed_at=datetime.now(timezone.utc)
    )
    db.add(prescription)
    await db.flush()

    for item in request.items:
        p_item = PrescriptionItem(
            prescription_id=prescription.id,
            medicine_id=item.medicine_id,
            medicine_name=item.medicine_name,
            generic_name=item.generic_name,
            dosage=item.dosage,
            frequency=item.frequency,
            duration=item.duration,
            meal_timing=item.meal_timing,
            instructions=item.instructions
        )
        db.add(p_item)

    appointment.status = AppointmentStatus.COMPLETED
    if appointment.queue_token:
        appointment.queue_token.status = QueueStatus.COMPLETED
        appointment.queue_token.consultation_end_time = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(prescription)

    rx_items_stmt = select(PrescriptionItem).where(PrescriptionItem.prescription_id == prescription.id)
    items_res = await db.execute(rx_items_stmt)
    db_items = items_res.scalars().all()

    doc_display = "Doctor"
    if doctor.staff and doctor.staff.user:
        u = doctor.staff.user
        full = f"{u.first_name} {u.last_name}".strip()
        doc_display = full if full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {full}"
    else:
        u_res = await db.execute(select(User).where(User.id == doctor.user_id))
        u = u_res.scalar_one_or_none()
        if u:
            full = f"{u.first_name} {u.last_name}".strip()
            doc_display = full if full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {full}"

    p_gender = patient.gender.value if hasattr(patient.gender, "value") else str(patient.gender)
    p_age = (datetime.now().year - patient.date_of_birth.year) if patient.date_of_birth else None

    return PrescriptionListItemResponse(
        id=prescription.id,
        clinic_id=prescription.clinic_id,
        encounter_id=encounter.id,
        appointment_id=appointment.id,
        patient_id=patient.id,
        doctor_id=doctor.id,
        prescription_code=prescription.prescription_code,
        patient_name=f"{patient.first_name} {patient.last_name}",
        patient_mrn=patient.mrn,
        patient_phone=patient.phone,
        patient_age=p_age,
        patient_gender=p_gender,
        doctor_name=doc_display,
        doctor_specialization=doctor.specialization,
        diagnosis=request.diagnosis or chief_complaint,
        bed_assignment=request.bed_assignment or "OPD",
        general_advice=prescription.general_advice,
        diet_instructions=prescription.diet_instructions,
        follow_up_date=prescription.follow_up_date,
        verification_hash=prescription.verification_hash,
        is_finalized=prescription.is_finalized,
        created_at=prescription.created_at,
        items=[
            PrescriptionItemResponse(
                id=item.id,
                prescription_id=item.prescription_id,
                medicine_id=item.medicine_id,
                medicine_name=item.medicine_name,
                generic_name=item.generic_name,
                dosage=item.dosage,
                frequency=item.frequency,
                duration=item.duration,
                meal_timing=item.meal_timing,
                instructions=item.instructions
            )
            for item in db_items
        ],
        items_count=len(db_items)
    )


@router.post("", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    request: PrescriptionCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates and digitally signs an E-Prescription:
    1. Validates encounter.
    2. Generates sequential RX Code.
    3. Computes cryptographic SHA-256 tamper-proof verification hash.
    4. Saves itemized drugs.
    """
    enc_stmt = (
        select(Encounter)
        .where(Encounter.id == request.encounter_id, Encounter.clinic_id == tenant.clinic_id)
        .options(selectinload(Encounter.patient), selectinload(Encounter.doctor))
    )
    enc_res = await db.execute(enc_stmt)
    encounter = enc_res.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")

    rx_code = await generate_rx_code(db, tenant.clinic_id)
    now_iso = datetime.now(timezone.utc).isoformat()

    v_hash = generate_verification_hash(
        clinic_id=str(tenant.clinic_id),
        doctor_license=encounter.doctor.license_number,
        patient_mrn=encounter.patient.mrn,
        prescription_code=rx_code,
        created_at_iso=now_iso
    )

    prescription = Prescription(
        clinic_id=tenant.clinic_id,
        encounter_id=encounter.id,
        patient_id=encounter.patient_id,
        doctor_id=encounter.doctor_id,
        prescription_code=rx_code,
        general_advice=request.general_advice,
        diet_instructions=request.diet_instructions,
        follow_up_date=request.follow_up_date,
        verification_hash=v_hash,
        is_finalized=True,
        signed_at=datetime.now(timezone.utc)
    )
    db.add(prescription)
    await db.flush()

    for item in request.items:
        p_item = PrescriptionItem(
            prescription_id=prescription.id,
            medicine_id=item.medicine_id,
            medicine_name=item.medicine_name,
            generic_name=item.generic_name,
            dosage=item.dosage,
            frequency=item.frequency,
            duration=item.duration,
            meal_timing=item.meal_timing,
            instructions=item.instructions
        )
        db.add(p_item)

    await db.commit()
    await db.refresh(prescription)

    stmt = select(Prescription).where(Prescription.id == prescription.id).options(selectinload(Prescription.items))
    res = await db.execute(stmt)
    return res.scalar_one()


async def get_prescription_bundle(
    db: AsyncSession,
    prescription_id: uuid.UUID,
    tenant: TenantContext,
    current_user: User
) -> dict:
    """Helper to load all relational data required for PDF & HTML generation with role access validation."""
    stmt = (
        select(Prescription)
        .where(Prescription.id == prescription_id)
        .options(
            selectinload(Prescription.items),
            selectinload(Prescription.patient).selectinload(Patient.user),
            selectinload(Prescription.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user),
            selectinload(Prescription.encounter).selectinload(Encounter.vitals)
        )
    )
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not found")

    # Role-based access control
    if current_user.system_role == SystemRole.SUPER_ADMIN:
        pass
    elif current_user.system_role == SystemRole.PATIENT:
        is_owner = False
        if tenant.patient and rx.patient_id == tenant.patient.id:
            is_owner = True
        elif rx.patient and rx.patient.user_id == current_user.id:
            is_owner = True
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own prescriptions."
            )
    else:
        # Doctor or Staff
        user_doc_id = None
        doc_stmt = select(DoctorProfile.id).where(
            (DoctorProfile.user_id == current_user.id) |
            (DoctorProfile.staff_id.in_(select(ClinicStaff.id).where(ClinicStaff.user_id == current_user.id)))
        )
        doc_res = await db.execute(doc_stmt)
        user_doc_id = doc_res.scalar_one_or_none()
        if rx.clinic_id != tenant.clinic_id and (not user_doc_id or rx.doctor_id != user_doc_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this prescription."
            )

    clinic_res = await db.execute(select(Clinic).where(Clinic.id == rx.clinic_id))
    clinic = clinic_res.scalar_one_or_none()
    if not clinic:
        clinic = tenant.clinic

    doctor_user = rx.doctor.staff.user if rx.doctor and rx.doctor.staff else None
    if not doctor_user and rx.doctor:
        u_res = await db.execute(select(User).where(User.id == rx.doctor.user_id))
        doctor_user = u_res.scalar_one_or_none()

    doc_full = f"{doctor_user.first_name} {doctor_user.last_name}".strip() if doctor_user else "Doctor"
    doc_display = doc_full if doc_full.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {doc_full}"

    p_full = f"{rx.patient.first_name or ''} {rx.patient.last_name or ''}".strip() if rx.patient else ""
    if not p_full and rx.patient and rx.patient.user:
        p_full = f"{rx.patient.user.first_name or ''} {rx.patient.user.last_name or ''}".strip()
    patient_display = p_full or "Patient"

    p_age = None
    if rx.patient and rx.patient.date_of_birth:
        p_age = datetime.now().year - rx.patient.date_of_birth.year

    p_phone = rx.patient.phone if rx.patient else None
    if not p_phone and rx.patient and rx.patient.user:
        p_phone = rx.patient.user.phone

    # Check for active hospital bed / cabin / ICU assignment
    unit_stmt = select(HospitalUnit).where(
        HospitalUnit.current_patient_id == rx.patient_id,
        HospitalUnit.status == "BOOKED",
        HospitalUnit.is_deleted == False
    ).limit(1)
    unit_res = await db.execute(unit_stmt)
    unit = unit_res.scalar_one_or_none()
    bed_assignment = f"{unit.category} ({unit.unit_name} - Floor {unit.floor})" if unit else "Outpatient / OPD"

    vitals = rx.encounter.vitals if rx.encounter else None
    encounter = rx.encounter

    # Formatted items list
    items_list = []
    for i in rx.items:
        meal_timing_val = i.meal_timing.value if hasattr(i.meal_timing, "value") else str(i.meal_timing)
        if "AFTER" in meal_timing_val.upper():
            meal_display = "After Meal / খাবার পর"
        elif "BEFORE" in meal_timing_val.upper():
            meal_display = "Before Meal / খাবার আগে"
        elif "WITH" in meal_timing_val.upper():
            meal_display = "With Meal / খাবারের সাথে"
        else:
            meal_display = meal_timing_val

        items_list.append({
            "medicine_name": i.medicine_name,
            "generic_name": i.generic_name or "",
            "dosage": i.dosage or "1 Tab",
            "frequency": i.frequency or "1+0+1",
            "duration": i.duration or "7 Days",
            "meal_timing": meal_display,
            "instructions": i.instructions or ""
        })

    return {
        "id": str(rx.id),
        "clinic_name": clinic.name,
        "clinic_address": f"{clinic.address_line1}, {clinic.city}" if clinic.address_line1 else f"{clinic.city}, Bangladesh",
        "clinic_phone": clinic.phone or "+880 1700-000000",
        "clinic_email": clinic.email or "care@metrohealth.com",
        "clinic_emergency": "Hotline: 10678 | +880 1700-000000",
        "prescription_code": rx.prescription_code,
        "verification_hash": rx.verification_hash,
        "verify_url": f"http://localhost:3000/verify-rx?code={rx.verification_hash}",
        "date": rx.created_at.strftime("%Y-%m-%d"),
        "time": rx.created_at.strftime("%I:%M %p"),
        "patient_name": patient_display,
        "patient_gender": rx.patient.gender.value if (rx.patient and hasattr(rx.patient.gender, 'value')) else str(rx.patient.gender if rx.patient else 'N/A'),
        "patient_dob": str(rx.patient.date_of_birth) if (rx.patient and rx.patient.date_of_birth) else "N/A",
        "patient_age": p_age or "N/A",
        "patient_mrn": rx.patient.mrn if rx.patient else "MRN-N/A",
        "patient_phone": p_phone or "N/A",
        "patient_blood_group": rx.patient.blood_group if rx.patient else "N/A",
        "patient_allergies": rx.patient.allergies if (rx.patient and rx.patient.allergies) else "None Reported (NKDA)",
        "bed_assignment": bed_assignment,
        "doctor_name": doc_display,
        "doctor_degrees": (rx.doctor.qualifications if rx.doctor and rx.doctor.qualifications else "MBBS, FCPS"),
        "doctor_specialization": rx.doctor.specialization if rx.doctor else "General Medicine",
        "doctor_license": rx.doctor.license_number if rx.doctor else "BMDC-Reg-Pending",
        "doctor_chamber": (rx.doctor.chamber_location if rx.doctor and rx.doctor.chamber_location else "Room 302, 3rd Floor, Main OPD"),
        "visiting_days": (rx.doctor.visiting_days if rx.doctor and rx.doctor.visiting_days else "Sat - Thu"),
        "visiting_hours": (rx.doctor.visiting_hours if rx.doctor and rx.doctor.visiting_hours else "5:00 PM - 9:00 PM"),
        "chief_complaint": encounter.chief_complaint if encounter and encounter.chief_complaint else "Clinical Consultation",
        "diagnosis": (encounter.clinical_summary if encounter and encounter.clinical_summary else (rx.diet_instructions or "Essential Hypertension / General Assessment")),
        "general_advice": rx.general_advice or "Drink plenty of water (2.5L daily), maintain a balanced diet, and rest properly.",
        "diet_instructions": rx.diet_instructions or "Low sodium, avoid oily and spicy food.",
        "follow_up_date": str(rx.follow_up_date) if rx.follow_up_date else "After 7-14 Days / As Needed",
        "vitals": {
            "bp": f"{vitals.systolic_bp}/{vitals.diastolic_bp} mmHg" if vitals and vitals.systolic_bp else "120/80 mmHg",
            "pulse": f"{vitals.pulse_rate} bpm" if vitals and vitals.pulse_rate else "72 bpm",
            "temp": f"{vitals.temperature_celsius}°C" if vitals and vitals.temperature_celsius else "98.4°F",
            "weight": f"{vitals.weight_kg} kg" if vitals and vitals.weight_kg else "N/A",
            "height": f"{vitals.height_cm} cm" if vitals and vitals.height_cm else "N/A",
            "bmi": f"{vitals.bmi}" if vitals and vitals.bmi else "N/A",
            "spo2": f"{vitals.spo2_percent}%" if vitals and vitals.spo2_percent else "99%",
            "glucose": f"{vitals.blood_glucose_random} mmol/L" if vitals and vitals.blood_glucose_random else "N/A",
        } if vitals else {
            "bp": "120/80 mmHg", "pulse": "74 bpm", "temp": "98.4°F", "weight": "N/A", "spo2": "99%", "glucose": "N/A"
        },
        "items": items_list
    }


@router.get("/{prescription_id}/pdf")
async def download_prescription_pdf(
    prescription_id: uuid.UUID,
    token: Optional[str] = Query(None),
    tenant: TenantContext = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Streams the official E-Prescription as a downloadable/printable PDF binary."""
    bundle = await get_prescription_bundle(db, prescription_id, tenant, current_user)
    pdf_bytes = build_prescription_pdf(bundle)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename={bundle['prescription_code']}.pdf"
        }
    )


@router.get("/{prescription_id}/print-html", response_class=Response)
async def view_prescription_print_html(
    prescription_id: uuid.UUID,
    token: Optional[str] = Query(None),
    tenant: TenantContext = Depends(get_current_tenant),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns styled HTML view optimized for one-click browser printing (Ctrl+P / window.print)."""
    bundle = await get_prescription_bundle(db, prescription_id, tenant, current_user)
    html_content = build_prescription_html(bundle)
    return Response(content=html_content, media_type="text/html")


@router.get("/verify/{verification_hash}", response_model=PrescriptionVerifyResponse)
async def verify_prescription_authenticity(
    verification_hash: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Public Authentication Verification:
    Pharmacies, insurers, or patients can scan the QR code to verify
    tamper-proof prescription validity without requiring system login.
    """
    stmt = (
        select(Prescription)
        .where(Prescription.verification_hash == verification_hash)
        .options(
            selectinload(Prescription.clinic),
            selectinload(Prescription.patient),
            selectinload(Prescription.doctor).selectinload(DoctorProfile.staff).selectinload(ClinicStaff.user),
            selectinload(Prescription.items)
        )
    )
    res = await db.execute(stmt)
    rx = res.scalar_one_or_none()
    if not rx:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or counterfeit prescription token. Record not found."
        )

    doc_user = rx.doctor.staff.user if rx.doctor and rx.doctor.staff else None

    doc_display = "Doctor"
    if doc_user:
        dfull = f"{doc_user.first_name} {doc_user.last_name}".strip()
        doc_display = dfull if dfull.lower().startswith(("dr.", "dr ", "prof.", "prof ")) else f"Dr. {dfull}"

    return PrescriptionVerifyResponse(
        is_valid=True,
        prescription_code=rx.prescription_code,
        issued_date=rx.created_at,
        clinic_name=rx.clinic.name,
        doctor_name=doc_display,
        doctor_license=rx.doctor.license_number,
        patient_name=f"{rx.patient.first_name[0]}*** {rx.patient.last_name}",
        item_count=len(rx.items)
    )
