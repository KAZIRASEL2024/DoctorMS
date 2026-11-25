"""Tenant & Subscription domain models."""
import enum
import uuid
from typing import Optional, List
from datetime import datetime
from sqlalchemy import String, Boolean, Enum as SAEnum, Integer, Numeric, DateTime, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SubscriptionPlan(str, enum.Enum):
    STARTER = "STARTER"
    PROFESSIONAL = "PROFESSIONAL"
    ENTERPRISE = "ENTERPRISE"
    CUSTOM = "CUSTOM"


class SubscriptionStatus(str, enum.Enum):
    TRIALING = "TRIALING"
    ACTIVE = "ACTIVE"
    PAST_DUE = "PAST_DUE"
    CANCELED = "CANCELED"
    UNPAID = "UNPAID"


class Clinic(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Tenant root entity. Represents an independent clinic or polyclinic.
    All tenant data is partitioned by clinic_id.
    """
    __tablename__ = "clinics"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    tax_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    # Physical Location
    address_line1: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="BD", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Dhaka", nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="BDT", nullable=False)

    # Branding & Customization for E-Prescriptions and Invoices
    logo_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    letterhead_template: Mapped[dict] = mapped_column(
        JSONB,
        default=lambda: {
            "header_height": 120,
            "footer_height": 80,
            "show_logo": True,
            "show_clinic_address": True,
            "primary_color": "#0ea5e9",
            "tagline": "Excellence in Healthcare"
        },
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    subscription: Mapped[Optional["ClinicSubscription"]] = relationship(
        "ClinicSubscription",
        back_populates="clinic",
        uselist=False,
        cascade="all, delete-orphan"
    )
    staff_members: Mapped[List["ClinicStaff"]] = relationship(
        "ClinicStaff",
        back_populates="clinic",
        cascade="all, delete-orphan"
    )
    patients: Mapped[List["Patient"]] = relationship(
        "Patient",
        back_populates="clinic",
        cascade="all, delete-orphan"
    )


class ClinicSubscription(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Tracks SaaS billing tier, limits, and subscription lifecycle per clinic."""
    __tablename__ = "clinic_subscriptions"

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinics.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True
    )
    plan: Mapped[SubscriptionPlan] = mapped_column(
        SAEnum(SubscriptionPlan, native_enum=True),
        default=SubscriptionPlan.STARTER,
        nullable=False
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        SAEnum(SubscriptionStatus, native_enum=True),
        default=SubscriptionStatus.TRIALING,
        nullable=False
    )
    
    # Billing Period
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    trial_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # SaaS Tier Limits (Enforced at application layer)
    max_doctors: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    max_staff: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    max_monthly_appointments: Mapped[int] = mapped_column(Integer, default=500, nullable=False)

    # External Payment Gateway References
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="subscription")
