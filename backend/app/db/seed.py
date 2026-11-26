"""Database seeder with initial demo clinic, users, and schedules."""
import uuid
from datetime import date, time, datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.tenant import Clinic, ClinicSubscription, SubscriptionPlan, SubscriptionStatus
from app.models.user import User, ClinicStaff, SystemRole, ClinicRole
from app.models.patient import Patient, Gender, BloodGroup
from app.models.doctor import DoctorProfile, DoctorSchedule, DoctorBreak
from app.models.appointment import Appointment, QueueToken, AppointmentStatus, AppointmentType, QueueStatus
from app.models.unit import HospitalUnit
from app.models.emr import LabReport, LabTest, PatientLabReport
from app.models.nurse import NurseProfile, NurseBooking, NurseReview
from app.core.security import hash_password


async def sync_doctor_profiles(db: AsyncSession):
    """
    Scans all ClinicStaff with role == DOCTOR.
    Ensures every doctor has a corresponding DoctorProfile and default weekly schedule.
    """
    staff_stmt = (
        select(ClinicStaff)
        .where(ClinicStaff.role == ClinicRole.DOCTOR)
        .options(selectinload(ClinicStaff.user))
    )
    staff_res = await db.execute(staff_stmt)
    doctor_staffs = staff_res.scalars().all()

    synced_count = 0
    for s in doctor_staffs:
        doc_stmt = select(DoctorProfile).where(
            DoctorProfile.clinic_id == s.clinic_id,
            (DoctorProfile.staff_id == s.id) | (DoctorProfile.user_id == s.user_id)
        )
        doc_res = await db.execute(doc_stmt)
        existing_doc = doc_res.scalar_one_or_none()

        if not existing_doc:
            spec = s.department or s.designation or "General Medicine"
            new_doc = DoctorProfile(
                clinic_id=s.clinic_id,
                user_id=s.user_id,
                staff_id=s.id,
                specialization=spec,
                license_number=f"MED-{s.id.hex[:6].upper()}",
                qualifications=s.designation or "MBBS, MD",
                experience_years=5,
                consultation_fee=1000.0,
                follow_up_fee=500.0,
                follow_up_validity_days=14,
                bio=f"Senior medical specialist in {spec}.",
                is_available_for_booking=True
            )
            db.add(new_doc)
            await db.flush()

            for day in range(6):
                sched = DoctorSchedule(
                    clinic_id=s.clinic_id,
                    doctor_id=new_doc.id,
                    day_of_week=day,
                    shift_start_time=time(8, 0),
                    shift_end_time=time(17, 0),
                    slot_duration_minutes=20,
                    buffer_time_minutes=5,
                    is_active=True
                )
                db.add(sched)
                await db.flush()

                d_break = DoctorBreak(
                    schedule_id=sched.id,
                    break_name="Lunch Break",
                    start_time=time(12, 0),
                    end_time=time(13, 0)
                )
                db.add(d_break)

            synced_count += 1
            user_name = f"{s.user.first_name} {s.user.last_name}" if s.user else "Staff Doctor"
            print(f"Auto-created DoctorProfile & default schedules for {user_name}")

    if synced_count > 0:
        await db.commit()
        print(f"Successfully synced {synced_count} doctor profile(s) with clinical schedules.")


async def sync_hospital_units(db: AsyncSession, clinic_id: uuid.UUID):
    """Ensures default hospital units across General Bed, Cabin, ICU, CCU exist."""
    u_stmt = select(HospitalUnit).where(HospitalUnit.clinic_id == clinic_id, HospitalUnit.is_deleted == False)
    u_res = await db.execute(u_stmt)
    existing_units = u_res.scalars().all()
    if existing_units:
        return

    # Find a patient and doctor to assign one demo booked unit
    p_res = await db.execute(select(Patient).where(Patient.clinic_id == clinic_id, Patient.is_deleted == False).limit(1))
    demo_patient = p_res.scalar_one_or_none()

    doc_res = await db.execute(select(User).where(User.is_active == True).limit(1))
    demo_doctor = doc_res.scalar_one_or_none()

    default_units = [
        # General Ward Beds
        {"code": "BED-101", "name": "General Ward Bed 101", "category": "General Bed", "floor": "1st Floor", "price": 500.0, "status": "FREE", "patient": None},
        {"code": "BED-102", "name": "General Ward Bed 102", "category": "General Bed", "floor": "1st Floor", "price": 500.0, "status": "FREE", "patient": None},
        {"code": "BED-103", "name": "General Ward Bed 103", "category": "General Bed", "floor": "1st Floor", "price": 500.0, "status": "FREE", "patient": None},
        {"code": "BED-104", "name": "General Ward Bed 104", "category": "General Bed", "floor": "1st Floor", "price": 500.0, "status": "FREE", "patient": None},
        # Private Cabins
        {"code": "CABIN-201", "name": "Deluxe Cabin 201", "category": "Cabin", "floor": "2nd Floor", "price": 3500.0, "status": "BOOKED" if demo_patient else "FREE", "patient": demo_patient.id if demo_patient else None},
        {"code": "CABIN-202", "name": "Deluxe Cabin 202", "category": "Cabin", "floor": "2nd Floor", "price": 3500.0, "status": "FREE", "patient": None},
        {"code": "CABIN-203", "name": "Executive VIP Cabin 203", "category": "Cabin", "floor": "2nd Floor", "price": 5000.0, "status": "FREE", "patient": None},
        {"code": "CABIN-204", "name": "Executive VIP Cabin 204", "category": "Cabin", "floor": "2nd Floor", "price": 5000.0, "status": "FREE", "patient": None},
        # ICU Units
        {"code": "ICU-01", "name": "Intensive Care Unit 01", "category": "ICU", "floor": "3rd Floor", "price": 12000.0, "status": "FREE", "patient": None},
        {"code": "ICU-02", "name": "Intensive Care Unit 02", "category": "ICU", "floor": "3rd Floor", "price": 12000.0, "status": "FREE", "patient": None},
        # CCU Units
        {"code": "CCU-01", "name": "Coronary Care Unit 01", "category": "CCU", "floor": "3rd Floor", "price": 15000.0, "status": "FREE", "patient": None},
        {"code": "CCU-02", "name": "Coronary Care Unit 02", "category": "CCU", "floor": "3rd Floor", "price": 15000.0, "status": "FREE", "patient": None},
    ]

    for item in default_units:
        unit = HospitalUnit(
            clinic_id=clinic_id,
            unit_code=item["code"],
            unit_name=item["name"],
            category=item["category"],
            floor=item["floor"],
            daily_price=item["price"],
            status=item["status"],
            current_patient_id=item["patient"],
            current_doctor_id=demo_doctor.id if item["patient"] and demo_doctor else None,
            assigned_at=datetime.now(timezone.utc) if item["patient"] else None,
            notes="Admitted for specialized monitoring" if item["patient"] else None
        )
        db.add(unit)

    await db.commit()
    print(f"Seeded {len(default_units)} default hospital units (Bed/Cabin/ICU/CCU).")


