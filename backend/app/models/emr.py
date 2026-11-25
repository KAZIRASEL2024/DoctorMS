"""Electronic Medical Records (EMR): Encounters, Vitals, SOAP notes, and Diagnoses."""
import enum
import uuid
from typing import Optional, List
from datetime import datetime, date
from sqlalchemy import (
    String, Boolean, Integer, Numeric, DateTime, Date, Enum as SAEnum, ForeignKey, Index, Text, func
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin


class DiagnosisType(str, enum.Enum):
    PROVISIONAL = "PROVISIONAL"
    FINAL = "FINAL"
    SECONDARY = "SECONDARY"


class DiagnosisStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
    CHRONIC = "CHRONIC"


class Encounter(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Clinical encounter represents a single patient consultation session.
    All clinical notes, vitals, diagnoses, and prescriptions anchor to an encounter.
    """
    __tablename__ = "encounters"

    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
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
        ForeignKey("doctor_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    encounter_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    chief_complaint: Mapped[str] = mapped_column(Text, nullable=False, comment="Primary reason patient sought care")
    clinical_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_finalized: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="When True, notes are locked for legal/audit compliance"
    )

    # Relationships
    appointment: Mapped[Optional["Appointment"]] = relationship("Appointment", back_populates="encounter")
    patient: Mapped["Patient"] = relationship("Patient", back_populates="encounters")
    doctor: Mapped["DoctorProfile"] = relationship("DoctorProfile")
    vitals: Mapped[Optional["VitalSign"]] = relationship(
        "VitalSign",
        back_populates="encounter",
        uselist=False,
        cascade="all, delete-orphan"
    )
    soap_note: Mapped[Optional["SoapNote"]] = relationship(
        "SoapNote",
        back_populates="encounter",
        uselist=False,
        cascade="all, delete-orphan"
    )
    diagnoses: Mapped[List["ClinicalDiagnosis"]] = relationship(
        "ClinicalDiagnosis",
        back_populates="encounter",
        cascade="all, delete-orphan"
    )
    prescription: Mapped[Optional["Prescription"]] = relationship(
        "Prescription",
        back_populates="encounter",
        uselist=False,
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_encounters_patient_history", "clinic_id", "patient_id", "encounter_date"),
        Index("ix_encounters_doctor_timeline", "clinic_id", "doctor_id", "encounter_date"),
    )


class VitalSign(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Physiological vital signs recorded during triage or consultation.
    BMI is calculated and indexed for health risk monitoring.
    """
    __tablename__ = "vital_signs"

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
    recorded_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False
    )

    # Hemodynamics & Vitals
    systolic_bp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="mmHg")
    diastolic_bp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="mmHg")
    pulse_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="beats per min")
    temperature_celsius: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True, comment="°C")
    respiratory_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, comment="breaths per min")
    spo2_percent: Mapped[Optional[float]] = mapped_column(Numeric(4, 1), nullable=True, comment="Oxygen Saturation %")

    # Anthropometry
    height_cm: Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True, comment="cm")
    weight_kg: Mapped[Optional[float]] = mapped_column(Numeric(5, 2), nullable=True, comment="kg")
    bmi: Mapped[Optional[float]] = mapped_column(
        Numeric(4, 1),
        nullable=True,
        comment="Body Mass Index auto-calculated: kg / (m^2)"
    )
    blood_glucose_random: Mapped[Optional[float]] = mapped_column(Numeric(5, 1), nullable=True, comment="mg/dL")

    clinical_notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    encounter: Mapped["Encounter"] = relationship("Encounter", back_populates="vitals")

    __table_args__ = (
        Index("ix_vital_signs_patient_timeline", "clinic_id", "patient_id", "created_at"),
    )


class SoapNote(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Standardized medical documentation format:
    - Subjective (S): Patient history, reported symptoms, complaints
    - Objective (O): Clinician exam findings, laboratory/imaging test results
    - Assessment (A): Differential diagnostic reasoning, progression
    - Plan (P): Therapeutic plan, medication strategy, diagnostics, counseling
    """
    __tablename__ = "soap_notes"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("encounters.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_profiles.id", ondelete="RESTRICT"),
        nullable=False
    )

    subjective: Mapped[str] = mapped_column(Text, nullable=False, default="")
    objective: Mapped[str] = mapped_column(Text, nullable=False, default="")
    assessment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    plan: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Relationships
    encounter: Mapped["Encounter"] = relationship("Encounter", back_populates="soap_note")


class ClinicalDiagnosis(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Diagnostic classification coding (e.g. ICD-10) associated with the clinical encounter.
    """
    __tablename__ = "clinical_diagnoses"

    encounter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("encounters.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    icd10_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    diagnosis_name: Mapped[str] = mapped_column(String(255), nullable=False)
    diagnosis_type: Mapped[DiagnosisType] = mapped_column(
        SAEnum(DiagnosisType, native_enum=True),
        default=DiagnosisType.PROVISIONAL,
        nullable=False
    )
    status: Mapped[DiagnosisStatus] = mapped_column(
        SAEnum(DiagnosisStatus, native_enum=True),
        default=DiagnosisStatus.ACTIVE,
        nullable=False
    )
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    encounter: Mapped["Encounter"] = relationship("Encounter", back_populates="diagnoses")

    __table_args__ = (
        Index("ix_clinical_diagnoses_lookup", "clinic_id", "icd10_code"),
    )


class LabReport(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Diagnostic laboratory investigation report with structured findings and optional PDF upload.
    """
    __tablename__ = "lab_reports"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctor_profiles.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    test_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    test_category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    test_date: Mapped[date] = mapped_column(Date, nullable=False)
    result_summary: Mapped[str] = mapped_column(Text, nullable=False)
    findings_json: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    report_file_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Completed", nullable=False)
    lab_name: Mapped[Optional[str]] = mapped_column(String(200), default="Metro Diagnostic & Clinical Laboratory", nullable=True)
    pathologist_name: Mapped[Optional[str]] = mapped_column(String(200), default="Prof. Dr. M. A. Hasan, FCPS (Pathology)", nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic")
    patient: Mapped["Patient"] = relationship("Patient", back_populates="lab_reports")
    doctor: Mapped[Optional["DoctorProfile"]] = relationship("DoctorProfile")

    __table_args__ = (
        Index("ix_lab_reports_patient_lookup", "clinic_id", "patient_id", "test_date"),
    )
