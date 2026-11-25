"""Schemas for Hospital Units (Bed / Cabin / ICU / CCU)."""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class UnitBase(BaseModel):
    unit_code: str = Field(..., example="BED-101")
    unit_name: str = Field(..., example="General Ward Bed 101")
    category: str = Field(..., example="General Bed")  # General Bed, Cabin, ICU, CCU
    floor: Optional[str] = Field("1st Floor", example="1st Floor")
    daily_price: float = Field(0.0, ge=0, example=500.0)


class UnitCreate(UnitBase):
    pass


class UnitUpdate(BaseModel):
    unit_code: Optional[str] = None
    unit_name: Optional[str] = None
    category: Optional[str] = None
    floor: Optional[str] = None
    daily_price: Optional[float] = Field(None, ge=0)


class UnitAssignRequest(BaseModel):
    patient_id: uuid.UUID
    doctor_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class UnitResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    unit_code: str
    unit_name: str
    category: str
    floor: Optional[str] = None
    daily_price: float
    status: str  # FREE or BOOKED
    confirmation_status: Optional[str] = "Confirmed"  # Pending Reception or Confirmed
    current_patient_id: Optional[uuid.UUID] = None
    current_doctor_id: Optional[uuid.UUID] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_name: Optional[str] = None
    assigned_at: Optional[datetime] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