async def sync_demo_lab_reports(db: AsyncSession, clinic_id: uuid.UUID):
    """Ensures realistic demo diagnostic lab test reports are seeded for existing patients."""
    existing_reports = await db.execute(select(LabReport).where(LabReport.clinic_id == clinic_id))
    if existing_reports.scalars().first():
        return

    doc_res = await db.execute(select(DoctorProfile).where(DoctorProfile.clinic_id == clinic_id).limit(1))
    doctor = doc_res.scalar_one_or_none()

    p_res = await db.execute(select(Patient).where(Patient.clinic_id == clinic_id).order_by(Patient.mrn.asc()))
    patients = p_res.scalars().all()
    if not patients:
        return

    patient_map = {p.mrn: p for p in patients}
    p1 = patient_map.get("MRN-2026-0001", patients[0])
    p2 = patient_map.get("MRN-2026-0002", patients[1] if len(patients) > 1 else patients[0])
    p3 = patient_map.get("MRN-2026-0003", patients[2] if len(patients) > 2 else patients[0])

    today = date.today()
    reports = [
        LabReport(
            clinic_id=clinic_id,
            patient_id=p1.id,
            doctor_id=doctor.id if doctor else None,
            test_name="CBC (Complete Blood Count)",
            test_category="Hematology",
            test_date=today - timedelta(days=2),
            result_summary="Mild Microcytic Hypochromic Anemia (Hemoglobin 10.8 g/dL). Total WBC count and platelets adequate within normal adult physiological limits.",
            status="Completed",
            lab_name="Metro Diagnostic & Clinical Laboratory, Dhaka",
            pathologist_name="Prof. Dr. M. A. Hasan, FCPS (Pathology)",
            notes="Peripheral Blood Film: Microcytic hypochromia (+), anisocytosis noted. Iron profile suggested.",
            findings_json=[
                {"parameter": "Hemoglobin (Hb)", "result": "10.8", "unit": "g/dL", "normal_range": "12.0 - 15.5", "flag": "LOW"},
                {"parameter": "Total RBC", "result": "3.85", "unit": "M/uL", "normal_range": "4.0 - 5.2", "flag": "LOW"},
                {"parameter": "Total WBC Count", "result": "7,400", "unit": "/cumm", "normal_range": "4,000 - 11,000", "flag": "NORMAL"},
                {"parameter": "Platelets", "result": "285,000", "unit": "/cumm", "normal_range": "150,000 - 450,000", "flag": "NORMAL"},
                {"parameter": "ESR (Westergren)", "result": "24", "unit": "mm/1st hr", "normal_range": "0 - 20", "flag": "HIGH"},
                {"parameter": "Hematocrit (PCV)", "result": "33.2", "unit": "%", "normal_range": "36.0 - 46.0", "flag": "LOW"},
                {"parameter": "MCV", "result": "76.4", "unit": "fL", "normal_range": "80.0 - 96.0", "flag": "LOW"},
                {"parameter": "MCH", "result": "25.2", "unit": "pg", "normal_range": "27.0 - 33.0", "flag": "LOW"},
                {"parameter": "MCHC", "result": "32.1", "unit": "g/dL", "normal_range": "31.5 - 35.0", "flag": "NORMAL"}
            ]
        ),
        LabReport(
            clinic_id=clinic_id,
            patient_id=p2.id,
            doctor_id=doctor.id if doctor else None,
            test_name="Serum Creatinine & Renal Function",
            test_category="Biochemistry & Nephrology",
            test_date=today - timedelta(days=3),
            result_summary="Serum Creatinine 1.1 mg/dL, Estimated GFR 94 mL/min/1.73m2. Baseline renal function intact with normal serum electrolytes.",
            status="Completed",
            lab_name="Metro Diagnostic & Clinical Laboratory, Dhaka",
            pathologist_name="Dr. N. Sultana, M.Phil (Biochemistry)",
            notes="Renal biochemical parameters well preserved. Continue routine annual surveillance.",
            findings_json=[
                {"parameter": "Serum Creatinine", "result": "1.1", "unit": "mg/dL", "normal_range": "0.7 - 1.3", "flag": "NORMAL"},
                {"parameter": "Blood Urea Nitrogen (BUN)", "result": "16.4", "unit": "mg/dL", "normal_range": "7.0 - 20.0", "flag": "NORMAL"},
                {"parameter": "Estimated GFR (eGFR)", "result": "94", "unit": "mL/min/1.73m²", "normal_range": "> 90", "flag": "NORMAL"},
                {"parameter": "Serum Uric Acid", "result": "5.6", "unit": "mg/dL", "normal_range": "3.5 - 7.2", "flag": "NORMAL"},
                {"parameter": "Serum Sodium (Na+)", "result": "139", "unit": "mmol/L", "normal_range": "135 - 145", "flag": "NORMAL"},
                {"parameter": "Serum Potassium (K+)", "result": "4.3", "unit": "mmol/L", "normal_range": "3.5 - 5.1", "flag": "NORMAL"},
                {"parameter": "Serum Chloride (Cl-)", "result": "101", "unit": "mmol/L", "normal_range": "96 - 106", "flag": "NORMAL"}
            ]
        ),
        LabReport(
            clinic_id=clinic_id,
            patient_id=p1.id,
            doctor_id=doctor.id if doctor else None,
            test_name="12-Lead Electrocardiogram (ECG)",
            test_category="Cardiology & Diagnostics",
            test_date=today - timedelta(days=5),
            result_summary="Normal Sinus Rhythm at 74 bpm. Normal cardiac axis, no ST-segment elevation or depression, normal QT interval.",
            status="Completed",
            lab_name="Metro Heart & Diagnostic Complex, Dhaka",
            pathologist_name="Dr. John Smith, MD, Senior Cardiologist",
            notes="Resting standard 12-lead ECG is within normal adult physiological limits.",
            findings_json=[
                {"parameter": "Heart Rate", "result": "74", "unit": "bpm", "normal_range": "60 - 100", "flag": "NORMAL"},
                {"parameter": "PR Interval", "result": "144", "unit": "ms", "normal_range": "120 - 200", "flag": "NORMAL"},
                {"parameter": "QRS Duration", "result": "86", "unit": "ms", "normal_range": "60 - 100", "flag": "NORMAL"},
                {"parameter": "QT / QTc Interval", "result": "390 / 418", "unit": "ms", "normal_range": "< 450", "flag": "NORMAL"},
                {"parameter": "P-R-T Axis", "result": "56 / 42 / 38", "unit": "degrees", "normal_range": "-30 to +90", "flag": "NORMAL"},
                {"parameter": "Rhythm Assessment", "result": "Normal Sinus Rhythm", "unit": "clinical", "normal_range": "Sinus Rhythm", "flag": "NORMAL"}
            ]
        ),
        LabReport(
            clinic_id=clinic_id,
            patient_id=p3.id,
            doctor_id=doctor.id if doctor else None,
            test_name="Fasting Lipid Profile",
            test_category="Biochemistry & Lipidology",
            test_date=today - timedelta(days=4),
            result_summary="Serum Total Cholesterol 215 mg/dL (Borderline High) with elevated Triglycerides 165 mg/dL. Dietary modification and follow-up recommended.",
            status="Completed",
            lab_name="Metro Diagnostic & Clinical Laboratory, Dhaka",
            pathologist_name="Dr. N. Sultana, M.Phil (Biochemistry)",
            notes="12-hour overnight fasting sample. Lifestyle and dietary intervention suggested.",
            findings_json=[
                {"parameter": "Total Cholesterol", "result": "215", "unit": "mg/dL", "normal_range": "< 200", "flag": "HIGH"},
                {"parameter": "Triglycerides", "result": "165", "unit": "mg/dL", "normal_range": "< 150", "flag": "HIGH"},
                {"parameter": "HDL Cholesterol", "result": "46", "unit": "mg/dL", "normal_range": "> 40", "flag": "NORMAL"},
                {"parameter": "LDL Cholesterol (Calculated)", "result": "136", "unit": "mg/dL", "normal_range": "< 100", "flag": "HIGH"},
                {"parameter": "VLDL Cholesterol", "result": "33", "unit": "mg/dL", "normal_range": "5 - 30", "flag": "HIGH"},
                {"parameter": "Cholesterol / HDL Ratio", "result": "4.67", "unit": "ratio", "normal_range": "< 4.5", "flag": "HIGH"}
            ]
        )
    ]
    db.add_all(reports)
    await db.commit()
    print(f"Seeded {len(reports)} diagnostic lab test reports with structured parameters.")


