"""Nurse profiles and Home Care Nurse Bookings."""
import enum
import uuid
from typing import Optional, List
from datetime import date, datetime
from sqlalchemy import (
    String, Boolean, Integer, Numeric, Date, DateTime, ForeignKey, Index, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin


class NurseBookingStatus(str, enum.Enum):
    PENDING = "Pending"
    CONFIRMED = "Confirmed"
    COMPLETED = "Completed"
    CANCELLED = "Cancelled"


class NurseProfile(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Profile for registered nurses offering hospital and home-care nursing services.
    """
    __tablename__ = "nurse_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True
    )
    full_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    education: Mapped[str] = mapped_column(String(255), nullable=False, comment="e.g. BSc in Nursing, Dhaka Nursing College")
    experience_years: Mapped[str] = mapped_column(String(100), nullable=False, comment="e.g. 5+ Years (ICU & Home Care)")
    service_location: Mapped[str] = mapped_column(String(255), nullable=False, index=True, comment="e.g. Dhanmondi, Dhaka")
    service_fee_bdt: Mapped[float] = mapped_column(Numeric(12, 2), default=1200.00, nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    bookings: Mapped[List["NurseBooking"]] = relationship("NurseBooking", back_populates="nurse", cascade="all, delete-orphan")


class NurseBooking(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Home-care nursing reservation booked by a patient.
    """
    __tablename__ = "nurse_bookings"

    booking_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    nurse_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nurse_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    service_date: Mapped[date] = mapped_column(Date, nullable=False)
    shift_time: Mapped[str] = mapped_column(String(100), nullable=False, comment="Day Shift / Night Shift / 24-Hour Care")
    patient_address: Mapped[str] = mapped_column(String(255), nullable=False)
    care_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fee_bdt: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Pending", nullable=False, index=True)

    # Contracted hours & Duty Tracking
    contracted_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=4.0, nullable=False)
    hourly_rate_bdt: Mapped[float] = mapped_column(Numeric(12, 2), default=300.0, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(50), default="Due", nullable=False, index=True)
    duty_status: Mapped[str] = mapped_column(String(50), default="Awaiting Payment", nullable=False, index=True)
    duty_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    duty_ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_worked_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    overtime_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0, nullable=False)
    overtime_due_bdt: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    overtime_invoice_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Relationships
    nurse: Mapped["NurseProfile"] = relationship("NurseProfile", back_populates="bookings")
    patient = relationship("Patient", foreign_keys=[patient_id])
    invoice = relationship("Invoice", foreign_keys=[invoice_id])
    overtime_invoice = relationship("Invoice", foreign_keys=[overtime_invoice_id])
