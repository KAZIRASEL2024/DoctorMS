"""Doctor profiles, schedules, leaves, and slot query schemas."""
import uuid
from typing import Optional, List
from datetime import time, date, datetime
from pydantic import BaseModel, Field
from app.models.doctor import LeaveStatus


class DoctorBreakBase(BaseModel):
    break_name: str = "Lunch Break"
    start_time: time
    end_time: time


class DoctorBreakResponse(DoctorBreakBase):
    id: uuid.UUID

    class Config:
        from_attributes = True


class DoctorScheduleCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6, description="0=Monday, 6=Sunday")
    shift_start_time: time
    shift_end_time: time
    slot_duration_minutes: int = Field(default=20, ge=5, le=120)
    buffer_time_minutes: int = Field(default=5, ge=0, le=30)
    breaks: List[DoctorBreakBase] = []


class DoctorScheduleResponse(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    day_of_week: int
    shift_start_time: time
    shift_end_time: time
    slot_duration_minutes: int
    buffer_time_minutes: int
    is_active: bool
    breaks: List[DoctorBreakResponse] = []

    class Config:
        from_attributes = True


class DayScheduleItem(BaseModel):
    day: int = Field(ge=0, le=6, description="0=Monday, 6=Sunday")
    name: Optional[str] = None
    is_active: bool = True
    start_time: str = "08:00"
    end_time: str = "17:00"
    lunch_start: Optional[str] = "12:00"
    lunch_end: Optional[str] = "13:00"


class DoctorScheduleUpdateRequest(BaseModel):
    current_status: Optional[str] = None
    available_from_time: Optional[str] = None
    status_note: Optional[str] = None
    slot_duration: Optional[int] = 20
    buffer_time: Optional[int] = 5
    weekly_schedule: Optional[List[DayScheduleItem]] = None


class DoctorScheduleOverviewResponse(BaseModel):
    doctor_id: uuid.UUID
    current_status: str = "Available"
    available_from_time: Optional[str] = None
    status_note: Optional[str] = None
    slot_duration: int = 20
    buffer_time: int = 5
    weekly_schedule: List[DayScheduleItem] = []


class DoctorLeaveCreate(BaseModel):
    start_date: date
    end_date: date
    reason: str


class DoctorLeaveResponse(BaseModel):
    id: uuid.UUID
    doctor_id: uuid.UUID
    doctor_name: Optional[str] = None
    doctor_specialization: Optional[str] = None
    doctor_avatar: Optional[str] = None
    start_date: date
    end_date: date
    reason: str
    status: str
    status_display: Optional[str] = None
    total_days: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeaveStatusUpdate(BaseModel):
    status: str  # "APPROVED" | "REJECTED" | "PENDING"


class DoctorProfileCreate(BaseModel):
    user_id: uuid.UUID
    specialization: str
    specialty: Optional[str] = None
    category: Optional[str] = None
    license_number: str
    qualifications: str
    degrees: Optional[str] = None
    chamber_location: Optional[str] = None
    visiting_days: Optional[str] = None
    visiting_hours: Optional[str] = None
    experience_years: int = 0
    consultation_fee: float = 0.00
    follow_up_fee: float = 0.00
    follow_up_validity_days: int = 14
    bio: Optional[str] = None


class DoctorProfileUpdate(BaseModel):
    specialization: Optional[str] = None
    specialty: Optional[str] = None
    category: Optional[str] = None
    qualifications: Optional[str] = None
    degrees: Optional[str] = None
    license_number: Optional[str] = None
    chamber_location: Optional[str] = None
    visiting_days: Optional[str] = None
    visiting_hours: Optional[str] = None
    consultation_fee: Optional[float] = None
    follow_up_fee: Optional[float] = None
    follow_up_validity_days: Optional[int] = None
    is_available_for_booking: Optional[bool] = None
    bio: Optional[str] = None



class DoctorProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    clinic_id: uuid.UUID
    first_name: str
    last_name: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    specialization: str
    specialty: Optional[str] = None
    category: Optional[str] = None
    license_number: str
    qualifications: str
    degrees: Optional[str] = None
    chamber_location: Optional[str] = None
    visiting_days: Optional[str] = None
    visiting_hours: Optional[str] = None
    consultation_fee: float
    follow_up_fee: float
    is_available_for_booking: bool
    current_status: Optional[str] = "Available"
    status_note: Optional[str] = None
    available_from_time: Optional[str] = None
    confirmed_leaves: Optional[List[DoctorLeaveResponse]] = []
    weekly_schedule: Optional[List[dict]] = []

    class Config:
        from_attributes = True


class TimeSlot(BaseModel):
    start_time: datetime
    end_time: datetime
    is_available: bool
    reason: Optional[str] = None  # None, "BOOKED", "BREAK", "LEAVE"


class AvailableSlotsResponse(BaseModel):
    doctor_id: uuid.UUID
    date: date
    slot_duration_minutes: int
    slots: List[TimeSlot]
