"""Doctor profiles, working schedules, breaks, and leaves."""
import enum
import uuid
from typing import Optional, List
from datetime import time, date
from sqlalchemy import String, Boolean, Integer, Numeric, Time, Date, Enum as SAEnum, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin


class LeaveStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class DoctorProfile(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Doctor credentials, fees, and operational parameters within a clinic.
    """
    __tablename__ = "doctor_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    staff_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinic_staff.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )

    specialization: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    license_number: Mapped[str] = mapped_column(String(100), nullable=False)
    qualifications: Mapped[str] = mapped_column(String(255), nullable=False, comment="e.g. MBBS, MD, FRCS")
    experience_years: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    
    # Financial fees for auto-invoicing
    consultation_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    follow_up_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0.00, nullable=False)
    follow_up_validity_days: Mapped[int] = mapped_column(Integer, default=14, nullable=False)

    chamber_location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    visiting_days: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    visiting_hours: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Live Clinical Duty Status & OT Availability
    current_status: Mapped[str] = mapped_column(String(50), default="Available", nullable=False)
    status_note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    available_from_time: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    weekly_schedule: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    signature_image_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    is_available_for_booking: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    staff: Mapped["ClinicStaff"] = relationship("ClinicStaff", back_populates="doctor_profile")
    schedules: Mapped[List["DoctorSchedule"]] = relationship(
        "DoctorSchedule",
        back_populates="doctor",
        cascade="all, delete-orphan"
    )
    leaves: Mapped[List["DoctorLeave"]] = relationship(
        "DoctorLeave",
        back_populates="doctor",
        cascade="all, delete-orphan"
    )
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="doctor"
    )

    __table_args__ = (
        Index("ix_doctor_profiles_clinic_user", "clinic_id", "user_id", unique=True),
        Index("ix_doctor_profiles_clinic_specialization", "clinic_id", "specialization"),
    )


class DoctorSchedule(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Weekly recurring availability rules for appointment slot generation.
    day_of_week: 0 = Monday, 1 = Tuesday, ..., 6 = Sunday.
    """
    __tablename__ = "doctor_schedules"

    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False, comment="0=Mon, 6=Sun")
    shift_start_time: Mapped[time] = mapped_column(Time, nullable=False)
    shift_end_time: Mapped[time] = mapped_column(Time, nullable=False)
    
    # Slot generation math
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=20, nullable=False)
    buffer_time_minutes: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    max_patients_per_slot: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    doctor: Mapped["DoctorProfile"] = relationship("DoctorProfile", back_populates="schedules")
    breaks: Mapped[List["DoctorBreak"]] = relationship(
        "DoctorBreak",
        back_populates="schedule",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_doctor_schedules_lookup", "clinic_id", "doctor_id", "day_of_week"),
    )


class DoctorBreak(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Intra-shift pause windows (e.g. Lunch 13:00 - 14:00, rounds)."""
    __tablename__ = "doctor_breaks"

    schedule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_schedules.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    break_name: Mapped[str] = mapped_column(String(50), default="Lunch Break", nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)

    # Relationships
    schedule: Mapped["DoctorSchedule"] = relationship("DoctorSchedule", back_populates="breaks")


class DoctorLeave(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Date-specific blackouts/time-off that supersede regular weekly recurring schedules.
    """
    __tablename__ = "doctor_leaves"

    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[LeaveStatus] = mapped_column(
        SAEnum(LeaveStatus, native_enum=True),
        default=LeaveStatus.PENDING,
        nullable=False
    )

    # Relationships
    doctor: Mapped["DoctorProfile"] = relationship("DoctorProfile", back_populates="leaves")

    __table_args__ = (
        Index("ix_doctor_leaves_range", "clinic_id", "doctor_id", "start_date", "end_date"),
    )