async def seed_demo_data(db: AsyncSession):
    """Seeds rich demo clinic data if not already present, and syncs doctor profiles."""
    existing_clinic = await db.execute(select(Clinic).where(Clinic.slug == "metro-health"))
    clinic_obj = existing_clinic.scalar_one_or_none()
    if clinic_obj:
        await sync_doctor_profiles(db)
        await sync_hospital_units(db, clinic_obj.id)
        await sync_demo_lab_reports(db, clinic_obj.id)
        await sync_nurses(db, clinic_obj.id)
        await sync_lab_tests(db, clinic_obj.id)
        await sync_patient_lab_reports(db, clinic_obj.id)
        await sync_nurse_reviews(db, clinic_obj.id)
        await sync_lab_assistant(db, clinic_obj.id)
        # Ensure admin@metrohealth.com has SUPER_ADMIN role
        admin_res = await db.execute(select(User).where(User.email == "admin@metrohealth.com"))
        admin_obj = admin_res.scalar_one_or_none()
        if admin_obj and admin_obj.system_role != SystemRole.SUPER_ADMIN:
            admin_obj.system_role = SystemRole.SUPER_ADMIN
            await db.commit()
            print("Unified admin@metrohealth.com with SUPER_ADMIN system role.")

        # Deactivate redundant separate superadmin account
        sa_res = await db.execute(select(User).where(User.email == "superadmin@metrohealth.com"))
        sa_obj = sa_res.scalar_one_or_none()
        if sa_obj and sa_obj.is_active:
            sa_obj.is_active = False
            await db.commit()
            print("Deactivated redundant separate superadmin@metrohealth.com account.")
        return  # Already seeded

    print("Seeding initial demo data for DoctorMS...")

    # 1. Demo Clinic
    clinic = Clinic(
        name="Metro Health Polyclinic",
        slug="metro-health",
        email="info@metrohealth.com",
        phone="+1-555-0199",
        address_line1="100 Medical Plaza, Suite 400",
        city="Metropolis",
        state="NY",
        postal_code="10001",
        country="BD",
        timezone="Asia/Dhaka",
        currency="BDT",
        is_active=True
    )
    db.add(clinic)
    await db.flush()

    # Subscription
    now = datetime.now(timezone.utc)
    sub = ClinicSubscription(
        clinic_id=clinic.id,
        plan=SubscriptionPlan.PROFESSIONAL,
        status=SubscriptionStatus.ACTIVE,
        current_period_start=now,
        current_period_end=now + timedelta(days=365),
        max_doctors=10,
        max_staff=25,
        max_monthly_appointments=2000
    )
    db.add(sub)

    # 2. Staff Users
    # Admin (Master Super Admin)
    admin_user = User(
        email="admin@metrohealth.com",
        hashed_password=hash_password("AdminPass123!"),
        first_name="Sarah",
        last_name="Connor",
        system_role=SystemRole.SUPER_ADMIN,
        is_active=True,
        is_email_verified=True
    )
    # Doctor
    doc_user = User(
        email="dr.smith@metrohealth.com",
        hashed_password=hash_password("DoctorPass123!"),
        first_name="John",
        last_name="Smith",
        system_role=SystemRole.STAFF,
        is_active=True,
        is_email_verified=True
    )
    # Receptionist
    rec_user = User(
        email="reception@metrohealth.com",
        hashed_password=hash_password("ReceptionPass123!"),
        first_name="Emily",
        last_name="Blunt",
        system_role=SystemRole.STAFF,
        is_active=True,
        is_email_verified=True
    )
    db.add_all([admin_user, doc_user, rec_user])
    await db.flush()

    # Clinic Staff Memberships
    admin_staff = ClinicStaff(
        clinic_id=clinic.id,
        user_id=admin_user.id,
        role=ClinicRole.CLINIC_ADMIN,
        designation="Operations Director",
        is_active=True
    )
    doc_staff = ClinicStaff(
        clinic_id=clinic.id,
        user_id=doc_user.id,
        role=ClinicRole.DOCTOR,
        designation="Senior Cardiologist",
        department="Cardiology",
        is_active=True
    )
    rec_staff = ClinicStaff(
        clinic_id=clinic.id,
        user_id=rec_user.id,
        role=ClinicRole.RECEPTIONIST,
        designation="Head Receptionist",
        is_active=True
    )
    db.add_all([admin_staff, doc_staff, rec_staff])
    await db.flush()

    # 3. Doctor Profile & Weekly Schedules (Monday through Saturday)
    doctor = DoctorProfile(
        clinic_id=clinic.id,
        user_id=doc_user.id,
        staff_id=doc_staff.id,
        specialization="Cardiology",
        license_number="MED-CARD-9921",
        qualifications="MD, FACC, Harvard Medical",
        experience_years=12,
        consultation_fee=150.00,
        follow_up_fee=75.00,
        bio="Specializing in preventative cardiology, hypertension, and arrhythmia management.",
        is_available_for_booking=True
    )
    db.add(doctor)
    await db.flush()

    # Schedule: Every weekday 08:00 - 17:00 with lunch break 12:00 - 13:00
    for day in range(6):  # Mon - Sat
        sched = DoctorSchedule(
            clinic_id=clinic.id,
            doctor_id=doctor.id,
            day_of_week=day,
            shift_start_time=time(8, 0),
            shift_end_time=time(17, 0),
            slot_duration_minutes=20,
            buffer_time_minutes=5,
            is_active=True
        )
        db.add(sched)
        await db.flush()

        d_break = DoctorBreak(
            schedule_id=sched.id,
            break_name="Lunch Break",
            start_time=time(12, 0),
            end_time=time(13, 0)
        )
        db.add(d_break)

    # 4. Patients
    patient1 = Patient(
        clinic_id=clinic.id,
        mrn="MRN-2026-0001",
        first_name="Alice",
        last_name="Walker",
        date_of_birth=date(1990, 5, 14),
        gender=Gender.FEMALE,
        blood_group=BloodGroup.O_POSITIVE,
        phone="+1-555-4321",
        email="alice.walker@example.com",
        allergies=["Penicillin"],
        chronic_conditions=["Mild Asthma"]
    )
    patient2 = Patient(
        clinic_id=clinic.id,
        mrn="MRN-2026-0002",
        first_name="Robert",
        last_name="Fox",
        date_of_birth=date(1975, 11, 2),
        gender=Gender.MALE,
        blood_group=BloodGroup.A_POSITIVE,
        phone="+1-555-8765",
        allergies=[],
        chronic_conditions=["Hypertension"]
    )
    patient3 = Patient(
        clinic_id=clinic.id,
        mrn="MRN-2026-0003",
        first_name="David",
        last_name="Miller",
        date_of_birth=date(1982, 3, 19),
        gender=Gender.MALE,
        blood_group=BloodGroup.B_POSITIVE,
        phone="+1-555-9911"
    )
    db.add_all([patient1, patient2, patient3])
    await db.flush()

    # 5. Sample Live Queue & Appointments for Today
    today = date.today()
    base_time = datetime.combine(today, time(9, 0)).replace(tzinfo=timezone.utc)

    # Appointment 1 (Alice - WITH_DOCTOR)
    appt1 = Appointment(
        clinic_id=clinic.id,
        patient_id=patient1.id,
        doctor_id=doctor.id,
        appointment_number=f"APT-{today.strftime('%Y%m%d')}-0001",
        appointment_type=AppointmentType.IN_PERSON,
        status=AppointmentStatus.IN_CONSULTATION,
        start_time=base_time,
        end_time=base_time + timedelta(minutes=20),
        reason_for_visit="Routine cardiac checkup"
    )
    # Appointment 2 (Robert - CALLED)
    appt2 = Appointment(
        clinic_id=clinic.id,
        patient_id=patient2.id,
        doctor_id=doctor.id,
        appointment_number=f"APT-{today.strftime('%Y%m%d')}-0002",
        appointment_type=AppointmentType.IN_PERSON,
        status=AppointmentStatus.CHECKED_IN,
        start_time=base_time + timedelta(minutes=25),
        end_time=base_time + timedelta(minutes=45),
        reason_for_visit="Blood pressure follow-up"
    )
    # Appointment 3 (David - WAITING)
    appt3 = Appointment(
        clinic_id=clinic.id,
        patient_id=patient3.id,
        doctor_id=doctor.id,
        appointment_number=f"APT-{today.strftime('%Y%m%d')}-0003",
        appointment_type=AppointmentType.IN_PERSON,
        status=AppointmentStatus.CHECKED_IN,
        start_time=base_time + timedelta(minutes=50),
        end_time=base_time + timedelta(minutes=70),
        reason_for_visit="General consultation"
    )
    db.add_all([appt1, appt2, appt3])
    await db.flush()

    # Queue Tokens
    token1 = QueueToken(
        clinic_id=clinic.id,
        appointment_id=appt1.id,
        doctor_id=doctor.id,
        queue_date=today,
        token_number=1,
        token_code="Q-01",
        status=QueueStatus.WITH_DOCTOR,
        check_in_time=base_time - timedelta(minutes=15),
        called_time=base_time - timedelta(minutes=5),
        consultation_start_time=base_time
    )
    token2 = QueueToken(
        clinic_id=clinic.id,
        appointment_id=appt2.id,
        doctor_id=doctor.id,
        queue_date=today,
        token_number=2,
        token_code="Q-02",
        status=QueueStatus.CALLED,
        check_in_time=base_time - timedelta(minutes=10),
        called_time=base_time + timedelta(minutes=5)
    )
    token3 = QueueToken(
        clinic_id=clinic.id,
        appointment_id=appt3.id,
        doctor_id=doctor.id,
        queue_date=today,
        token_number=3,
        token_code="Q-03",
        status=QueueStatus.WAITING,
        check_in_time=base_time - timedelta(minutes=5)
    )
    db.add_all([token1, token2, token3])

    await db.commit()
    await sync_demo_lab_reports(db, clinic.id)
    await sync_nurses(db, clinic.id)
    await sync_lab_tests(db, clinic.id)
    await sync_patient_lab_reports(db, clinic.id)
    await sync_nurse_reviews(db, clinic.id)
    print("Demo clinic, users, schedules, and live queue successfully seeded!")


