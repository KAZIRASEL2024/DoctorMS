"""Patient management Pydantic v2 schemas."""
import uuid
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field
from app.models.patient import Gender, BloodGroup


class PatientCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    date_of_birth: date
    gender: Gender
    blood_group: BloodGroup = BloodGroup.UNKNOWN
    phone: str = Field(min_length=5, max_length=50)
    email: Optional[EmailStr] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []
    notes: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[BloodGroup] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address_line: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    notes: Optional[str] = None


class PatientResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    mrn: str
    first_name: str
    last_name: str
    date_of_birth: date
    gender: Gender
    blood_group: BloodGroup
    phone: str
    email: Optional[str] = None
    address_line: Optional[str] = None
    city: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    allergies: List[str] = []
    chronic_conditions: List[str] = []
    notes: Optional[str] = None
    created_at: datetime
    lab_reports_count: int = 0

    class Config:
        from_attributes = True
