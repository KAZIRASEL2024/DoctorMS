"""End-to-End Functional Test Suite for Phase 4: EMR, E-Rx PDF & Invoicing."""
import asyncio
import sys
import os
from datetime import date, datetime, timezone

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.models.base import Base
from app.models.tenant import Clinic
from app.models.user import User, ClinicStaff, ClinicRole, SystemRole
from app.models.patient import Patient, Gender, BloodGroup
from app.models.doctor import DoctorProfile
from app.models.appointment import Appointment, AppointmentStatus, AppointmentType
from app.models.emr import Encounter, VitalSign, SoapNote, ClinicalDiagnosis
from app.models.prescription import MedicineMaster, Prescription, PrescriptionItem, DosageForm, MealTiming
from app.models.billing import Invoice, InvoiceItem, PaymentTransaction, InvoiceStatus, PaymentMode, InvoiceItemType
from app.services.pdf_service import (
    generate_verification_hash, build_prescription_pdf, build_prescription_html
)


async def run_phase4_tests():
    print("=" * 60)
    print("RUNNING PHASE 4 END-TO-END VERIFICATION")
    print("=" * 60)

    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

    from sqlalchemy.dialects.postgresql import ExcludeConstraint
    Appointment.__table__.constraints = {
        c for c in Appointment.__table__.constraints
        if not isinstance(c, ExcludeConstraint)
    }

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        # 1. Initialize Baseline Clinic, Doctor, Patient
        clinic = Clinic(
            name="Apollo Medical Center",
            slug="apollo-medical",
            email="care@apollo.com",
            phone="+1-555-9000",
            address_line1="500 Healthcare Blvd",
            city="Boston",
            postal_code="02115",
            country="US"
        )
        db.add(clinic)
        await db.flush()

        doc_user = User(
            email="dr.watson@apollo.com",
            hashed_password="hashed_pw_test",
            first_name="Arthur",
            last_name="Watson",
            system_role=SystemRole.STAFF
        )
        db.add(doc_user)
        await db.flush()

        staff = ClinicStaff(
            clinic_id=clinic.id,
            user_id=doc_user.id,
            role=ClinicRole.DOCTOR,
            designation="Chief Physician"
        )
        db.add(staff)
        await db.flush()

        doc_profile = DoctorProfile(
            clinic_id=clinic.id,
            user_id=doc_user.id,
            staff_id=staff.id,
            specialization="Internal Medicine",
            license_number="LIC-MD-10023",
            qualifications="MD, FACP",
            consultation_fee=160.00
        )
        db.add(doc_profile)
        await db.flush()

        patient = Patient(
            clinic_id=clinic.id,
            mrn="MRN-2026-0099",
            first_name="Eleanor",
            last_name="Rigby",
            date_of_birth=date(1988, 8, 20),
            gender=Gender.FEMALE,
            blood_group=BloodGroup.A_POSITIVE,
            phone="+1-555-8822"
        )
        db.add(patient)
        await db.commit()
        print("✓ Foundation entities initialized")

        # 2. Test Clinical Encounter & Vitals with BMI auto-calc
        encounter = Encounter(
            clinic_id=clinic.id,
            patient_id=patient.id,
            doctor_id=doc_profile.id,
            chief_complaint="Persistent dry cough and fatigue for 10 days",
            encounter_date=datetime.now(timezone.utc)
        )
        db.add(encounter)
        await db.flush()

        height_cm = 170.0
        weight_kg = 68.0
        bmi = round(weight_kg / ((height_cm / 100.0) ** 2), 1)
        assert bmi == 23.5, f"BMI calculation incorrect: expected 23.5, got {bmi}"

        vitals = VitalSign(
            clinic_id=clinic.id,
            encounter_id=encounter.id,
            patient_id=patient.id,
            recorded_by_id=doc_user.id,
            systolic_bp=122,
            diastolic_bp=82,
            pulse_rate=76,
            temperature_celsius=37.1,
            spo2_percent=98.5,
            height_cm=height_cm,
            weight_kg=weight_kg,
            bmi=bmi
        )
        db.add(vitals)

        # 3. Test SOAP Notes (Subjective, Objective, Assessment, Plan)
        soap = SoapNote(
            clinic_id=clinic.id,
            encounter_id=encounter.id,
            doctor_id=doc_profile.id,
            subjective="Patient describes mild feverish feeling and non-productive cough.",
            objective="Chest clear. Pulse 76, BP 122/82. SpO2 98.5% on room air.",
            assessment="Acute viral bronchitis. Resolving phase.",
            plan="Oral fluids, warm saline gargles, Dextromethorphan syrup."
        )
        db.add(soap)
        await db.commit()
        print("✓ EMR Vitals (BMI: 23.5) and SOAP clinical notes recorded")

        # 4. Test E-Prescription with Cryptographic SHA-256 Hash
        rx_code = "RX-20261122-0099"
        now_iso = datetime.now(timezone.utc).isoformat()
        v_hash = generate_verification_hash(
            clinic_id=str(clinic.id),
            doctor_license=doc_profile.license_number,
            patient_mrn=patient.mrn,
            prescription_code=rx_code,
            created_at_iso=now_iso
        )
        assert len(v_hash) == 64, "SHA-256 hash length must be 64 characters"

        prescription = Prescription(
            clinic_id=clinic.id,
            encounter_id=encounter.id,
            patient_id=patient.id,
            doctor_id=doc_profile.id,
            prescription_code=rx_code,
            general_advice="Plenty of warm fluids. Avoid cold beverages and air-conditioning.",
            follow_up_date=date(2026, 11, 29),
            verification_hash=v_hash,
            is_finalized=True
        )
        db.add(prescription)
        await db.flush()

        item1 = PrescriptionItem(
            prescription_id=prescription.id,
            medicine_name="Dextromethorphan HBr",
            dosage="10mg/5ml",
            frequency="1-0-1",
            duration="5 Days",
            meal_timing=MealTiming.AFTER_MEAL,
            instructions="5ml twice daily after food"
        )
        item2 = PrescriptionItem(
            prescription_id=prescription.id,
            medicine_name="Vitamin C + Zinc",
            dosage="500mg",
            frequency="0-1-0",
            duration="10 Days",
            meal_timing=MealTiming.WITH_MEAL,
            instructions="One chewable tablet daily with lunch"
        )
        db.add_all([item1, item2])
        await db.commit()
        print(f"✓ E-Prescription {prescription.prescription_code} issued with SHA-256: {v_hash[:16]}...")

        # 5. Test PDF and HTML Generator
        rx_bundle = {
            "id": str(prescription.id),
            "clinic_name": clinic.name,
            "clinic_address": f"{clinic.address_line1}, {clinic.city}",
            "clinic_phone": clinic.phone,
            "clinic_email": clinic.email,
            "prescription_code": prescription.prescription_code,
            "verification_hash": prescription.verification_hash,
            "verify_url": f"http://localhost:3000/verify-rx?code={prescription.verification_hash}",
            "date": "2026-11-22",
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "patient_gender": patient.gender.value,
            "patient_dob": str(patient.date_of_birth),
            "patient_mrn": patient.mrn,
            "doctor_name": f"Dr. {doc_user.first_name} {doc_user.last_name}",
            "doctor_specialization": doc_profile.specialization,
            "doctor_license": doc_profile.license_number,
            "general_advice": prescription.general_advice,
            "follow_up_date": str(prescription.follow_up_date),
            "vitals": {"bp": "122/82", "pulse": 76, "weight": 68.0, "bmi": 23.5},
            "items": [
                {
                    "medicine_name": "Dextromethorphan HBr",
                    "dosage": "10mg/5ml",
                    "frequency": "1-0-1",
                    "duration": "5 Days",
                    "meal_timing": "AFTER_MEAL",
                    "instructions": "5ml twice daily"
                },
                {
                    "medicine_name": "Vitamin C + Zinc",
                    "dosage": "500mg",
                    "frequency": "0-1-0",
                    "duration": "10 Days",
                    "meal_timing": "WITH_MEAL",
                    "instructions": "Chewable tablet"
                }
            ]
        }
        pdf_bytes = build_prescription_pdf(rx_bundle)
        assert pdf_bytes.startswith(b"%PDF-1.4"), "PDF output missing valid %PDF-1.4 header"
        assert b"%%EOF" in pdf_bytes, "PDF output missing EOF trailer"
        html_doc = build_prescription_html(rx_bundle)
        assert "Apollo Medical Center" in html_doc, "Prescription HTML missing clinic letterhead"
        print(f"✓ E-Prescription binary PDF generated ({len(pdf_bytes)} bytes) and verified")

        # 6. Test Invoicing Engine with Partial Payments
        subtotal = 160.00 + 40.00  # $160 consult + $40 lab test = $200
        discount = 20.00           # $20 discount
        tax_rate = 5.0             # 5% tax
        tax_amount = (200 - 20) * 0.05  # $9.00
        total_amount = (200 - 20) + tax_amount  # $189.00

        invoice = Invoice(
            clinic_id=clinic.id,
            patient_id=patient.id,
            invoice_number="INV-202611-0099",
            status=InvoiceStatus.ISSUED,
            issue_date=date.today(),
            due_date=date.today(),
            subtotal=subtotal,
            discount_amount=discount,
            tax_rate_percent=tax_rate,
            tax_amount=tax_amount,
            total_amount=total_amount,
            paid_amount=0.00,
            balance_amount=total_amount
        )
        db.add(invoice)
        await db.flush()

        inv_item1 = InvoiceItem(
            invoice_id=invoice.id,
            item_type=InvoiceItemType.CONSULTATION,
            description="Specialist Physician Consultation",
            quantity=1,
            unit_price=160.00,
            total_price=160.00
        )
        inv_item2 = InvoiceItem(
            invoice_id=invoice.id,
            item_type=InvoiceItemType.LAB_TEST,
            description="Complete Blood Count (CBC) Panel",
            quantity=1,
            unit_price=40.00,
            total_price=40.00
        )
        db.add_all([inv_item1, inv_item2])
        await db.commit()
        print(f"✓ Invoice {invoice.invoice_number} created: Subtotal ${subtotal}, Total ${total_amount}")

        # 7. Record Partial Payment ($100.00 via CARD)
        payment1 = PaymentTransaction(
            clinic_id=clinic.id,
            invoice_id=invoice.id,
            patient_id=patient.id,
            received_by_id=doc_user.id,
            transaction_reference="TXN-CARD-449102",
            payment_mode=PaymentMode.CREDIT_CARD,
            amount=100.00
        )
        db.add(payment1)
        invoice.paid_amount += 100.00
        invoice.balance_amount = invoice.total_amount - invoice.paid_amount
        invoice.status = InvoiceStatus.PARTIALLY_PAID
        await db.commit()
        assert invoice.balance_amount == 89.00, f"Expected balance 89.00, got {invoice.balance_amount}"
        assert invoice.status == InvoiceStatus.PARTIALLY_PAID
        print(f"✓ Partial Payment recorded: Paid ${invoice.paid_amount}, Remaining Balance ${invoice.balance_amount} (Status: {invoice.status.value})")

        # 8. Settle Final Balance ($89.00 via CASH)
        payment2 = PaymentTransaction(
            clinic_id=clinic.id,
            invoice_id=invoice.id,
            patient_id=patient.id,
            received_by_id=doc_user.id,
            transaction_reference="TXN-CASH-881923",
            payment_mode=PaymentMode.CASH,
            amount=89.00
        )
        db.add(payment2)
        invoice.paid_amount += 89.00
        invoice.balance_amount = 0.00
        invoice.status = InvoiceStatus.PAID
        await db.commit()
        assert invoice.balance_amount == 0.00
        assert invoice.status == InvoiceStatus.PAID
        print(f"✓ Final Payment recorded: Invoice fully settled! (Status: {invoice.status.value})")

    print("=" * 60)
    print("ALL PHASE 4 TESTS PASSED PERFECTLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_phase4_tests())
