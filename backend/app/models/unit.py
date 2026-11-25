"""Hospital Units (Bed / Cabin / ICU / CCU) Database Model."""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Numeric, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, TenantMixin, SoftDeleteMixin


class HospitalUnit(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "hospital_units"

    unit_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    unit_name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # General Bed, Cabin, ICU, CCU
    floor: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 1st Floor, 2nd Floor, etc.
    daily_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="FREE", nullable=False, index=True)  # FREE or BOOKED
    confirmation_status: Mapped[Optional[str]] = mapped_column(String(50), default="Confirmed", nullable=True)  # Pending Reception or Confirmed
    
    current_patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    current_doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    assigned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    patient = relationship("Patient", lazy="joined", foreign_keys=[current_patient_id])
    doctor = relationship("User", lazy="joined", foreign_keys=[current_doctor_id])
