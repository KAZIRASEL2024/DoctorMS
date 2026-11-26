"""User, RBAC, ClinicStaff, and AuditLog models."""
import enum
import uuid
from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Text, Boolean, Enum as SAEnum, ForeignKey, Index, DateTime, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin


class SystemRole(str, enum.Enum):
    """Platform-level user roles."""
    SUPER_ADMIN = "SUPER_ADMIN"
    STAFF = "STAFF"
    PATIENT = "PATIENT"
    NURSE = "NURSE"
    LAB_ASSISTANT = "LAB_ASSISTANT"


class ClinicRole(str, enum.Enum):
    """Tenant-scoped roles for staff within a specific clinic."""
    CLINIC_ADMIN = "CLINIC_ADMIN"
    DOCTOR = "DOCTOR"
    RECEPTIONIST = "RECEPTIONIST"
    NURSE = "NURSE"
    LAB_ASSISTANT = "LAB_ASSISTANT"


class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    READ = "READ"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    EXPORT = "EXPORT"


class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Global identity table for authentication.
    A user can belong to multiple clinics with different roles (e.g. visiting doctor).
    """
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    system_role: Mapped[SystemRole] = mapped_column(
        SAEnum(SystemRole, native_enum=True),
        default=SystemRole.STAFF,
        nullable=False,
        index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    clinic_memberships: Mapped[List["ClinicStaff"]] = relationship(
        "ClinicStaff",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    patient_profile: Mapped[Optional["Patient"]] = relationship(
        "Patient",
        back_populates="user",
        uselist=False
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")


class ClinicStaff(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Represents an employee/contractor linked to a clinic with a specific clinic role.
    Composite unique constraint ensures a user has one primary staff profile per clinic.
    """
    __tablename__ = "clinic_staff"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    role: Mapped[ClinicRole] = mapped_column(
        SAEnum(ClinicRole, native_enum=True),
        nullable=False,
        index=True
    )
    designation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    custom_permissions: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {},
        nullable=False,
        comment="Granular permission overrides for staff role"
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="staff_members")
    user: Mapped["User"] = relationship("User", back_populates="clinic_memberships")
    doctor_profile: Mapped[Optional["DoctorProfile"]] = relationship(
        "DoctorProfile",
        back_populates="staff",
        uselist=False,
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_clinic_staff_clinic_user", "clinic_id", "user_id", unique=True),
        Index("ix_clinic_staff_clinic_role", "clinic_id", "role"),
    )


class AuditLog(Base, UUIDPrimaryKeyMixin):
    """
    HIPAA/GDPR-compliant tamper-evident audit logging table.
    Tracks all read, write, export, and authentication actions on sensitive PHI data.
    """
    __tablename__ = "audit_logs"

    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    action: Mapped[AuditAction] = mapped_column(
        SAEnum(AuditAction, native_enum=True),
        nullable=False,
        index=True
    )
    resource_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
        comment="Target entity, e.g. Patient, Prescription, MedicalRecord"
    )
    resource_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
        comment="Identifier of target entity"
    )
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        index=True,
        comment="Explicitly tracks PHI access relating to a specific patient"
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    actor_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    actor_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    actor_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    action_title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload_diff: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        comment="Redacted state changes (before/after values)"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_logs_tenant_resource", "clinic_id", "resource_type", "created_at"),
        Index("ix_audit_logs_patient_timeline", "clinic_id", "patient_id", "created_at"),
    )
