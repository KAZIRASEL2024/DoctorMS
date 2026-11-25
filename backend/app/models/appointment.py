"""Appointment scheduling, real-time queue tokens, and double-booking prevention."""
import enum
import uuid
from typing import Optional, List
from datetime import datetime, date
from sqlalchemy import (
    String, Boolean, Integer, DateTime, Date, Enum as SAEnum, ForeignKey, Index, Text, func, text
)
from sqlalchemy.dialects.postgresql import UUID, ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    IN_CONSULTATION = "IN_CONSULTATION"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class AppointmentType(str, enum.Enum):
    IN_PERSON = "IN_PERSON"
    TELECONSULTATION = "TELECONSULTATION"
    WALK_IN = "WALK_IN"
    FOLLOW_UP = "FOLLOW_UP"
    EMERGENCY = "EMERGENCY"


class QueueStatus(str, enum.Enum):
    WAITING = "WAITING"
    CALLED = "CALLED"
    WITH_DOCTOR = "WITH_DOCTOR"
    COMPLETED = "COMPLETED"
    SKIPPED = "SKIPPED"


class Appointment(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Represents an appointment slot between a doctor and patient.
    
    Double-Booking Prevention:
    Enforced via PostgreSQL GIST Exclusion Constraint with btree_gist extension.
    No two non-cancelled appointments for the same doctor can overlap in time.
    """
    __tablename__ = "appointments"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    appointment_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Human readable code e.g. APT-20261122-0042"
    )

    appointment_type: Mapped[AppointmentType] = mapped_column(
        SAEnum(AppointmentType, native_enum=True),
        default=AppointmentType.IN_PERSON,
        nullable=False
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        SAEnum(AppointmentStatus, native_enum=True),
        default=AppointmentStatus.SCHEDULED,
        nullable=False,
        index=True
    )

    # Time Window with Timezone
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    # Clinical & Administrative Details
    reason_for_visit: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    internal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    serial_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="Consecutive token/serial number per doctor per date")

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="appointments")
    doctor: Mapped["DoctorProfile"] = relationship("DoctorProfile", back_populates="appointments")
    queue_token: Mapped[Optional["QueueToken"]] = relationship(
        "QueueToken",
        back_populates="appointment",
        uselist=False,
        cascade="all, delete-orphan"
    )
    encounter: Mapped[Optional["Encounter"]] = relationship(
        "Encounter",
        back_populates="appointment",
        uselist=False
    )
    invoice: Mapped[Optional["Invoice"]] = relationship(
        "Invoice",
        back_populates="appointment",
        uselist=False
    )

    __table_args__ = (
        Index("ix_appointments_clinic_number", "clinic_id", "appointment_number", unique=True),
        Index("ix_appointments_doctor_date", "clinic_id", "doctor_id", "start_time"),
        Index("ix_appointments_patient_date", "clinic_id", "patient_id", "start_time"),
        Index("ix_appointments_status_date", "clinic_id", "status", "start_time"),
        # PostgreSQL Double-Booking Exclusion Constraint:
        # Requires: CREATE EXTENSION IF NOT EXISTS btree_gist;
        ExcludeConstraint(
            (text("doctor_id"), "="),
            (func.tstzrange(text("start_time"), text("end_time")), "&&"),
            where=text("status NOT IN ('CANCELLED', 'NO_SHOW')"),
            using="gist",
            name="prevent_doctor_appointment_overlap"
        ),
    )


class QueueToken(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Live reception waiting room queue tracking.
    Enables physical token callouts, TV screen displays, and real-time wait time estimation.
    """
    __tablename__ = "queue_tokens"

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    queue_date: Mapped[date] = mapped_column(Date, default=func.current_date(), nullable=False, index=True)
    token_number: Mapped[int] = mapped_column(Integer, nullable=False, comment="Sequential token for the day e.g. 1, 2, 3")
    token_code: Mapped[str] = mapped_column(String(20), nullable=False, comment="Display token e.g. A-01, D3-12")

    status: Mapped[QueueStatus] = mapped_column(
        SAEnum(QueueStatus, native_enum=True),
        default=QueueStatus.WAITING,
        nullable=False,
        index=True
    )

    check_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    called_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    consultation_start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    consultation_end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    appointment: Mapped["Appointment"] = relationship("Appointment", back_populates="queue_token")

    __table_args__ = (
        Index("ix_queue_daily_token", "clinic_id", "queue_date", "doctor_id", "token_number", unique=True),
        Index("ix_queue_live_monitor", "clinic_id", "queue_date", "status"),
    )
