"""Hospital Units (Bed / Cabin / ICU / CCU) API Router."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.core.deps import get_current_tenant, get_current_user, TenantContext
from app.models.unit import HospitalUnit
from app.models.patient import Patient
from app.models.user import User, SystemRole, ClinicRole
from app.schemas.unit import (
    UnitCreate, UnitUpdate, UnitResponse, UnitAssignRequest
)

router = APIRouter(prefix="/units", tags=["Hospital Units & Wards"])


def map_unit_response(u: HospitalUnit) -> UnitResponse:
    p_name = None
    p_mrn = None
    p_phone = None
    if u.patient:
        p_name = f"{u.patient.first_name} {u.patient.last_name}".strip()
        p_mrn = u.patient.mrn
        p_phone = u.patient.phone

    d_name = None
    if u.doctor:
        dfull = f"{u.doctor.first_name} {u.doctor.last_name}".strip()
        d_name = dfull if dfull.lower().startswith(("dr.", "dr ", "prof.")) else f"Dr. {dfull}"

    return UnitResponse(
        id=u.id,
        clinic_id=u.clinic_id,
        unit_code=u.unit_code,
        unit_name=u.unit_name,
        category=u.category,
        floor=u.floor,
        daily_price=float(u.daily_price or 0.0),
        status=u.status,
        confirmation_status=getattr(u, "confirmation_status", "Confirmed") or "Confirmed",
        current_patient_id=u.current_patient_id,
        current_doctor_id=u.current_doctor_id,
        patient_name=p_name,
        patient_mrn=p_mrn,
        patient_phone=p_phone,
        doctor_name=d_name,
        assigned_at=u.assigned_at,
        notes=u.notes,
        created_at=u.created_at,
        updated_at=u.updated_at,
    )


@router.get("", response_model=List[UnitResponse])
async def list_hospital_units(
    category: Optional[str] = Query(None, description="Filter by category (General Bed, Cabin, ICU, CCU)"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (FREE or BOOKED)"),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Lists all hospital units in the clinic.
    Available to all authenticated clinic roles (Super Admin, Doctors, Staff, Patients).
    """
    stmt = (
        select(HospitalUnit)
        .where(
            HospitalUnit.clinic_id == tenant.clinic_id,
            HospitalUnit.is_deleted == False
        )
        .options(
            selectinload(HospitalUnit.patient),
            selectinload(HospitalUnit.doctor)
        )
        .order_by(HospitalUnit.category.asc(), HospitalUnit.unit_code.asc())
    )

    if category and category.upper() != "ALL":
        stmt = stmt.where(HospitalUnit.category.ilike(f"%{category}%"))

    if status_filter and status_filter.upper() != "ALL":
        stmt = stmt.where(HospitalUnit.status == status_filter.upper())

    res = await db.execute(stmt)
    units = res.scalars().all()
    return [map_unit_response(u) for u in units]


@router.get("/my-unit", response_model=Optional[UnitResponse])
async def get_my_assigned_unit(
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the currently assigned unit for the logged-in patient.
    """
    # Find patient record
    p_stmt = select(Patient).where(
        Patient.user_id == current_user.id,
        Patient.is_deleted == False
    )
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()

    if not patient:
        return None

    unit_stmt = (
        select(HospitalUnit)
        .where(
            HospitalUnit.clinic_id == tenant.clinic_id,
            HospitalUnit.current_patient_id == patient.id,
            HospitalUnit.status == "BOOKED",
            HospitalUnit.is_deleted == False
        )
        .options(
            selectinload(HospitalUnit.patient),
            selectinload(HospitalUnit.doctor)
        )
    )
    u_res = await db.execute(unit_stmt)
    unit = u_res.scalar_one_or_none()
    if not unit:
        return None

    return map_unit_response(unit)


@router.post("", response_model=UnitResponse, status_code=status.HTTP_201_CREATED)
async def create_hospital_unit(
    payload: UnitCreate,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Creates a new Hospital Unit/Room and sets its daily pricing in BDT.
    STRICT ROLE SEPARATION: Only SUPER_ADMIN is permitted. Returns 403 Forbidden for Doctors.
    """
    if current_user.system_role != SystemRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only Super Admin can create hospital units and wards."
        )

    # Check for duplicate unit_code in clinic
    dup_stmt = select(HospitalUnit).where(
        HospitalUnit.clinic_id == tenant.clinic_id,
        HospitalUnit.unit_code == payload.unit_code.strip(),
        HospitalUnit.is_deleted == False
    )
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unit code '{payload.unit_code.strip()}' already exists in this clinic."
        )

    new_unit = HospitalUnit(
        clinic_id=tenant.clinic_id,
        unit_code=payload.unit_code.strip().upper(),
        unit_name=payload.unit_name.strip(),
        category=payload.category.strip(),
        floor=payload.floor.strip() if payload.floor else "1st Floor",
        daily_price=float(payload.daily_price or 0.0),
        status="FREE"
    )
    db.add(new_unit)
    await db.commit()
    await db.refresh(new_unit)

    return map_unit_response(new_unit)


