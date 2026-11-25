"""Electronic Medical Records (EMR): Encounters, Vitals, SOAP notes & Diagnoses."""
import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_tenant, require_roles, TenantContext, log_audit_event
from app.models.emr import Encounter, VitalSign, SoapNote, ClinicalDiagnosis
from app.models.appointment import Appointment, AppointmentStatus
from app.models.patient import Patient
from app.models.doctor import DoctorProfile
from app.models.user import ClinicRole, AuditAction
from app.schemas.emr import (
    EncounterCreate, EncounterResponse, VitalSignCreate, VitalSignResponse,
    SoapNoteCreate, SoapNoteResponse, ClinicalDiagnosisCreate, ClinicalDiagnosisResponse
)

router = APIRouter(prefix="/emr", tags=["EMR & Clinical Records"])


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    """Computes Body Mass Index (BMI): kg / (m^2)."""
    if height_cm <= 0 or weight_kg <= 0:
        return 0.0
    height_m = height_cm / 100.0
    return round(weight_kg / (height_m * height_m), 1)


@router.post("/encounters", response_model=EncounterResponse, status_code=status.HTTP_201_CREATED)
async def create_encounter(
    request: EncounterCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Initializes or opens a clinical consultation encounter for a patient."""
    encounter = Encounter(
        clinic_id=tenant.clinic_id,
        appointment_id=request.appointment_id,
        patient_id=request.patient_id,
        doctor_id=request.doctor_id,
        chief_complaint=request.chief_complaint,
        clinical_summary=request.clinical_summary,
        encounter_date=datetime.now(timezone.utc)
    )
    db.add(encounter)

    # If linked to appointment, set status to IN_CONSULTATION
    if request.appointment_id:
        appt_res = await db.execute(
            select(Appointment).where(
                Appointment.id == request.appointment_id,
                Appointment.clinic_id == tenant.clinic_id
            )
        )
        appt = appt_res.scalar_one_or_none()
        if appt:
            appt.status = AppointmentStatus.IN_CONSULTATION

    await db.commit()
    await db.refresh(encounter)

    # Reload relationships
    stmt = (
        select(Encounter)
        .where(Encounter.id == encounter.id)
        .options(
            selectinload(Encounter.vitals),
            selectinload(Encounter.soap_note),
            selectinload(Encounter.diagnoses)
        )
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/encounters/{encounter_id}", response_model=EncounterResponse)
async def get_encounter(
    encounter_id: uuid.UUID,
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves complete clinical encounter record including vitals, SOAP notes, and diagnoses."""
    stmt = (
        select(Encounter)
        .where(Encounter.id == encounter_id, Encounter.clinic_id == tenant.clinic_id)
        .options(
            selectinload(Encounter.vitals),
            selectinload(Encounter.soap_note),
            selectinload(Encounter.diagnoses)
        )
    )
    res = await db.execute(stmt)
    encounter = res.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")

    await log_audit_event(
        db=db,
        action=AuditAction.READ,
        resource_type="Encounter",
        resource_id=str(encounter.id),
        clinic_id=tenant.clinic_id,
        user_id=tenant.staff.user_id if tenant.staff else None,
        patient_id=encounter.patient_id
    )

    return encounter


@router.post("/encounters/{encounter_id}/vitals", response_model=VitalSignResponse)
async def record_vitals(
    encounter_id: uuid.UUID,
    request: VitalSignCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST])),
    db: AsyncSession = Depends(get_db)
):
    """Records patient triage vitals and automatically calculates BMI."""
    enc_res = await db.execute(
        select(Encounter).where(Encounter.id == encounter_id, Encounter.clinic_id == tenant.clinic_id)
    )
    encounter = enc_res.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")

    bmi = None
    if request.weight_kg and request.height_cm:
        bmi = calculate_bmi(request.weight_kg, request.height_cm)

    # Check if vitals already recorded for this encounter
    existing_res = await db.execute(select(VitalSign).where(VitalSign.encounter_id == encounter_id))
    vital = existing_res.scalar_one_or_none()

    if not vital:
        vital = VitalSign(
            clinic_id=tenant.clinic_id,
            encounter_id=encounter_id,
            patient_id=encounter.patient_id,
            recorded_by_id=tenant.staff.user_id if tenant.staff else encounter.doctor_id
        )
        db.add(vital)

    vital.systolic_bp = request.systolic_bp
    vital.diastolic_bp = request.diastolic_bp
    vital.pulse_rate = request.pulse_rate
    vital.temperature_celsius = request.temperature_celsius
    vital.respiratory_rate = request.respiratory_rate
    vital.spo2_percent = request.spo2_percent
    vital.height_cm = request.height_cm
    vital.weight_kg = request.weight_kg
    vital.bmi = bmi
    vital.blood_glucose_random = request.blood_glucose_random
    vital.clinical_notes = request.clinical_notes

    await db.commit()
    await db.refresh(vital)
    return vital


@router.post("/encounters/{encounter_id}/soap", response_model=SoapNoteResponse)
async def record_soap_note(
    encounter_id: uuid.UUID,
    request: SoapNoteCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Documents clinical progress notes in standardized SOAP format (Subjective, Objective, Assessment, Plan)."""
    enc_res = await db.execute(
        select(Encounter).where(Encounter.id == encounter_id, Encounter.clinic_id == tenant.clinic_id)
    )
    encounter = enc_res.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")

    if encounter.is_finalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Encounter is finalized and locked against direct edits. Please file an addendum."
        )

    existing_soap = await db.execute(select(SoapNote).where(SoapNote.encounter_id == encounter_id))
    soap = existing_soap.scalar_one_or_none()

    if not soap:
        soap = SoapNote(
            clinic_id=tenant.clinic_id,
            encounter_id=encounter_id,
            doctor_id=encounter.doctor_id
        )
        db.add(soap)

    soap.subjective = request.subjective
    soap.objective = request.objective
    soap.assessment = request.assessment
    soap.plan = request.plan

    await db.commit()
    await db.refresh(soap)

    await log_audit_event(
        db=db,
        action=AuditAction.UPDATE,
        resource_type="SoapNote",
        resource_id=str(soap.id),
        clinic_id=tenant.clinic_id,
        user_id=tenant.staff.user_id if tenant.staff else None,
        patient_id=encounter.patient_id
    )

    return soap


@router.post("/encounters/{encounter_id}/diagnoses", response_model=ClinicalDiagnosisResponse, status_code=status.HTTP_201_CREATED)
async def add_clinical_diagnosis(
    encounter_id: uuid.UUID,
    request: ClinicalDiagnosisCreate,
    tenant: TenantContext = Depends(require_roles([ClinicRole.DOCTOR, ClinicRole.CLINIC_ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    """Appends an ICD-10 coded diagnosis to the patient encounter."""
    enc_res = await db.execute(
        select(Encounter).where(Encounter.id == encounter_id, Encounter.clinic_id == tenant.clinic_id)
    )
    encounter = enc_res.scalar_one_or_none()
    if not encounter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Encounter not found")

    diagnosis = ClinicalDiagnosis(
        clinic_id=tenant.clinic_id,
        encounter_id=encounter_id,
        icd10_code=request.icd10_code,
        diagnosis_name=request.diagnosis_name,
        diagnosis_type=request.diagnosis_type,
        status=request.status,
        comments=request.comments
    )
    db.add(diagnosis)
    await db.commit()
    await db.refresh(diagnosis)
    return diagnosis
