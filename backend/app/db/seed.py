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
from app.models.emr import LabReport
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
