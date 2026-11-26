"""Hospital Website Settings Pydantic v2 schemas."""
import uuid
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class WebsiteSettingsUpdate(BaseModel):
    hospital_name: Optional[str] = None
    tagline: Optional[str] = None
    emergency_hotline: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    address: Optional[str] = None
    hero_title: Optional[str] = None
    hero_subtitle: Optional[str] = None
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    theme_preset: Optional[str] = None
    primary_color: Optional[str] = None
    button_color: Optional[str] = None
    tint_color: Optional[str] = None
    background_color: Optional[str] = None
    text_color: Optional[str] = None


class WebsiteSettingsResponse(BaseModel):
    id: uuid.UUID
    clinic_id: Optional[uuid.UUID] = None
    hospital_name: str
    tagline: str
    emergency_hotline: str
    contact_email: str
    address: str
    hero_title: str
    hero_subtitle: str
    logo_url: Optional[str] = None
    hero_image_url: Optional[str] = None
    theme_preset: str = "signature-green"
    primary_color: str = "#059669"
    button_color: str = "#047857"
    tint_color: str = "#ECFDF5"
    background_color: str = "#FFFFFF"
    text_color: str = "#0F172A"
    updated_at: datetime

    class Config:
        from_attributes = True


class LogoUploadResponse(BaseModel):
    logo_url: str
    message: str = "Logo uploaded and updated successfully"
