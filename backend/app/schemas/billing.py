"""Billing, Invoicing, and Payment Pydantic v2 schemas."""
import uuid
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field
from app.models.billing import InvoiceStatus, PaymentMode, InvoiceItemType


class InvoiceItemCreate(BaseModel):
    item_type: InvoiceItemType = InvoiceItemType.CONSULTATION
    description: str
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(default=0.00, ge=0.0)


class InvoiceItemResponse(InvoiceItemCreate):
    id: uuid.UUID
    invoice_id: uuid.UUID
    total_price: float

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    payment_mode: PaymentMode = PaymentMode.CASH
    amount: float = Field(gt=0.0)
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    patient_id: uuid.UUID
    transaction_reference: str
    payment_mode: PaymentMode
    amount: float
    payment_date: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class InvoiceCreate(BaseModel):
    patient_id: uuid.UUID
    appointment_id: Optional[uuid.UUID] = None
    items: List[InvoiceItemCreate]
    discount_amount: float = Field(default=0.00, ge=0.0)
    tax_rate_percent: float = Field(default=0.00, ge=0.0)
    due_date: Optional[date] = None
    notes: Optional[str] = None


class ConfirmUnitBillRequest(BaseModel):
    unit_id: uuid.UUID
    patient_id: Optional[uuid.UUID] = None
    days: int = Field(default=1, ge=1)
    daily_rate: Optional[float] = None
    daily_rate_bdt: Optional[float] = None
    notes: Optional[str] = None


class ConfirmPaymentRequest(BaseModel):
    payment_method: str = Field(default="Cash")  # Cash, bKash/Nagad, Card
    amount_paid: Optional[float] = None
    amount_bdt: Optional[float] = None
    notes: Optional[str] = None


class LineItemBreakdown(BaseModel):
    service: str
    location: str
    reason: str
    unit_price: float
    qty: int
    total: float


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    appointment_id: Optional[uuid.UUID] = None
    doctor_id: Optional[uuid.UUID] = None
    unit_id: Optional[uuid.UUID] = None
    invoice_number: str
    status: InvoiceStatus
    bill_type: Optional[str] = "Doctor Visit"
    description: Optional[str] = None
    amount_bdt: float = 0.00
    paid_amount_bdt: float = 0.00
    due_amount_bdt: float = 0.00
    payment_status: str = "Due"
    payment_method: Optional[str] = None
    confirmed_by_receptionist_id: Optional[uuid.UUID] = None
    confirmed_by_name: Optional[str] = None
    paid_at: Optional[datetime] = None
    issue_date: date
    due_date: date
    subtotal: float
    discount_amount: float
    tax_rate_percent: float
    tax_amount: float
    total_amount: float
    paid_amount: float
    balance_amount: float
    notes: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    payments: List[PaymentResponse] = []
    created_at: datetime
    patient_name: Optional[str] = None
    patient_mrn: Optional[str] = None
    patient_phone: Optional[str] = None
    patient_address: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    chamber_location: Optional[str] = None
    unit_code: Optional[str] = None
    nurse_booking_id: Optional[uuid.UUID] = None
    has_reviewed: bool = False
    submitted_rating: Optional[int] = None
    line_items: List[LineItemBreakdown] = []

    class Config:
        from_attributes = True
