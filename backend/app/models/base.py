"""Base model definitions and mixins for Multi-Tenancy, UUID primary keys, and Timestamps."""
from datetime import datetime
import uuid
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, ExcludeConstraint
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column, relationship

# SQLite compatibility shims for testing environments
@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy declarative models."""
    pass


class TimestampMixin:
    """Provides created_at and updated_at audit timestamps."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )


class UUIDPrimaryKeyMixin:
    """Provides a UUID primary key default."""
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
        nullable=False
    )


class TenantMixin:
    """
    Enforces multi-tenancy by requiring clinic_id on every tenant-scoped entity.
    Includes foreign key reference and indexing for query isolation.
    """
    @declared_attr
    def clinic_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(
            UUID(as_uuid=True),
            ForeignKey("clinics.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        )


class SoftDeleteMixin:
    """Provides soft-delete capability for medical records compliance."""
    is_deleted: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