async def sync_nurses(db: AsyncSession, clinic_id: uuid.UUID):
    """Ensures 4 realistic Bangladeshi nurses across Dhaka locations exist."""
    from app.models.nurse import NurseProfile
    n_res = await db.execute(select(NurseProfile))
    existing_nurses = n_res.scalars().all()
    if existing_nurses:
        return

    nurses_data = [
        {
            "email": "farzana.nurse@metrohealth.com",
            "first_name": "Farzana",
            "last_name": "Akhter",
            "phone": "+880 1712-340011",
            "avatar_url": "https://images.unsplash.com/photo-1594824813689-ff371cb76550?q=80&w=400&auto=format&fit=crop",
            "education": "BSc in Nursing, Dhaka Medical College & Hospital",
            "experience_years": "6+ Years (Critical Care, Post-Op & Home Care)",
            "service_location": "Dhanmondi, Dhaka",
            "service_fee_bdt": 1500.0,
            "bio": "Specialized in tracheostomy care, catheterization, IV cannulation, insulin administration, and post-stroke rehabilitation."
        },
        {
            "email": "rakib.nurse@metrohealth.com",
            "first_name": "Mohammad Rakib",
            "last_name": "Hasan",
            "phone": "+880 1819-551122",
            "avatar_url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=400&auto=format&fit=crop",
            "education": "Diploma in General Nursing & Midwifery, BSMMU",
            "experience_years": "4+ Years (ICU, Cardiac Monitoring & Palliative Care)",
            "service_location": "Uttara, Dhaka",
            "service_fee_bdt": 1200.0,
            "bio": "Expert in ventilator patient management, bed sore dressing, vital signs monitoring, and geriatric palliative care."
        },
        {
            "email": "jannat.nurse@metrohealth.com",
            "first_name": "Jannatul",
            "last_name": "Ferdous",
            "phone": "+880 1913-772233",
            "avatar_url": "https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=400&auto=format&fit=crop",
            "education": "BSc in Nursing, Universal Medical College",
            "experience_years": "5+ Years (Maternal, Pediatric & Post-Surgical Home Care)",
            "service_location": "Gulshan, Dhaka",
            "service_fee_bdt": 2000.0,
            "bio": "Specializes in neonatal baby care, postpartum mother care, surgical wound management, and nebulization therapy."
        },
        {
            "email": "sumaiya.nurse@metrohealth.com",
            "first_name": "Sumaiya",
            "last_name": "Yasmin",
            "phone": "+880 1611-998844",
            "avatar_url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=400&auto=format&fit=crop",
            "education": "Diploma in Nursing Science & Orthopedic Care, NITOR",
            "experience_years": "7+ Years (Orthopedic Recovery & Elderly Home Support)",
            "service_location": "Mirpur, Dhaka",
            "service_fee_bdt": 1400.0,
            "bio": "Experienced in orthopedic traction care, mobility assistance, medication dispensing, and diabetic wound debridement."
        }
    ]

    for nd in nurses_data:
        u_res = await db.execute(select(User).where(User.email == nd["email"]))
        user = u_res.scalar_one_or_none()
        if not user:
            user = User(
                email=nd["email"],
                hashed_password=hash_password("NursePass123!"),
                first_name=nd["first_name"],
                last_name=nd["last_name"],
                phone=nd["phone"],
                system_role=SystemRole.NURSE,
                is_active=True,
                is_email_verified=True,
                avatar_url=nd["avatar_url"]
            )
            db.add(user)
            await db.flush()

            staff = ClinicStaff(
                clinic_id=clinic_id,
                user_id=user.id,
                role=ClinicRole.NURSE,
                designation="Registered Home Care Nurse",
                department="Home Nursing",
                is_active=True
            )
            db.add(staff)
            await db.flush()

        profile = NurseProfile(
            clinic_id=clinic_id,
            user_id=user.id,
            full_name=f"Nurse {nd['first_name']} {nd['last_name']}",
            phone=nd["phone"],
            email=nd["email"],
            avatar_url=nd["avatar_url"],
            education=nd["education"],
            experience_years=nd["experience_years"],
            service_location=nd["service_location"],
            service_fee_bdt=nd["service_fee_bdt"],
            bio=nd["bio"],
            is_available=True
        )
        db.add(profile)

    await db.commit()
    print("Seeded 4 realistic Bangladeshi home care nurses across Dhaka locations.")


