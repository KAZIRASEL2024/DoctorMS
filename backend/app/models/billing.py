"""Billing, Invoicing, and Payment models."""
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


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PARTIALLY_PAID = "PARTIALLY_PAID"
    PAID = "PAID"
    VOID = "VOID"
    REFUNDED = "REFUNDED"


class PaymentMode(str, enum.Enum):
    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    DEBIT_CARD = "DEBIT_CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    MOBILE_BANKING = "MOBILE_BANKING"
    INSURANCE = "INSURANCE"
    OTHER = "OTHER"


class InvoiceItemType(str, enum.Enum):
    CONSULTATION = "CONSULTATION"
    PROCEDURE = "PROCEDURE"
    MEDICATION = "MEDICATION"
    LAB_TEST = "LAB_TEST"
    ROOM_CHARGE = "ROOM_CHARGE"
    OTHER = "OTHER"


class Invoice(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Clinic billing invoice supporting multi-item breakdowns, tax, discount, and partial payments.
    """
    __tablename__ = "invoices"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )

    invoice_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Sequential code e.g. INV-202611-0004"
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        SAEnum(InvoiceStatus, native_enum=True),
        default=InvoiceStatus.ISSUED,
        nullable=False,
        index=True
    )

    issue_date: Mapped[date] = mapped_column(Date, default=func.current_date(), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, default=func.current_date(), nullable=False)

    # Financial Breakdown
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_rate_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    balance_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Extended Hospital Billing fields
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    unit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("hospital_units.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    nurse_booking_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("nurse_bookings.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    bill_type: Mapped[Optional[str]] = mapped_column(String(50), default="Doctor Visit", nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    amount_bdt: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=True)
    paid_amount_bdt: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=True)
    due_amount_bdt: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=True)
    payment_status: Mapped[Optional[str]] = mapped_column(String(20), default="Due", nullable=True, index=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    confirmed_by_receptionist_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True
    )
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="invoices")
    appointment: Mapped[Optional["Appointment"]] = relationship("Appointment", back_populates="invoice")
    doctor = relationship("User", foreign_keys=[doctor_id])
    unit = relationship("HospitalUnit", foreign_keys=[unit_id])
    confirmed_by = relationship("User", foreign_keys=[confirmed_by_receptionist_id])
    items: Mapped[List["InvoiceItem"]] = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan"
    )
    payments: Mapped[List["PaymentTransaction"]] = relationship(
        "PaymentTransaction",
        back_populates="invoice",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_invoices_clinic_number", "clinic_id", "invoice_number", unique=True),
        Index("ix_invoices_patient_status", "clinic_id", "patient_id", "status"),
        Index("ix_invoices_date_status", "clinic_id", "issue_date", "status"),
    )


class InvoiceItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Itemized billing line item."""
    __tablename__ = "invoice_items"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    item_type: Mapped[InvoiceItemType] = mapped_column(
        SAEnum(InvoiceItemType, native_enum=True),
        default=InvoiceItemType.CONSULTATION,
        nullable=False
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class PaymentTransaction(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """
    Payment receipts supporting split-payments and various settlement channels.
    """
    __tablename__ = "payment_transactions"

    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    received_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        comment="Staff member who accepted the payment"
    )

    transaction_reference: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="Internal receipt code or gateway transaction ID"
    )
    payment_mode: Mapped[PaymentMode] = mapped_column(
        SAEnum(PaymentMode, native_enum=True),
        default=PaymentMode.CASH,
        nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")
    received_by: Mapped["User"] = relationship("User")

    __table_args__ = (
        Index("ix_payments_clinic_date", "clinic_id", "payment_date"),
    )
