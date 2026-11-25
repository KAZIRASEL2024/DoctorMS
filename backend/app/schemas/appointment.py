"""Appointment and Queue Token Pydantic v2 schemas."""
import uuid
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, Field
from app.models.appointment import AppointmentStatus, AppointmentType, QueueStatus


class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    appointment_type: AppointmentType = AppointmentType.IN_PERSON
    start_time: datetime
    end_time: datetime
    reason_for_visit: Optional[str] = None
    internal_notes: Optional[str] = None


class AdminAppointmentBookRequest(BaseModel):
    # Patient Demographics
    patient_id: Optional[uuid.UUID] = None
    mrn: Optional[str] = None
    first_name: str = Field(min_length=1, max_length=100)
    middle_name: Optional[str] = None
    last_name: str = Field(min_length=1, max_length=100)
    gender: str = "MALE"
    date_of_birth: date
    blood_group: Optional[str] = "UNKNOWN"
    phone: str = Field(min_length=5, max_length=50)
    email: Optional[str] = None
    address_line: str = Field(min_length=1, max_length=255)

    # Medical History & Baseline
    chronic_conditions: Optional[List[str]] = Field(default_factory=list)
    current_medications: Optional[str] = None
    allergies: Optional[List[str]] = Field(default_factory=list)
    notes: Optional[str] = None

    # Emergency Contact
    emergency_contact_name: str = Field(min_length=1, max_length=100)
    emergency_contact_relation: str = Field(min_length=1, max_length=50)
    emergency_contact_phone: str = Field(min_length=5, max_length=50)

    # Doctor & Schedule
    doctor_id: uuid.UUID
    appointment_date: Optional[date] = None
    start_time: datetime
    end_time: datetime
    visit_type: Optional[str] = "NEW_CONSULTATION"
    reason_for_visit: str = Field(min_length=1)
    internal_notes: Optional[str] = None


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus
    cancellation_reason: Optional[str] = None


class QueueTokenResponse(BaseModel):
    id: uuid.UUID
    appointment_id: uuid.UUID
    doctor_id: uuid.UUID
    queue_date: date
    token_number: int
    token_code: str
    status: QueueStatus
    check_in_time: datetime
    called_time: Optional[datetime] = None
    consultation_start_time: Optional[datetime] = None

    class Config:
        from_attributes = True


class AppointmentResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    appointment_number: str
    appointment_type: AppointmentType
    status: AppointmentStatus
    start_time: datetime
    end_time: datetime
    reason_for_visit: Optional[str] = None
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_gender: Optional[str] = None
    patient_dob: Optional[date] = None
    patient_age: Optional[int] = None
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    doctor_avatar: Optional[str] = None
    chamber_location: Optional[str] = None
    serial_number: Optional[int] = None
    serial_code: Optional[str] = None
    queue_token: Optional[QueueTokenResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LiveQueueItem(BaseModel):
    token_id: uuid.UUID
    token_code: str
    token_number: int
    appointment_id: uuid.UUID
    patient_name: str
    doctor_name: str
    status: QueueStatus
    wait_time_minutes: int
    check_in_time: datetime
