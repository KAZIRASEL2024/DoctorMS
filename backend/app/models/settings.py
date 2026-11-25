"""Hospital Website Settings and CMS Model."""
import uuid
from typing import Optional
from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WebsiteSettings(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Hospital/Clinic Public Website & CMS Settings.
    Managed by Super Admin & Clinic Admins.
    """
    __tablename__ = "website_settings"

    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=True,
        unique=True,
        index=True
    )

    hospital_name: Mapped[str] = mapped_column(
        String(255),
        default="Metro Health Polyclinic & Hospital",
        nullable=False
    )
    tagline: Mapped[str] = mapped_column(
        String(255),
        default="Excellence in Compassionate Care & Advanced Medicine",
        nullable=False
    )
    emergency_hotline: Mapped[str] = mapped_column(
        String(50),
        default="+880 1711-001122",
        nullable=False
    )
    contact_email: Mapped[str] = mapped_column(
        String(255),
        default="care@metrohealth.com",
        nullable=False
    )
    address: Mapped[str] = mapped_column(
        String(255),
        default="100 Medical Plaza, Suite 400, Dhaka, Bangladesh",
        nullable=False
    )
    hero_title: Mapped[str] = mapped_column(
        String(255),
        default="World-Class Healthcare, Close to You",
        nullable=False
    )
    hero_subtitle: Mapped[str] = mapped_column(
        Text,
        default="Experience seamless medical appointments, digital prescriptions, and expert diagnostics from top certified specialists.",
        nullable=False
    )
    logo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hero_image_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    favicon_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
