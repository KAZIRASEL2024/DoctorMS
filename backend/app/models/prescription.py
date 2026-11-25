"""Digital Prescription (E-Rx) and Formulary models."""
import enum
import uuid
from typing import Optional, List
from datetime import date, datetime
from sqlalchemy import (
    String, Boolean, Integer, Numeric, DateTime, Date, Enum as SAEnum, ForeignKey, Index, Text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin


class DosageForm(str, enum.Enum):
    TABLET = "TABLET"
    CAPSULE = "CAPSULE"
    SYRUP = "SYRUP"
    INJECTION = "INJECTION"
    OINTMENT = "OINTMENT"
    DROPS = "DROPS"
    INHALER = "INHALER"
    SUPPOSITORY = "SUPPOSITORY"
    OTHER = "OTHER"


class MealTiming(str, enum.Enum):
    BEFORE_MEAL = "BEFORE_MEAL"
    AFTER_MEAL = "AFTER_MEAL"
    WITH_MEAL = "WITH_MEAL"
    EMPTY_STOMACH = "EMPTY_STOMACH"
    BEDTIME = "BEDTIME"
    AS_NEEDED = "AS_NEEDED"


class MedicineMaster(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Standard drug formulary.
    If clinic_id is NULL: Global platform catalog.
    If clinic_id is set: Clinic-specific custom branded inventory item.
    """
    __tablename__ = "medicines_master"

    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        nullable=True,
        index=True
    )
    brand_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    generic_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    dosage_form: Mapped[DosageForm] = mapped_column(
        SAEnum(DosageForm, native_enum=True),
        default=DosageForm.TABLET,
        nullable=False
    )
    strength: Mapped[str] = mapped_column(String(50), nullable=False, comment="e.g. 500mg, 10ml, 250mcg")
    manufacturer: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("ix_medicines_search", "clinic_id", "brand_name", "generic_name"),
    )


class Prescription(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Digital prescription with tamper-proof cryptographic verification hash and QR code token.
    """
    __tablename__ = "prescriptions"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("encounters.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True
    )

    prescription_code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Human readable code e.g. RX-20261122-0089"
    )

    # General Instructions & Advice
    general_advice: Mapped[Optional[str]] = mapped_column(Text, nullable=True, comment="Diet, rest, precautions")
    diet_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    # Anti-Tampering & Public QR Verification
    verification_hash: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        nullable=False,
        index=True,
        comment="SHA-256 token used in QR code for instant pharmacy authenticity verification"
    )
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    signed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    pdf_storage_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Relationships
    encounter: Mapped["Encounter"] = relationship("Encounter", back_populates="prescription")
    patient: Mapped["Patient"] = relationship("Patient", back_populates="prescriptions")
    doctor: Mapped["DoctorProfile"] = relationship("DoctorProfile")
    items: Mapped[List["PrescriptionItem"]] = relationship(
        "PrescriptionItem",
        back_populates="prescription",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_prescriptions_clinic_code", "clinic_id", "prescription_code", unique=True),
        Index("ix_prescriptions_patient_timeline", "clinic_id", "patient_id", "created_at"),
    )


class PrescriptionItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Itemized drug dosage and frequency row in a prescription.
    """
    __tablename__ = "prescription_items"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    medicine_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("medicines_master.id", ondelete="SET NULL"),
        nullable=True
    )

    # Fallback to direct text if custom drug not in master catalog
    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    generic_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    dosage: Mapped[str] = mapped_column(String(50), nullable=False, comment="e.g. 500mg or 1 puff")
    frequency: Mapped[str] = mapped_column(String(50), nullable=False, comment="e.g. 1-0-1 or TID")
    duration: Mapped[str] = mapped_column(String(50), nullable=False, comment="e.g. 7 Days, 1 Month")
    meal_timing: Mapped[MealTiming] = mapped_column(
        SAEnum(MealTiming, native_enum=True),
        default=MealTiming.AFTER_MEAL,
        nullable=False
    )
    instructions: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, comment="e.g. Take with warm water")

    # Relationships
    prescription: Mapped["Prescription"] = relationship("Prescription", back_populates="items")
    medicine: Mapped[Optional["MedicineMaster"]] = relationship("MedicineMaster")
