"""Admin User Credentials Management Endpoints."""
import re
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user, get_current_tenant, TenantContext, log_audit_event
from app.core.security import get_password_hash
from app.models.user import User, SystemRole, AuditAction
from app.models.patient import Patient

router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])
admin_patients_credentials_router = APIRouter(prefix="/admin/patients", tags=["Admin Patient Credentials"])


class UpdateCredentialsRequest(BaseModel):
    email: Optional[str] = None
    new_password: Optional[str] = None


@router.patch("/{user_id}/credentials")
@admin_patients_credentials_router.patch("/{user_id}/credentials")
async def update_user_credentials(
    user_id: str,
    payload: UpdateCredentialsRequest,
    current_user: User = Depends(get_current_user),
    tenant: TenantContext = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """
    Allows SUPER_ADMIN to view and update the Login Email and Reset/Set a New Password
    for any system user (Doctors, Staff, and Patients).
    Protected so ONLY role == "SUPER_ADMIN" can call it.
    """
    if current_user.system_role != SystemRole.SUPER_ADMIN and not getattr(tenant, "is_super_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Only Super Admin can update user credentials."
        )

    # Clean input
    email_clean = payload.email.strip().lower() if payload.email else None
    new_password = payload.new_password.strip() if payload.new_password else None

    if not email_clean and not new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No credential updates provided. Please provide an email or new password."
        )

    # Validate email format if provided
    if email_clean:
        email_regex = r"^[\w\.\+-]+@[\w\.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_regex, email_clean):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid email address format: '{email_clean}'"
            )

    # Validate password length if provided
    if new_password:
        if len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long."
            )

    # Parse target UUID
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid user ID format: '{user_id}'"
        )

    # 1. Lookup user in users table
    stmt = select(User).where(User.id == target_uuid)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    linked_patient = None

    # 2. If not found in users, check if target_uuid is a Patient id
    if not user:
        p_stmt = select(Patient).where(Patient.id == target_uuid)
        p_res = await db.execute(p_stmt)
        linked_patient = p_res.scalar_one_or_none()

        if linked_patient:
            if linked_patient.user_id:
                u_stmt = select(User).where(User.id == linked_patient.user_id)
                u_res = await db.execute(u_stmt)
                user = u_res.scalar_one_or_none()
            else:
                # Provision new user account for this patient
                target_email = email_clean or linked_patient.email
                if not target_email:
                    target_email = f"patient_{linked_patient.mrn.lower().replace('-', '_')}@clinic.local"

                # Check duplicate email
                dup_stmt = select(User).where(User.email == target_email)
                dup_res = await db.execute(dup_stmt)
                if dup_res.scalar_one_or_none():
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"The email '{target_email}' is already registered to another user account."
                    )

                initial_pw = new_password or "Patient123!"
                user = User(
                    id=uuid.uuid4(),
                    email=target_email,
                    phone=linked_patient.phone,
                    hashed_password=get_password_hash(initial_pw),
                    first_name=linked_patient.first_name,
                    last_name=linked_patient.last_name,
                    system_role=SystemRole.PATIENT,
                    is_active=True,
                    is_email_verified=True
                )
                db.add(user)
                await db.flush()
                linked_patient.user_id = user.id
                linked_patient.email = target_email
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID '{user_id}' not found."
            )

    # 3. Find if this user is linked to any patient (to keep patient.email in sync)
    if not linked_patient:
        p_stmt = select(Patient).where(Patient.user_id == user.id)
        p_res = await db.execute(p_stmt)
        linked_patient = p_res.scalar_one_or_none()

    old_email = user.email
    email_changed = False
    password_changed = False

    # 4. Update email if changed
    if email_clean and email_clean != old_email:
        # Check duplicate
        dup_stmt = select(User).where(User.email == email_clean, User.id != user.id)
        dup_res = await db.execute(dup_stmt)
        if dup_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The email '{email_clean}' is already registered to another user account."
            )
        user.email = email_clean
        if linked_patient:
            linked_patient.email = email_clean
        email_changed = True

    # 5. Update password if provided
    if new_password:
        user.hashed_password = get_password_hash(new_password)
        password_changed = True

    # 6. Audit Trail Logging (Without logging raw password)
    await log_audit_event(
        db=db,
        action=AuditAction.UPDATE,
        resource_type="User Credentials",
        resource_id=str(user.id),
        clinic_id=tenant.clinic_id if tenant else None,
        user_id=current_user.id,
        patient_id=linked_patient.id if linked_patient else None,
        payload_diff={
            "email_updated": email_changed,
            "password_reset": password_changed,
            "target_user_id": str(user.id),
            "target_email": user.email,
            "target_name": f"{user.first_name} {user.last_name}".strip(),
            "target_system_role": user.system_role.value if user.system_role else None
        }
    )

    await db.commit()
    await db.refresh(user)

    return {
        "success": True,
        "message": "User credentials updated successfully.",
        "user_id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email_updated": email_changed,
        "password_updated": password_changed
    }
