"""Clinic and Clinic Staff Pydantic v2 schemas."""
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.user import ClinicRole
from app.models.tenant import SubscriptionPlan, SubscriptionStatus


class ClinicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=5, max_length=50)
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str = "BD"
    timezone: str = "Asia/Dhaka"
    currency: str = "BDT"
    plan: SubscriptionPlan = SubscriptionPlan.STARTER


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    city: Optional[str] = None
    timezone: Optional[str] = None
    currency: Optional[str] = None
    logo_url: Optional[str] = None
    letterhead_template: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class ClinicResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    email: EmailStr
    phone: str
    address_line1: str
    city: str
    country: str
    timezone: str
    currency: str
    logo_url: Optional[str] = None
    letterhead_template: Dict[str, Any]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StaffCreate(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: ClinicRole
    designation: Optional[str] = None
    department: Optional[str] = None
    temporary_password: str = Field(min_length=8)
    consultation_fee: Optional[float] = 1000.0
    follow_up_fee: Optional[float] = 500.0
    specialization: Optional[str] = None
    specialty: Optional[str] = None
    qualifications: Optional[str] = None
    degrees: Optional[str] = None
    chamber_location: Optional[str] = None
    visiting_days: Optional[str] = None
    visiting_hours: Optional[str] = None
    license_number: Optional[str] = None
    is_available: Optional[bool] = True


class DoctorFeeUpdate(BaseModel):
    consultation_fee: float = Field(ge=0)
    follow_up_fee: float = Field(ge=0)
    specialization: Optional[str] = None
    specialty: Optional[str] = None
    qualifications: Optional[str] = None
    degrees: Optional[str] = None
    chamber_location: Optional[str] = None
    visiting_days: Optional[str] = None
    visiting_hours: Optional[str] = None
    is_available_for_booking: Optional[bool] = True


class StaffResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    clinic_id: uuid.UUID
    email: EmailStr
    first_name: str
    last_name: str
    role: ClinicRole
    designation: Optional[str] = None
    department: Optional[str] = None
    is_active: bool
    created_at: datetime
    # Doctor specific metadata if applicable
    doctor_id: Optional[uuid.UUID] = None
    specialization: Optional[str] = None
    specialty: Optional[str] = None
    qualifications: Optional[str] = None
    degrees: Optional[str] = None
    chamber_location: Optional[str] = None
    visiting_days: Optional[str] = None
    visiting_hours: Optional[str] = None
    consultation_fee: Optional[float] = None
    follow_up_fee: Optional[float] = None
    is_available_for_booking: Optional[bool] = None

    class Config:
        from_attributes = True