async def sync_lab_tests(db: AsyncSession, clinic_id: uuid.UUID):
    """
    Ensures 15 realistic hospital diagnostic tests (Lab Facilities) exist.
    """
    t_res = await db.execute(select(LabTest))
    existing_tests = t_res.scalars().all()
    if existing_tests:
        return

    tests_data = [
        {
            "test_code": "LAB-01",
            "test_name": "Complete Blood Count (CBC)",
            "category": "Pathology",
            "sample_type": "Blood",
            "price_bdt": 450.0,
            "report_delivery_time": "Same Day (4 Hours)",
            "description": "Comprehensive automated blood count assessing Hemoglobin, RBC, WBC differential, Platelets, and ESR.",
        },
        {
            "test_code": "LAB-02",
            "test_name": "Fasting Blood Sugar (FBS)",
            "category": "Pathology",
            "sample_type": "Blood",
            "price_bdt": 200.0,
            "report_delivery_time": "Same Day (2 Hours)",
            "description": "Essential diagnostic test measuring plasma glucose levels following 8–10 hours of fasting.",
        },
        {
            "test_code": "LAB-03",
            "test_name": "Lipid Profile",
            "category": "Biochemistry",
            "sample_type": "Blood",
            "price_bdt": 1200.0,
            "report_delivery_time": "Same Day (6 Hours)",
            "description": "Complete cardiovascular lipid panel: Total Cholesterol, HDL, LDL, VLDL, and Triglycerides.",
        },
        {
            "test_code": "LAB-04",
            "test_name": "HbA1c (Glycated Hemoglobin)",
            "category": "Biochemistry",
            "sample_type": "Blood",
            "price_bdt": 1000.0,
            "report_delivery_time": "1 Day",
            "description": "Gold-standard 3-month average glycemic control assessment for diabetes mellitus management.",
        },
        {
            "test_code": "LAB-05",
            "test_name": "Liver Function Test (LFT)",
            "category": "Biochemistry",
            "sample_type": "Blood",
            "price_bdt": 1100.0,
            "report_delivery_time": "Same Day (6 Hours)",
            "description": "Hepatic screen: SGPT (ALT), SGOT (AST), Alkaline Phosphatase, Total Bilirubin, and Total Protein/Albumin.",
        },
        {
            "test_code": "LAB-06",
            "test_name": "Serum Creatinine & RFT",
            "category": "Biochemistry",
            "sample_type": "Blood",
            "price_bdt": 400.0,
            "report_delivery_time": "Same Day (4 Hours)",
            "description": "Kidney renal clearance function measurement with calculated estimated eGFR.",
        },
        {
            "test_code": "LAB-07",
            "test_name": "Thyroid Profile (TSH, FT3, FT4)",
            "category": "Pathology",
            "sample_type": "Blood",
            "price_bdt": 1800.0,
            "report_delivery_time": "1 Day",
            "description": "Comprehensive immunoassay evaluating thyroid endocrine function, hypothyroidism, and hyperthyroidism.",
        },
        {
            "test_code": "LAB-08",
            "test_name": "Digital Chest X-Ray (PA View)",
            "category": "Radiology & Imaging",
            "sample_type": "Imaging",
            "price_bdt": 600.0,
            "report_delivery_time": "Same Day (2 Hours)",
            "description": "High-resolution digital chest radiography for cardiopulmonary, bronchial, and pleural evaluation.",
        },
        {
            "test_code": "LAB-09",
            "test_name": "12-Lead Resting ECG",
            "category": "Cardiology",
            "sample_type": "Non-Invasive",
            "price_bdt": 500.0,
            "report_delivery_time": "Instant (30 Mins)",
            "description": "Precision electrocardiogram diagnosing cardiac rhythms, myocardial ischemia, and arrhythmias.",
        },
        {
            "test_code": "LAB-10",
            "test_name": "Color Doppler Echocardiogram",
            "category": "Cardiology",
            "sample_type": "Imaging",
            "price_bdt": 2800.0,
            "report_delivery_time": "Same Day (4 Hours)",
            "description": "Advanced 2D transthoracic ultrasound assessing cardiac chambers, ejection fraction (LVEF), and valvular flow.",
        },
        {
            "test_code": "LAB-11",
            "test_name": "Whole Abdomen Ultrasonography (USG)",
            "category": "Radiology & Imaging",
            "sample_type": "Imaging",
            "price_bdt": 1500.0,
            "report_delivery_time": "Same Day (3 Hours)",
            "description": "Detailed real-time sonic scan of hepatobiliary, gallbladder, kidneys, spleen, pancreas, and pelvis.",
        },
        {
            "test_code": "LAB-12",
            "test_name": "Brain MRI (Plain)",
            "category": "Radiology & Imaging",
            "sample_type": "Imaging",
            "price_bdt": 8500.0,
            "report_delivery_time": "2 Days",
            "description": "High-field 1.5 Tesla cranial magnetic resonance imaging of brain parenchyma and neurovascular structures.",
        },
        {
            "test_code": "LAB-13",
            "test_name": "Urine Routine & Microscopic (R/M/E)",
            "category": "Pathology",
            "sample_type": "Urine",
            "price_bdt": 250.0,
            "report_delivery_time": "Same Day (2 Hours)",
            "description": "Urinalysis screening for proteinuria, glucose, pus cells, RBCs, casts, and urinary tract infection (UTI).",
        },
        {
            "test_code": "LAB-14",
            "test_name": "Serum Electrolytes (Na+, K+, Cl-)",
            "category": "Biochemistry",
            "sample_type": "Blood",
            "price_bdt": 900.0,
            "report_delivery_time": "Same Day (4 Hours)",
            "description": "Automated ion-selective electrode measurement for systemic fluid, electrolyte, and acid-base balance.",
        },
        {
            "test_code": "LAB-15",
            "test_name": "Dengue NS1 Antigen & Antibody Panel",
            "category": "Pathology",
            "sample_type": "Blood",
            "price_bdt": 800.0,
            "report_delivery_time": "Same Day (2 Hours)",
            "description": "Rapid immunoassay for early acute dengue detection (NS1) along with IgG and IgM antibody titres.",
        },
    ]

    for td in tests_data:
        test = LabTest(
            clinic_id=clinic_id,
            test_code=td["test_code"],
            test_name=td["test_name"],
            category=td["category"],
            sample_type=td["sample_type"],
            price_bdt=td["price_bdt"],
            report_delivery_time=td["report_delivery_time"],
            is_active=True,
            description=td["description"],
        )
        db.add(test)

    await db.commit()
    print("Seeded 15 realistic hospital diagnostic tests (Lab Facilities).")


