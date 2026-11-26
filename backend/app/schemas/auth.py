"""Authentication and User Pydantic v2 schemas."""
import re
import uuid
from typing import Optional, List
from datetime import datetime, date
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.user import SystemRole, ClinicRole
from app.models.patient import Gender, BloodGroup

PHONE_REGEX = re.compile(r"^01\d{9}$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterUserRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=32)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = None
    system_role: SystemRole = SystemRole.STAFF

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return v
        clean = re.sub(r"\D", "", v.strip())
        if not PHONE_REGEX.match(clean):
            raise ValueError("Phone number must start with 01 and be exactly 11 digits (e.g., 01712345678)")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6 or len(v) > 32:
            raise ValueError("Password must be between 6 and 32 characters")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must include at least 1 letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must include at least 1 number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must include at least 1 special character")
        return v


class PatientSelfRegisterRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: Optional[str] = None
    phone: str
    email: EmailStr
    password: str = Field(min_length=6, max_length=32)
    age: Optional[int] = Field(30, ge=1, le=120)
    date_of_birth: Optional[date] = None
    gender: Optional[str] = "MALE"
    blood_group: Optional[str] = "O+"
    address: Optional[str] = None
    clinic_id: Optional[uuid.UUID] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        clean = re.sub(r"\D", "", (v or "").strip())
        if not PHONE_REGEX.match(clean):
            raise ValueError("Phone number must start with 01 and be exactly 11 digits (e.g., 01712345678)")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6 or len(v) > 32:
            raise ValueError("Password must be between 6 and 32 characters")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must include at least 1 letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must include at least 1 number")
        if not re.search(r"[^A-Za-z0-9]", v):
            raise ValueError("Password must include at least 1 special character")
        return v


class ProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    # Patient fields:
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    date_of_birth: Optional[str] = None
    address_line: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None
    # Doctor fields:
    specialization: Optional[str] = None
    qualifications: Optional[str] = None
    license_number: Optional[str] = None
    consultation_fee: Optional[float] = None
    follow_up_fee: Optional[float] = None
    bio: Optional[str] = None
    signature_image_url: Optional[str] = None


class ClinicMembershipInfo(BaseModel):
    clinic_id: uuid.UUID
    clinic_name: str
    clinic_slug: str
    role: ClinicRole
    designation: Optional[str] = None
    is_active: bool


class UserResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    system_role: SystemRole
    is_active: bool
    clinic_memberships: List[ClinicMembershipInfo] = []
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse
    active_clinic_id: Optional[uuid.UUID] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


