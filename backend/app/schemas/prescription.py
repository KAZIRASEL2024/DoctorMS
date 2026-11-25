"""Prescription and Formulary Pydantic v2 schemas."""
import uuid
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.prescription import DosageForm, MealTiming


class MedicineCreate(BaseModel):
    brand_name: str
    generic_name: str
    dosage_form: DosageForm = DosageForm.TABLET
    strength: str
    manufacturer: Optional[str] = None


class MedicineResponse(MedicineCreate):
    id: uuid.UUID
    clinic_id: Optional[uuid.UUID] = None
    is_active: bool

    class Config:
        from_attributes = True


class PrescriptionItemCreate(BaseModel):
    medicine_id: Optional[uuid.UUID] = None
    medicine_name: str
    generic_name: Optional[str] = None
    dosage: str = Field(description="e.g. 500mg, 1 tablet")
    frequency: str = Field(description="e.g. 1-0-1, TID, Once daily")
    duration: str = Field(description="e.g. 5 days, 1 month")
    meal_timing: MealTiming = MealTiming.AFTER_MEAL
    instructions: Optional[str] = None


class PrescriptionItemResponse(PrescriptionItemCreate):
    id: uuid.UUID
    prescription_id: uuid.UUID

    class Config:
        from_attributes = True


class PrescriptionCreate(BaseModel):
    encounter_id: uuid.UUID
    general_advice: Optional[str] = None
    diet_instructions: Optional[str] = None
    follow_up_date: Optional[date] = None
    items: List[PrescriptionItemCreate] = []


class PrescriptionResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    encounter_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    prescription_code: str
    general_advice: Optional[str] = None
    diet_instructions: Optional[str] = None
    follow_up_date: Optional[date] = None
    verification_hash: str
    is_finalized: bool
    signed_at: Optional[datetime] = None
    items: List[PrescriptionItemResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class DirectConsultationPrescriptionCreate(BaseModel):
    appointment_id: uuid.UUID
    symptoms: Optional[str] = None
    diagnosis: Optional[str] = None
    bed_assignment: Optional[str] = "OPD"
    vitals: Optional[dict] = None
    general_advice: Optional[str] = None
    diet_instructions: Optional[str] = None
    follow_up_date: Optional[date] = None
    items: List[PrescriptionItemCreate] = []


class PrescriptionListItemResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    encounter_id: Optional[uuid.UUID] = None
    appointment_id: Optional[uuid.UUID] = None
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    prescription_code: str
    patient_name: str
    patient_mrn: str
    patient_phone: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    doctor_name: str
    doctor_specialization: Optional[str] = None
    diagnosis: Optional[str] = None
    bed_assignment: Optional[str] = None
    general_advice: Optional[str] = None
    diet_instructions: Optional[str] = None
    follow_up_date: Optional[date] = None
    verification_hash: str
    is_finalized: bool
    created_at: datetime
    items: List[PrescriptionItemResponse] = []
    items_count: int = 0

    class Config:
        from_attributes = True


class PrescriptionVerifyResponse(BaseModel):
    is_valid: bool
    prescription_code: str
    issued_date: datetime
    clinic_name: str
    doctor_name: str
    doctor_license: str
    patient_name: str
    item_count: int
