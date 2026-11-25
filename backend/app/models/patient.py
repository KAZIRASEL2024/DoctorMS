"""Patient domain models."""
import enum
import uuid
from typing import Optional, List
from datetime import date, datetime
from sqlalchemy import String, Date, Enum as SAEnum, ForeignKey, Index, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin, SoftDeleteMixin


class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class BloodGroup(str, enum.Enum):
    A_POSITIVE = "A+"
    A_NEGATIVE = "A-"
    B_POSITIVE = "B+"
    B_NEGATIVE = "B-"
    AB_POSITIVE = "AB+"
    AB_NEGATIVE = "AB-"
    O_POSITIVE = "O+"
    O_NEGATIVE = "O-"
    UNKNOWN = "UNKNOWN"


class Patient(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """
    Patient demographics and baseline medical profile.
    Medical Record Number (MRN) is strictly unique per clinic.
    """
    __tablename__ = "patients"

    # Optional linkage to self-service patient portal account
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    # Clinic-scoped Medical Record Number (e.g. MRN-2026-0001)
    mrn: Mapped[str] = mapped_column(String(50), nullable=False)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    gender: Mapped[Gender] = mapped_column(
        SAEnum(Gender, native_enum=True),
        nullable=False
    )
    blood_group: Mapped[BloodGroup] = mapped_column(
        SAEnum(BloodGroup, native_enum=True),
        default=BloodGroup.UNKNOWN,
        nullable=False
    )
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    # Address
    address_line: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Emergency Contact
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    emergency_contact_relation: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Baseline Medical Summary
    allergies: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="List of known allergies e.g. ['Penicillin', 'Peanuts']"
    )
    chronic_conditions: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
        comment="List of diagnosed chronic conditions e.g. ['Hypertension', 'Type 2 Diabetes']"
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="patients")
    user: Mapped[Optional["User"]] = relationship("User", back_populates="patient_profile")
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="patient",
        cascade="all, delete-orphan"
    )
    encounters: Mapped[List["Encounter"]] = relationship(
        "Encounter",
        back_populates="patient",
        cascade="all, delete-orphan"
    )
    prescriptions: Mapped[List["Prescription"]] = relationship(
        "Prescription",
        back_populates="patient",
        cascade="all, delete-orphan"
    )
    invoices: Mapped[List["Invoice"]] = relationship(
        "Invoice",
        back_populates="patient",
        cascade="all, delete-orphan"
    )
    lab_reports: Mapped[List["LabReport"]] = relationship(
        "LabReport",
        back_populates="patient",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_patients_clinic_mrn", "clinic_id", "mrn", unique=True),
        Index("ix_patients_clinic_phone", "clinic_id", "phone"),
        Index("ix_patients_clinic_name", "clinic_id", "last_name", "first_name"),
    )
