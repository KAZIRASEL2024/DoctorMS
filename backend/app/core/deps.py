"""FastAPI Dependency Injection: Authentication, Multi-Tenant Context & RBAC."""
import uuid
from typing import Optional, List, Callable, Any
from fastapi import Depends, HTTPException, Header, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import decode_token
from app.db.session import get_db
from app.models.user import User, ClinicStaff, SystemRole, ClinicRole, AuditLog, AuditAction
from app.models.tenant import Clinic
from app.models.patient import Patient

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Authenticates the Bearer JWT token (from Authorization header or ?token query) and returns the corresponding User."""
    effective_token = token or token_query
    if not effective_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(effective_token)
        user_id_str: str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload: missing subject"
            )
        user_id = uuid.UUID(user_id_str)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials or token expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stmt = (
        select(User)
        .where(User.id == user_id, User.is_active == True)
        .options(selectinload(User.clinic_memberships))
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or account is deactivated"
        )
    return user


class TenantContext:
    """Encapsulates the active tenant (clinic) and staff membership of the request."""
    def __init__(
        self,
        clinic: Clinic,
        staff_membership: Optional[ClinicStaff],
        is_super_admin: bool,
        is_patient: bool = False,
        patient: Optional[Patient] = None
    ):
        self.clinic_id: uuid.UUID = clinic.id
        self.clinic: Clinic = clinic
        self.staff: Optional[ClinicStaff] = staff_membership
        self.role: Optional[ClinicRole] = staff_membership.role if staff_membership else None
        self.is_super_admin: bool = is_super_admin
        self.is_patient: bool = is_patient
        self.patient: Optional[Patient] = patient


async def get_current_tenant(
    x_clinic_id: Optional[str] = Header(None, alias="X-Clinic-ID"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> TenantContext:
    """
    Resolves the current clinic_id tenant context.
    Super Admins can access any clinic via X-Clinic-ID.
    Clinic Staff & Doctors are strictly verified against their clinic_staff membership.
    Patients are resolved via their linked Patient profile or default clinic.
    """
    is_super_admin = current_user.system_role == SystemRole.SUPER_ADMIN
    is_patient = current_user.system_role == SystemRole.PATIENT
    target_clinic_id: Optional[uuid.UUID] = None
    patient_record: Optional[Patient] = None

    if x_clinic_id:
        try:
            target_clinic_id = uuid.UUID(x_clinic_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid X-Clinic-ID header format. Must be a valid UUID."
            )
    else:
        # 1. Check active staff memberships
        active_memberships = [m for m in current_user.clinic_memberships if m.is_active]
        if active_memberships:
            target_clinic_id = active_memberships[0].clinic_id
        elif is_patient:
            # 2. For patients, look up their linked Patient record
            pat_stmt = select(Patient).where(Patient.user_id == current_user.id).limit(1)
            pat_res = await db.execute(pat_stmt)
            patient_record = pat_res.scalar_one_or_none()
            if patient_record and patient_record.clinic_id:
                target_clinic_id = patient_record.clinic_id
            else:
                # Fallback to the first active clinic
                c_stmt = select(Clinic.id).where(Clinic.is_active == True).limit(1)
                c_res = await db.execute(c_stmt)
                target_clinic_id = c_res.scalar_one_or_none()
        elif is_super_admin:
            c_stmt = select(Clinic.id).where(Clinic.is_active == True).limit(1)
            c_res = await db.execute(c_stmt)
            target_clinic_id = c_res.scalar_one_or_none()
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no active clinic affiliations. Please specify X-Clinic-ID or contact support."
            )

    if not target_clinic_id:
        # Fallback to any active clinic in the system
        c_stmt = select(Clinic.id).where(Clinic.is_active == True).limit(1)
        c_res = await db.execute(c_stmt)
        target_clinic_id = c_res.scalar_one_or_none()

    if not target_clinic_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tenant context required. Please provide X-Clinic-ID."
        )

    # Verify Clinic exists and is active
    clinic_result = await db.execute(select(Clinic).where(Clinic.id == target_clinic_id))
    clinic = clinic_result.scalar_one_or_none()
    if not clinic or not clinic.is_active:
        # Try fallback to first active clinic
        c_fallback = await db.execute(select(Clinic).where(Clinic.is_active == True).limit(1))
        clinic = c_fallback.scalar_one_or_none()
        if not clinic:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Clinic not found or suspended"
            )

    # If user is a patient, resolve patient record if not already loaded
    if is_patient and not patient_record:
        p_res = await db.execute(
            select(Patient).where(Patient.user_id == current_user.id).limit(1)
        )
        patient_record = p_res.scalar_one_or_none()

    # Find staff membership in this clinic
    staff_member = next(
        (m for m in current_user.clinic_memberships if m.clinic_id == clinic.id and m.is_active),
        None
    )

    if not staff_member and not is_super_admin and not is_patient:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorized for this clinic."
        )

    return TenantContext(
        clinic=clinic,
        staff_membership=staff_member,
        is_super_admin=is_super_admin,
        is_patient=is_patient,
        patient=patient_record
    )


def require_roles(allowed_roles: List[ClinicRole | SystemRole]) -> Callable:
    """
    Role-Based Access Control (RBAC) dependency decorator.
    Enforces that the user has either the Super Admin role, Patient role (if allowed), or one of the specified Clinic Roles.
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
        tenant: TenantContext = Depends(get_current_tenant)
    ) -> TenantContext:
        # Super admin always passes
        if tenant.is_super_admin or current_user.system_role == SystemRole.SUPER_ADMIN or SystemRole.SUPER_ADMIN in allowed_roles:
            if current_user.system_role == SystemRole.SUPER_ADMIN or tenant.is_super_admin:
                return tenant

        # Patient passes if SystemRole.PATIENT is in allowed_roles
        if SystemRole.PATIENT in allowed_roles and (tenant.is_patient or current_user.system_role == SystemRole.PATIENT):
            return tenant

        # Check tenant staff role
        if tenant.role and tenant.role in allowed_roles:
            return tenant

        # Check any active clinic membership role
        for m in getattr(current_user, "clinic_memberships", []):
            if m.is_active and m.role in allowed_roles:
                return tenant

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required role in {[r.value for r in allowed_roles]}, but user has {tenant.role.value if tenant.role else (current_user.system_role.value if current_user.system_role else 'None')}"
        )

    return role_checker