async def sync_patient_lab_reports(db: AsyncSession, clinic_id: uuid.UUID):
    """
    Ensures sample patient lab orders & reports exist for demonstration.
    """
    r_res = await db.execute(select(PatientLabReport))
    existing_reports = r_res.scalars().all()
    if existing_reports:
        return

    p_res = await db.execute(select(Patient).where(Patient.clinic_id == clinic_id).limit(2))
    patients = p_res.scalars().all()
    if not patients:
        return

    p1 = patients[0]
    p2 = patients[1] if len(patients) > 1 else patients[0]

    # Create 2 sample patient lab reports
    sample_reports = [
        PatientLabReport(
            clinic_id=clinic_id,
            order_code="RPT-2026-0001",
            patient_id=p1.id,
            patient_name=f"{p1.first_name} {p1.last_name}",
            patient_mrn=p1.mrn,
            test_name="Complete Blood Count (CBC)",
            test_code="LAB-01",
            fee_bdt=450.0,
            ordered_by_doctor="Dr. John Smith",
            status="Report Ready",
            result_summary="Hemoglobin 14.2 g/dL (Normal: 13.0 - 17.0). Platelet Count: 240,000 /mcL (Normal: 150,000 - 450,000). Total WBC: 7,500 /mcL.",
            report_file_url="/uploads/lab-reports/sample_cbc_report.pdf",
        ),
        PatientLabReport(
            clinic_id=clinic_id,
            order_code="RPT-2026-0002",
            patient_id=p2.id,
            patient_name=f"{p2.first_name} {p2.last_name}",
            patient_mrn=p2.mrn,
            test_name="Lipid Profile",
            test_code="LAB-03",
            fee_bdt=1200.0,
            ordered_by_doctor="Dr. John Smith",
            status="Processing",
            result_summary="Blood serum sample collected. Running enzymatic spectrophotometry in clinical laboratory.",
        ),
    ]
    db.add_all(sample_reports)
    await db.commit()
    print("Seeded sample patient lab orders & diagnostic reports.")


