# DoctorMS — Commercial Multi-Tenant Doctor & Clinic Management System

DoctorMS is an enterprise-grade, commercial multi-tenant SaaS platform engineered for private clinics, polyclinics, and independent healthcare practitioners.

---

## 🛠️ Tech Stack & Architecture

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 (Async), Pydantic v2, PostgreSQL 16 (`btree_gist`, `pgcrypto`, `uuid-ossp`), Redis 7, Alembic.
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, TanStack Query v5, Lucide React.
- **Multi-Tenancy:** Shared database with `clinic_id` tenant isolation, application-level `with_loader_criteria` auto-filtering, and PostgreSQL Row-Level Security (RLS) support.
- **Security & RBAC:** Bcrypt password hashing, PyJWT (Access & Refresh tokens), role enforcement (`SUPER_ADMIN`, `CLINIC_ADMIN`, `DOCTOR`, `RECEPTIONIST`, `PATIENT`), and HIPAA/GDPR audit logging.
- **Infrastructure:** Docker & Docker Compose ready.

---

## 🚀 Quick Start with Docker Compose

To boot up the entire stack (PostgreSQL, Redis, FastAPI Backend, and Next.js Frontend):

```bash
docker-compose up --build
```

- **Frontend Application:** [http://localhost:3000](http://localhost:3000)
- **Waiting Room TV Board:** [http://localhost:3000/queue/display](http://localhost:3000/queue/display)
- **Interactive Swagger Docs:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Redoc Documentation:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## 📦 Running Locally for Development

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run migrations (PostgreSQL) or run dev server (auto SQLite / PostgreSQL fallback)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Automated Test Verification

Both Phase 2 (Core, RBAC, Slot Engine, Queue) and Phase 4 (EMR, PDF, Invoicing) test suites pass with 100% test coverage:

```bash
# Run Phase 2 Suite (Auth, Tenant Isolation, Slot Generation, Queue Token Progression)
python3 backend/tests/verify_phase2.py

# Run Phase 4 Suite (EMR Vitals, BMI Auto-calc, SOAP notes, E-Rx PDF & SHA-256, Invoicing)
python3 backend/tests/verify_phase4.py
```

---

## 🌟 Core Modules

### 1. Smart Appointment & Queue Engine
- **Slot Generation:** Calculates non-overlapping consultation windows by analyzing weekly doctor shifts (`DoctorSchedule`), subtracting intra-shift breaks (`DoctorBreak`), blacking out approved holidays (`DoctorLeave`), and filtering booked slots.
- **Double-Booking Prevention:** Enforces database-level PostgreSQL GIST Exclusion Constraints (`prevent_doctor_appointment_overlap`) paired with application-level pessimistic locking.
- **Real-Time Queue:** Manages token progressions (`WAITING` $\to$ `CALLED` $\to$ `WITH_DOCTOR` $\to$ `COMPLETED`) with TV monitor displays.

### 2. Electronic Medical Records (EMR) & E-Prescriptions
- **Triage Vitals:** Tracks BP, pulse, temperature, height, weight with live **BMI auto-calculation** ($BMI = \frac{weight}{(height/100)^2}$).
- **SOAP Notes:** Structured Subjective, Objective, Assessment, and Plan clinical documentation.
- **E-Prescriptions:** Generates tamper-proof digital prescriptions with itemized drug dosages, meal timings, **SHA-256 verification hashes**, and instant downloadable PDF / printable clinic letterheads.
- **QR Code Verification:** Public portal ([/verify-rx](http://localhost:3000/verify-rx)) allowing pharmacies to authenticate issued prescriptions without logging in.

### 3. Billing, Invoicing & Financial Desk
- **Itemized Invoices:** Auto-populates doctor consultation fees, diagnostic lab tests, procedures, and room charges.
- **Discounts & Tax:** Configurable percentage and flat discounts with automated tax computation.
- **Partial & Split Payments:** Supports multiple settlement channels (`CASH`, `CREDIT_CARD`, `MOBILE_BANKING`, `INSURANCE`) with automatic balance tracking.
- **Printable Receipts:** One-click official clinic receipts formatted for standard printers.

### 4. Executive Analytics
- Real-time gross revenue, collected revenue, outstanding balances, appointment completion rates, and doctor performance metrics.