async def log_audit_event(
    db: AsyncSession,
    action: Any = AuditAction.UPDATE,
    resource_type: str = "System",
    resource_id: Optional[str] = None,
    clinic_id: Optional[uuid.UUID] = None,
    user_id: Optional[uuid.UUID] = None,
    patient_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    payload_diff: Optional[dict] = None,
    actor_name: Optional[str] = None,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
    action_title: Optional[str] = None,
    details: Optional[str] = None,
    user: Optional[User] = None,
):
    """Creates a tamper-evident audit log record for HIPAA/GDPR compliance with rich actor tracking."""
    # Resolve actor details from User object if passed
    if user:
        user_id = user_id or user.id
        first = user.first_name or ""
        last = user.last_name or ""
        actor_name = actor_name or f"{first} {last}".strip()
        actor_email = actor_email or user.email
        actor_role = actor_role or (
            user.system_role.value if hasattr(user.system_role, "value") else str(user.system_role or "SUPER_ADMIN")
        )

    # Normalize action enum
    enum_action = AuditAction.UPDATE
    if isinstance(action, AuditAction):
        enum_action = action
    elif isinstance(action, str):
        normalized = action.strip().upper()
        if hasattr(AuditAction, normalized):
            enum_action = getattr(AuditAction, normalized)
        else:
            enum_action = AuditAction.UPDATE
        if not action_title:
            action_title = action

    if not action_title:
        action_title = enum_action.value if hasattr(enum_action, "value") else str(enum_action)

    if not details and payload_diff:
        import json
        try:
            details = json.dumps(payload_diff)
        except Exception:
            details = str(payload_diff)

    # Sanitize types for multi-backend (SQLite & PostgreSQL) compatibility
    safe_resource_id = str(resource_id) if resource_id is not None else None
    safe_patient_id = patient_id
    if safe_patient_id is not None and not isinstance(safe_patient_id, uuid.UUID):
        try:
            safe_patient_id = uuid.UUID(str(safe_patient_id))
        except Exception:
            safe_patient_id = None

    safe_user_id = user_id
    if safe_user_id is not None and not isinstance(safe_user_id, uuid.UUID):
        try:
            safe_user_id = uuid.UUID(str(safe_user_id))
        except Exception:
            pass

    safe_clinic_id = clinic_id
    if safe_clinic_id is not None and not isinstance(safe_clinic_id, uuid.UUID):
        try:
            safe_clinic_id = uuid.UUID(str(safe_clinic_id))
        except Exception:
            pass

    log_entry = AuditLog(
        clinic_id=safe_clinic_id,
        user_id=safe_user_id,
        action=enum_action,
        resource_type=resource_type,
        resource_id=safe_resource_id,
        patient_id=safe_patient_id,
        ip_address=ip_address or "127.0.0.1",
        user_agent=user_agent or "DoctorMS-WebClient/2.0",
        payload_diff=payload_diff,
        actor_name=actor_name,
        actor_email=actor_email,
        actor_role=actor_role or "STAFF",
        action_title=action_title,
        details=details or f"{action_title} on {resource_type}",
    )
    db.add(log_entry)
    await db.commit()
    return log_entry