async def sync_nurse_reviews(db: AsyncSession, clinic_id: uuid.UUID):
    """
    Seeds initial nurse reviews for demo nurses so the directory and profiles
    display verified ratings, and marks sample completed bookings.
    """
    from app.models.nurse import NurseProfile, NurseBooking, NurseReview
    from app.models.billing import Invoice

    # Check if any review exists
    r_res = await db.execute(select(NurseReview))
    existing_rev = r_res.scalars().first()

    # Check for existing bookings
    b_res = await db.execute(select(NurseBooking).order_by(NurseBooking.created_at.asc()))
    bookings = b_res.scalars().all()
    if bookings:
        # Mark first booking (NRS-2026-0001) as Completed and Paid so patient sees "Rate Nurse" button unlocked!
        b1 = bookings[0]
        b1.status = "Completed"
        b1.payment_status = "Paid"
        b1.duty_status = "Completed"
        if b1.invoice_id:
            inv1 = await db.get(Invoice, b1.invoice_id)
            if inv1:
                inv1.payment_status = "Paid"
                inv1.due_amount_bdt = 0.00
                inv1.paid_amount_bdt = inv1.amount_bdt

        # If there is a second booking, mark as Completed & Paid and add a review to demonstrate "You rated ★ 5.0"
        if len(bookings) > 1 and not existing_rev:
            b2 = bookings[1]
            b2.status = "Completed"
            b2.payment_status = "Paid"
            b2.duty_status = "Completed"
            if b2.invoice_id:
                inv2 = await db.get(Invoice, b2.invoice_id)
                if inv2:
                    inv2.payment_status = "Paid"
                    inv2.due_amount_bdt = 0.00
                    inv2.paid_amount_bdt = inv2.amount_bdt

            p2 = await db.get(Patient, b2.patient_id)
            p_name2 = f"{p2.first_name} {p2.last_name}" if p2 else "Ayesha Siddiqua"
            rev = NurseReview(
                clinic_id=clinic_id,
                booking_id=b2.id,
                nurse_id=b2.nurse_id,
                patient_id=b2.patient_id,
                patient_name=p_name2,
                rating=5,
                comment="Nurse Rakib was extraordinarily punctual, gentle with catheter dressing, and kept my mother comfortable throughout the entire night shift. Highly recommended!"
            )
            db.add(rev)

    # Set baseline ratings for nurses if unreviewed
    n_res = await db.execute(select(NurseProfile))
    all_nurses = n_res.scalars().all()
    sample_scores = [
        {"avg": 4.9, "count": 18},
        {"avg": 4.8, "count": 14},
        {"avg": 5.0, "count": 9},
        {"avg": 4.7, "count": 11},
    ]
    for idx, n in enumerate(all_nurses):
        score = sample_scores[idx % len(sample_scores)]
        if float(n.average_rating or 0.0) == 0.0:
            n.average_rating = score["avg"]
            n.total_reviews = score["count"]

    await db.commit()
    print("Synchronized demo nurse reviews and live rating aggregations.")


async def sync_lab_assistant(db: AsyncSession, clinic_id: uuid.UUID):
    """Ensures demo lab assistant account exists for testing lab reports."""
    lab_res = await db.execute(select(User).where(User.email == "lab@metrohealth.com"))
    lab_user = lab_res.scalar_one_or_none()
    if not lab_user:
        lab_user = User(
            email="lab@metrohealth.com",
            hashed_password=hash_password("LabPass123!"),
            first_name="Tariqul",
            last_name="Islam",
            system_role=SystemRole.LAB_ASSISTANT,
            is_active=True,
            is_email_verified=True
        )
        db.add(lab_user)
        await db.flush()

        staff = ClinicStaff(
            clinic_id=clinic_id,
            user_id=lab_user.id,
            role=ClinicRole.LAB_ASSISTANT,
            designation="Senior Lab Technologist",
            department="Pathology & Diagnostics",
            is_active=True
        )
        db.add(staff)
        await db.commit()
        print("Seeded demo Lab Assistant account (lab@metrohealth.com / LabPass123!).")
    elif lab_user.system_role != SystemRole.LAB_ASSISTANT:
        lab_user.system_role = SystemRole.LAB_ASSISTANT
        await db.commit()



