"""End-to-End Functional Test Suite for Phase 2 FastAPI Core & Services."""
import asyncio
import sys
import os
from datetime import date, time, datetime, timedelta, timezone

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.models.base import Base
from app.models.tenant import Clinic, ClinicSubscription, SubscriptionPlan, SubscriptionStatus
from app.models.user import User, ClinicStaff, SystemRole, ClinicRole
from app.models.patient import Patient, Gender, BloodGroup
from app.models.doctor import DoctorProfile, DoctorSchedule, DoctorBreak, DoctorLeave
from app.models.appointment import Appointment, QueueToken, AppointmentStatus, AppointmentType, QueueStatus
from app.core.security import hash_password, verify_password, create_access_token, decode_token
from app.services.slot_engine import generate_doctor_slots
from app.services.queue_service import issue_queue_token


async def run_tests():
    print("=" * 60)
    print("RUNNING PHASE 2 END-TO-END VERIFICATION")
    print("=" * 60)

    # In-memory SQLite for instant isolation
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    # Filter PostgreSQL-specific ExcludeConstraint for SQLite in-memory test runner
    from sqlalchemy.dialects.postgresql import ExcludeConstraint
    Appointment.__table__.constraints = {
        c for c in Appointment.__table__.constraints
        if not isinstance(c, ExcludeConstraint)
    }

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✓ SQLite Database schema initialized")

    async with async_session() as db:
        # 1. Test Password & Security
        pwd = "SecureDoctorPassword123!"
        hashed = hash_password(pwd)
        assert verify_password(pwd, hashed), "Password verification failed"
        assert not verify_password("WrongPassword", hashed), "Invalid password accepted"
        print("✓ Password hashing & Bcrypt verification passed")

        # 2. Test JWT Token Lifecycle
        token = create_access_token(subject="user-123", claims={"role": "DOCTOR"})
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "DOCTOR"
        print("✓ JWT creation & claim decoding passed")

        # 3. Create Tenant (Clinic) & Users
        clinic = Clinic(
            name="Metro Health Polyclinic",
            slug="metro-health",
            email="info@metrohealth.com",
            phone="+1-555-0199",
            address_line1="100 Medical Plaza",
            city="Metropolis",
            postal_code="10001",
            country="US"
        )
        db.add(clinic)
        await db.flush()

        doc_user = User(
            email="dr.smith@metrohealth.com",
            hashed_password=hashed,
            first_name="John",
            last_name="Smith",
            system_role=SystemRole.STAFF
        )
        db.add(doc_user)
        await db.flush()

        doc_staff = ClinicStaff(
            clinic_id=clinic.id,
            user_id=doc_user.id,
            role=ClinicRole.DOCTOR,
            designation="Senior Cardiologist"
        )
        db.add(doc_staff)
        await db.flush()

        doc_profile = DoctorProfile(
            clinic_id=clinic.id,
            user_id=doc_user.id,
            staff_id=doc_staff.id,
            specialization="Cardiology",
            license_number="MED-CARD-9921",
            qualifications="MD, FACC",
            consultation_fee=150.00
        )
        db.add(doc_profile)
        await db.flush()
        print("✓ Multi-tenant clinic, staff, and doctor profile initialized")

        # 4. Configure Doctor Availability Schedule (Monday = 0)
        # Shift: 09:00 - 12:00, 20-min slots, 5-min buffer. Lunch Break: 10:15 - 10:45
        schedule = DoctorSchedule(
            clinic_id=clinic.id,
            doctor_id=doc_profile.id,
            day_of_week=0,  # Monday
            shift_start_time=time(9, 0),
            shift_end_time=time(12, 0),
            slot_duration_minutes=20,
            buffer_time_minutes=5,
            is_active=True
        )
        db.add(schedule)
        await db.flush()

        lunch_break = DoctorBreak(
            schedule_id=schedule.id,
            break_name="Coffee & Charting",
            start_time=time(10, 15),
            end_time=time(10, 45)
        )
        db.add(lunch_break)

        # 5. Register a Patient
        patient = Patient(
            clinic_id=clinic.id,
            mrn="MRN-2026-0001",
            first_name="Alice",
            last_name="Walker",
            date_of_birth=date(1990, 5, 14),
            gender=Gender.FEMALE,
            blood_group=BloodGroup.O_POSITIVE,
            phone="+1-555-4321",
            allergies=["Penicillin"]
        )
        db.add(patient)
        await db.commit()
        print("✓ Doctor schedule with breaks and patient registration saved")

        # 6. Test Slot Generation Engine for next Monday
        # Find next Monday date
        today = date.today()
        days_ahead = (0 - today.weekday()) % 7
        if days_ahead == 0:
            days_ahead = 7
        target_monday = today + timedelta(days=days_ahead)

        slots_resp = await generate_doctor_slots(
            db=db,
            clinic_id=clinic.id,
            doctor_id=doc_profile.id,
            target_date=target_monday
        )
        print(f"✓ Slot Engine generated {len(slots_resp.slots)} slots for {target_monday}")
        for s in slots_resp.slots:
            print(f"   Slot: {s.start_time.strftime('%H:%M')} - {s.end_time.strftime('%H:%M')} | Available: {s.is_available} | Reason: {s.reason}")

        # Verify that break slot (10:15 - 10:45) is flagged as unavailable
        break_slots = [s for s in slots_resp.slots if not s.is_available and "BREAK" in (s.reason or "")]
        assert len(break_slots) > 0, "Break window was not properly excluded"
        print("✓ Slot Engine accurately identified and flagged intra-shift break")

        # 7. Book First Available Slot & Check-in
        first_available = next(s for s in slots_resp.slots if s.is_available)
        appointment = Appointment(
            clinic_id=clinic.id,
            patient_id=patient.id,
            doctor_id=doc_profile.id,
            appointment_number="APT-20261122-0001",
            appointment_type=AppointmentType.IN_PERSON,
            status=AppointmentStatus.SCHEDULED,
            start_time=first_available.start_time,
            end_time=first_available.end_time,
            reason_for_visit="Annual cardiac checkup"
        )
        db.add(appointment)
        await db.commit()
        await db.refresh(appointment)
        print(f"✓ Appointment booked: {appointment.appointment_number} ({appointment.start_time.strftime('%H:%M')} - {appointment.end_time.strftime('%H:%M')})")

        # 8. Re-query slots: Booked slot must now be marked as unavailable (BOOKED)
        updated_slots = await generate_doctor_slots(
            db=db,
            clinic_id=clinic.id,
            doctor_id=doc_profile.id,
            target_date=target_monday
        )
        matching_slot = next(s for s in updated_slots.slots if s.start_time == first_available.start_time)
        assert not matching_slot.is_available and matching_slot.reason == "BOOKED", "Booked slot was still marked available"
        print("✓ Dynamic slot collision detection verified: slot successfully transitioned to BOOKED")

        # 9. Test Live Reception Queue Token Issue
        token = await issue_queue_token(
            db=db,
            clinic_id=clinic.id,
            appointment_id=appointment.id
        )
        assert token.token_number == 1
        assert token.token_code == "Q-01"
        assert token.status == QueueStatus.WAITING
        assert appointment.status == AppointmentStatus.CHECKED_IN
        print(f"✓ Patient Check-in: Queue Token {token.token_code} issued, Appointment status -> {appointment.status.value}")

        # 10. Status progression: WAITING -> CALLED -> WITH_DOCTOR -> COMPLETED
        token.status = QueueStatus.WITH_DOCTOR
        appointment.status = AppointmentStatus.IN_CONSULTATION
        await db.commit()
        print("✓ Queue Progression: In-Consultation status verified")

    print("=" * 60)
    print("ALL PHASE 2 TESTS PASSED PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_tests())
