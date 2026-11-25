"""EMR (Electronic Medical Records) Pydantic v2 schemas."""
import uuid
from typing import Optional, List, Any, Union
from datetime import datetime, date
from pydantic import BaseModel, Field
from app.models.emr import DiagnosisType, DiagnosisStatus


class VitalSignCreate(BaseModel):
    systolic_bp: Optional[int] = Field(None, ge=40, le=300, description="mmHg")
    diastolic_bp: Optional[int] = Field(None, ge=30, le=200, description="mmHg")
    pulse_rate: Optional[int] = Field(None, ge=30, le=250, description="beats per minute")
    temperature_celsius: Optional[float] = Field(None, ge=30.0, le=45.0, description="°C")
    respiratory_rate: Optional[int] = Field(None, ge=5, le=60, description="breaths per minute")
    spo2_percent: Optional[float] = Field(None, ge=50.0, le=100.0, description="Oxygen saturation %")
    height_cm: Optional[float] = Field(None, ge=30.0, le=250.0, description="cm")
    weight_kg: Optional[float] = Field(None, ge=1.0, le=400.0, description="kg")
    blood_glucose_random: Optional[float] = Field(None, ge=10.0, le=600.0, description="mg/dL")
    clinical_notes: Optional[str] = None


class VitalSignResponse(VitalSignCreate):
    id: uuid.UUID
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    bmi: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class SoapNoteCreate(BaseModel):
    subjective: str = Field(description="Patient statement, symptoms, history")
    objective: str = Field(description="Physical exam findings, vitals, lab reports")
    assessment: str = Field(description="Clinical impression, diagnosis reasoning")
    plan: str = Field(description="Prescriptions, diagnostics, follow-up instructions")


class SoapNoteResponse(SoapNoteCreate):
    id: uuid.UUID
    encounter_id: uuid.UUID
    doctor_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClinicalDiagnosisCreate(BaseModel):
    icd10_code: Optional[str] = None
    diagnosis_name: str
    diagnosis_type: DiagnosisType = DiagnosisType.PROVISIONAL
    status: DiagnosisStatus = DiagnosisStatus.ACTIVE
    comments: Optional[str] = None


class ClinicalDiagnosisResponse(ClinicalDiagnosisCreate):
    id: uuid.UUID
    encounter_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True


class EncounterCreate(BaseModel):
    appointment_id: Optional[uuid.UUID] = None
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    chief_complaint: str
    clinical_summary: Optional[str] = None


class EncounterResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    appointment_id: Optional[uuid.UUID] = None
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    encounter_date: datetime
    chief_complaint: str
    clinical_summary: Optional[str] = None
    is_finalized: bool
    vitals: Optional[VitalSignResponse] = None
    soap_note: Optional[SoapNoteResponse] = None
    diagnoses: List[ClinicalDiagnosisResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class LabReportCreate(BaseModel):
    test_name: str
    test_category: Optional[str] = "Diagnostic Pathology"
    test_date: Optional[date] = None
    result_summary: str
    findings_json: Optional[Any] = None
    report_file_url: Optional[str] = None
    status: str = "Completed"
    lab_name: Optional[str] = "Metro Diagnostic & Clinical Laboratory"
    pathologist_name: Optional[str] = "Prof. Dr. M. A. Hasan, FCPS (Pathology)"
    notes: Optional[str] = None
    doctor_id: Optional[uuid.UUID] = None


class LabReportResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: Optional[uuid.UUID] = None
    doctor_name: Optional[str] = None
    test_name: str
    test_category: Optional[str] = None
    test_date: date
    result_summary: str
    findings_json: Optional[Any] = None
    report_file_url: Optional[str] = None
    status: str
    lab_name: Optional[str] = None
    pathologist_name: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