@router.put("/{unit_id}", response_model=UnitResponse)
async def update_hospital_unit(
    unit_id: uuid.UUID,
    payload: UnitUpdate,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Modifies unit details or daily pricing in BDT.
    STRICT ROLE SEPARATION: Only SUPER_ADMIN is permitted. Returns 403 Forbidden for Doctors.
    """
    if current_user.system_role != SystemRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only Super Admin can modify hospital units and daily prices."
        )

    stmt = select(HospitalUnit).where(
        HospitalUnit.id == unit_id,
        HospitalUnit.clinic_id == tenant.clinic_id,
        HospitalUnit.is_deleted == False
    ).options(
        selectinload(HospitalUnit.patient),
        selectinload(HospitalUnit.doctor)
    )
    res = await db.execute(stmt)
    unit = res.scalar_one_or_none()

    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital unit not found.")

    if payload.unit_code is not None:
        unit.unit_code = payload.unit_code.strip().upper()
    if payload.unit_name is not None:
        unit.unit_name = payload.unit_name.strip()
    if payload.category is not None:
        unit.category = payload.category.strip()
    if payload.floor is not None:
        unit.floor = payload.floor.strip()
    if payload.daily_price is not None:
        unit.daily_price = float(payload.daily_price)

    await db.commit()
    await db.refresh(unit)
    return map_unit_response(unit)


@router.delete("/{unit_id}", status_code=status.HTTP_200_OK)
async def delete_hospital_unit(
    unit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Deletes a hospital unit.
    STRICT ROLE SEPARATION: Only SUPER_ADMIN is permitted. Returns 403 Forbidden for Doctors.
    """
    if current_user.system_role != SystemRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only Super Admin can delete hospital units."
        )

    stmt = select(HospitalUnit).where(
        HospitalUnit.id == unit_id,
        HospitalUnit.clinic_id == tenant.clinic_id,
        HospitalUnit.is_deleted == False
    )
    res = await db.execute(stmt)
    unit = res.scalar_one_or_none()

    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital unit not found.")

    unit.is_deleted = True
    unit.deleted_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Hospital unit deleted successfully", "id": str(unit_id)}


@router.post("/{unit_id}/assign", response_model=UnitResponse)
async def assign_unit_to_patient(
    unit_id: uuid.UUID,
    payload: UnitAssignRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Assigns an available (Free) unit to a patient.
    Permitted for SUPER_ADMIN, CLINIC_ADMIN, and DOCTOR.
    Changes unit status immediately to 'BOOKED'.
    """
    # Check permissions: doctor, clinic admin, or super admin
    is_admin = current_user.system_role == SystemRole.SUPER_ADMIN
    is_doctor = tenant.role == ClinicRole.DOCTOR or any(m.role == ClinicRole.DOCTOR for m in current_user.clinic_memberships)
    is_staff = tenant.role in [ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST]

    if not (is_admin or is_doctor or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only doctors and authorized clinical staff can assign units."
        )

    stmt = select(HospitalUnit).where(
        HospitalUnit.id == unit_id,
        HospitalUnit.clinic_id == tenant.clinic_id,
        HospitalUnit.is_deleted == False
    ).options(
        selectinload(HospitalUnit.patient),
        selectinload(HospitalUnit.doctor)
    )
    res = await db.execute(stmt)
    unit = res.scalar_one_or_none()

    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital unit not found.")

    # Verify patient exists
    p_stmt = select(Patient).where(
        Patient.id == payload.patient_id,
        Patient.clinic_id == tenant.clinic_id,
        Patient.is_deleted == False
    )
    p_res = await db.execute(p_stmt)
    patient = p_res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found in this clinic.")

    # Assign unit
    unit.current_patient_id = patient.id
    unit.current_doctor_id = payload.doctor_id or current_user.id
    unit.assigned_at = datetime.now(timezone.utc)
    unit.notes = payload.notes
    unit.status = "BOOKED"
    unit.confirmation_status = "Pending Reception"

    await db.commit()
    await db.refresh(unit)
    return map_unit_response(unit)


@router.post("/{unit_id}/discharge", response_model=UnitResponse)
async def discharge_unit_patient(
    unit_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Discharges patient from unit and marks unit as 'FREE'.
    Permitted for SUPER_ADMIN, CLINIC_ADMIN, and DOCTOR.
    """
    is_admin = current_user.system_role == SystemRole.SUPER_ADMIN
    is_doctor = tenant.role == ClinicRole.DOCTOR or any(m.role == ClinicRole.DOCTOR for m in current_user.clinic_memberships)
    is_staff = tenant.role in [ClinicRole.CLINIC_ADMIN, ClinicRole.RECEPTIONIST]

    if not (is_admin or is_doctor or is_staff):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied: Only doctors and authorized clinical staff can discharge units."
        )

    stmt = select(HospitalUnit).where(
        HospitalUnit.id == unit_id,
        HospitalUnit.clinic_id == tenant.clinic_id,
        HospitalUnit.is_deleted == False
    ).options(
        selectinload(HospitalUnit.patient),
        selectinload(HospitalUnit.doctor)
    )
    res = await db.execute(stmt)
    unit = res.scalar_one_or_none()

    if not unit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hospital unit not found.")

    unit.current_patient_id = None
    unit.current_doctor_id = None
    unit.assigned_at = None
    unit.notes = None
    unit.status = "FREE"

    await db.commit()
    await db.refresh(unit)
    return map_unit_response(unit)
