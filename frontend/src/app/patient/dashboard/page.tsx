"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Calendar,
  FileText,
  Clock,
  Heart,
  Droplet,
  ArrowRight,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  PlusCircle,
  Stethoscope,
  ExternalLink,
  ShieldCheck,
  Bed,
  MapPin,
  User,
  FlaskConical,
  CreditCard,
  HeartPulse,
  Sparkles,
  Star,
} from "lucide-react";
import { NurseRatingModal } from "@/components/nurse/nurse-rating-modal";

interface PatientProfileData {
  user: any;
  patient: {
    id: string;
    mrn: string;
    first_name: string;
    last_name: string;
    date_of_birth: string;
    gender: string;
    blood_group: string;
    email: string;
    phone: string;
    address_line?: string;
    allergies: string[];
    chronic_conditions: string[];
    notes?: string;
  } | null;
}

export default function PatientDashboardPage() {
  const { user, token } = useAuth();
  const [profileData, setProfileData] = useState<PatientProfileData | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [nurseBookings, setNurseBookings] = useState<any[]>([]);
  const [ratingTargetBooking, setRatingTargetBooking] = useState<any | null>(null);
  const [assignedUnit, setAssignedUnit] = useState<any | null>(null);
  const [billingSummary, setBillingSummary] = useState<{
    total_due_bdt: number;
    total_paid_bdt: number;
    total_invoices: number;
    has_due_bills: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch profile
        const profRes = await fetch(`/api/v1/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (profRes.ok) {
          const pData = await profRes.json();
          setProfileData(pData);
        }

        // Fetch appointments
        const apptRes = await fetch(`/api/v1/appointments?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (apptRes.ok) {
          const aData = await apptRes.json();
          setAppointments(aData);
        }

        // Fetch assigned hospital unit (bed/cabin)
        const unitRes = await fetch(`/api/v1/units/my-unit`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (unitRes.ok) {
          const uData = await unitRes.json();
          setAssignedUnit(uData);
        }

        // Fetch billing summary
        const billRes = await fetch(`/api/v1/invoices/my-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (billRes.ok) {
          const bData = await billRes.json();
          setBillingSummary(bData);
        }

        // Fetch nurse bookings
        const nurseRes = await fetch(`/api/v1/nurse-bookings/patient`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (nurseRes.ok) {
          const nData = await nurseRes.json();
          setNurseBookings(nData);
        }
      } catch (err) {
        console.error("Error loading patient dashboard data", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchData();
    }
  }, [token]);

  const p = profileData?.patient;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-sm border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Active Patient Portal
              </span>
              {p?.mrn && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-sans tabular-nums bg-white/10 text-slate-200 border border-white/15">
                  MRN: {p.mrn}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Hello, {user?.first_name || "Patient"} {user?.last_name || ""}!
            </h1>
            <p className="text-slate-300 text-sm max-w-xl">
              Access your medical consultations, schedule visits with certified doctors, and download verified digital prescriptions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/appointments/book"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Book Appointment</span>
            </Link>
            <Link
              href="/patient/profile"
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-sm border border-white/15 transition flex items-center gap-2"
            >
              <span>Edit Medical Profile</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Live Total Due Summary Card */}
      {billingSummary && (
        <div
          className={`p-5 rounded-3xl border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${billingSummary.total_due_bdt > 0
            ? "bg-rose-50/70 border-rose-200"
            : "bg-white border-slate-200"
            }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${billingSummary.total_due_bdt > 0
                ? "bg-rose-100 text-rose-700 border border-rose-200"
                : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                }`}
            >
              ৳
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${billingSummary.total_due_bdt > 0
                    ? "bg-rose-100 text-rose-800"
                    : "bg-emerald-100 text-emerald-800"
                    }`}
                >
                  {billingSummary.total_due_bdt > 0 ? "Outstanding Dues" : "Accounts Cleared"}
                </span>
                <span className="text-xs text-slate-600">
                  {billingSummary.total_invoices} total statement(s)
                </span>
              </div>
              <h3 className="text-base font-bold mt-1 text-slate-900">
                {billingSummary.total_due_bdt > 0
                  ? `You have an outstanding hospital balance of ৳${Number(billingSummary.total_due_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                  : "All hospital consultations & facility bills are completely settled"}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                {billingSummary.total_due_bdt > 0
                  ? "Payment can be completed at the hospital reception counter via Cash, bKash, or Card."
                  : `Total paid to date: ৳${Number(billingSummary.total_paid_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}. Download your receipts anytime.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/patient/bills"
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-xs ${billingSummary.total_due_bdt > 0
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{billingSummary.total_due_bdt > 0 ? "Review Bills & Settle" : "View Bills & Receipts"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Admitted Hospital Unit Card */}
      {assignedUnit && (
        <div className="bg-slate-900 p-6 rounded-3xl text-white border border-emerald-500/40 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Bed className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-slate-950 uppercase">
                  Admitted Facility
                </span>
                <span className="text-xs text-slate-300 font-sans tabular-nums">
                  Unit: {assignedUnit.unit_code}
                </span>
              </div>
              <h3 className="text-xl font-bold mt-1 text-white">
                {assignedUnit.unit_name} ({assignedUnit.category})
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Location: {assignedUnit.floor || "1st Floor"} • Attending: {assignedUnit.doctor_name || "Assigned Medical Specialist"}
              </p>
            </div>
          </div>

          <div className="text-left md:text-right bg-white/10 px-5 py-3 rounded-2xl border border-white/15">
            <div className="text-xs text-slate-300 font-semibold uppercase tracking-wider">Daily Bed/Cabin Rate</div>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums mt-0.5">
              ৳ {Number(assignedUnit.daily_price).toLocaleString()}
              <span className="text-xs text-slate-300 font-sans font-normal"> / day</span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">Transparent Clinical Billing</div>
          </div>
        </div>
      )}

      {/* Quick Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Blood Group */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Blood Group</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{p?.blood_group || "O+"}</p>
            <p className="text-xs text-slate-400 mt-0.5">Verified in EMR</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
            <Droplet className="w-6 h-6" />
          </div>
        </div>

        {/* Gender / Age */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gender / Demographics</p>
            <p className="text-xl font-bold text-slate-900 mt-1 capitalize">{p?.gender || "Male"}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              DOB: {p?.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : "Registered"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Total Appointments */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Consultations</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{appointments.length || 1}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Continuous Care</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Known Allergies */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Allergies Noted</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {p?.allergies && p.allergies.length > 0 ? p.allergies.length : "None"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {p?.allergies && p.allergies.length > 0 ? p.allergies.join(", ") : "No drug allergies"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
            <Heart className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Grid: Appointments & Quick Services */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Appointments list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">My Appointments</h2>
                <p className="text-xs text-slate-500">Scheduled visits, queue status, and doctor consultations</p>
              </div>
              <Link
                href="/dashboard/appointments/book"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>Book New</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {appointments.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Calendar className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                <h3 className="text-sm font-semibold text-slate-700">No appointments scheduled yet</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Book an in-person or follow-up consultation with our cardiology, general medicine, and specialist physicians.
                </p>
                <Link
                  href="/dashboard/appointments/book"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Schedule First Appointment</span>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {appointments.slice(0, 5).map((appt) => {
                  const docName = appt.doctor_name || "Doctor";
                  const cleanDocName = docName.replace(/^(Dr\.|Prof\.)\s*/i, "").trim();
                  const initials = cleanDocName
                    .split(" ")
                    .filter(Boolean)
                    .map((n: string) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "DR";
                  const specialty = appt.doctor_specialty || appt.doctor_specialization || "General Medicine";
                  const serialText = appt.serial_code || (appt.serial_number ? `Serial #${String(appt.serial_number).padStart(2, "0")}` : "Serial #01");
                  const isCompleted = appt.status === "COMPLETED";

                  return (
                    <div key={appt.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div className="flex items-start gap-3.5">
                        {/* Doctor Avatar / DP with Status Dot Indicator */}
                        <div className="relative shrink-0">
                          {appt.doctor_avatar ? (
                            <img
                              src={appt.doctor_avatar}
                              alt={docName}
                              className="w-12 h-12 rounded-full object-cover border-2 border-emerald-100 shadow-xs"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white font-bold text-sm flex items-center justify-center border-2 border-emerald-100 shadow-xs">
                              {initials}
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isCompleted
                              ? "bg-emerald-500"
                              : appt.status === "IN_CONSULTATION"
                                ? "bg-amber-500 animate-ping"
                                : appt.status === "CHECKED_IN"
                                  ? "bg-emerald-500"
                                  : "bg-emerald-500"
                              }`}
                            title={`Status: ${appt.status}`}
                          />
                        </div>

                        {/* Doctor Consultation Info */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition">
                              {docName}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {specialty}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs font-mono">
                              {serialText}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                            <span className="font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {appt.appointment_number || "APT-CONSULT"}
                            </span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(appt.start_time).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {new Date(appt.start_time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {appt.chamber_location && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                {appt.chamber_location}
                              </span>
                            )}
                          </div>

                          {appt.reason_for_visit && (
                            <p className="text-xs text-slate-500 italic mt-0.5">
                              &ldquo;{appt.reason_for_visit}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Status Pill & View Rx / Prescription Button */}
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${isCompleted
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : appt.status === "IN_CONSULTATION"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : appt.status === "CHECKED_IN"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}
                        >
                          {appt.status || "SCHEDULED"}
                        </span>

                        <Link
                          href="/dashboard/prescriptions"
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${isCompleted
                            ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>{isCompleted ? "View Rx" : "Prescription"}</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Home Care Nurse Bookings Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Home Care Nursing Visits</h2>
                  <p className="text-xs text-slate-500">Certified registered nurse visits to your residence in Dhaka</p>
                </div>
              </div>
              <Link
                href="/nurses"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>Book a Nurse</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {nurseBookings.length === 0 ? (
              <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50/70 to-slate-50 border border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Need In-Home Medical Care?</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-600 text-white">
                        On-Demand
                      </span>
                    </h4>
                    <p className="text-xs text-slate-600 max-w-lg">
                      Schedule verified, background-checked nurses for post-operative recovery, wound dressing, elderly companion care, and IV catheter support directly at your home.
                    </p>
                  </div>
                </div>
                <Link
                  href="/nurses"
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 shrink-0"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Find Home Care Nurse</span>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {nurseBookings.map((nb) => {
                  const isCompleted = nb.status === "Completed";
                  const isConfirmed = nb.status === "Confirmed";
                  const isPending = nb.status === "Pending";

                  return (
                    <div key={nb.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group">
                      <div className="flex items-start gap-3.5">
                        {nb.nurse_avatar ? (
                          <img
                            src={nb.nurse_avatar}
                            alt={nb.nurse_name || "Nurse"}
                            className="w-12 h-12 rounded-full object-cover border-2 border-emerald-100 shadow-xs shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 font-bold text-sm flex items-center justify-center border-2 border-emerald-200 shadow-xs shrink-0">
                            {nb.nurse_name ? nb.nurse_name.charAt(0) : "N"}
                          </div>
                        )}

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 transition">
                              {nb.nurse_name || "Assigned Nurse"}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              Home Care
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200 font-mono">
                              {nb.booking_code}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 pt-0.5">
                            <span className="flex items-center gap-1 text-slate-700 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                              {new Date(nb.service_date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {nb.shift_time}
                            </span>
                            <span className="flex items-center gap-1 text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" />
                              <span className="truncate max-w-[200px]">{nb.patient_address}</span>
                            </span>
                          </div>

                          {nb.care_notes && (
                            <p className="text-xs text-slate-500 italic mt-0.5">
                              &ldquo;{nb.care_notes}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                        <div className="text-right">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            ৳{Number(nb.fee_bdt || 0).toLocaleString()}
                          </div>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${nb.payment_status === "Paid"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                          >
                            {nb.payment_status || "Due"}
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${isCompleted
                            ? "bg-slate-100 text-slate-700 border border-slate-200"
                            : isConfirmed
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isPending
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                        >
                          {nb.status}
                        </span>

                        {nb.payment_status === "Due" && (
                          <Link
                            href="/patient/bills"
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
                          >
                            Pay ৳
                          </Link>
                        )}

                        {nb.payment_status === "Paid" && !nb.has_reviewed && (
                          <button
                            type="button"
                            onClick={() => setRatingTargetBooking(nb)}
                            style={{
                              backgroundColor: "var(--brand-button, #059669)",
                            }}
                            className="px-3 py-1.5 text-white hover:opacity-95 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition active:scale-95"
                          >
                            <Star className="w-3.5 h-3.5 fill-white" />
                            <span>Rate Nurse ★</span>
                          </button>
                        )}

                        {nb.has_reviewed && (
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                            <span>You rated ★ {Number(nb.submitted_rating || 5).toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Health Records & Prescriptions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Prescriptions & Medical Records</h2>
                <p className="text-xs text-slate-500">Official clinic letterhead prescriptions with QR verification</p>
              </div>
              <Link
                href="/dashboard/prescriptions"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Digital E-Prescription Portal</h4>
                  <p className="text-xs text-slate-500">
                    Instantly download and print your doctor's prescriptions with QR authenticity checks.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/prescriptions"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0"
              >
                <span>Open Prescriptions</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Diagnostic Lab Reports Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Diagnostic Lab Reports & Uploads</h2>
                <p className="text-xs text-slate-500">Pathology tests, blood counts, and outside diagnostic PDF documents</p>
              </div>
              <Link
                href="/patient/profile"
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <span>+ Upload / View</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Clinical Laboratory Reports</h4>
                  <p className="text-xs text-slate-500">
                    Access printable diagnostic reports and upload outside laboratory test PDFs for your consulting doctor.
                  </p>
                </div>
              </div>
              <Link
                href="/patient/profile"
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition shrink-0"
              >
                <span>Lab Reports & Uploads</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column (1 col): Patient Details & Hospital Care */}
        <div className="space-y-6">
          {/* Patient Baseline Details */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4">My Baseline Details</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Full Name</span>
                <span className="font-semibold text-slate-900">
                  {user?.first_name} {user?.last_name}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Phone Number</span>
                <span className="font-semibold text-slate-900">{user?.phone || p?.phone || "Not set"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Email Address</span>
                <span className="font-semibold text-slate-900">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Address</span>
                <span className="font-semibold text-slate-900">{p?.address_line || "Dhaka, Bangladesh"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Consultation Currency</span>
                <span className="font-semibold text-emerald-600">৳ BDT</span>
              </div>
            </div>

            <Link
              href="/patient/profile"
              className="mt-5 w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <span>Update Profile & Vitals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Quick Home Care Nursing CTA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Home Care Nursing</h4>
                <p className="text-[11px] text-slate-500">Certified nurses for home visits</p>
              </div>
            </div>
            <p className="text-xs text-slate-600">
              Need wound dressings, injections, or continuous vital care at home? Select certified nurses available in Dhanmondi, Gulshan, Uttara, and Mirpur.
            </p>
            <Link
              href="/nurses"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <span>Explore Nurses & Rates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Emergency Support Card */}
          <div className="bg-gradient-to-br from-rose-500 to-rose-700 text-white rounded-2xl p-6 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center mb-3">
              <PhoneCall className="w-5 h-5 text-white" />
            </div>
            <h4 className="text-base font-bold">Need Emergency Care?</h4>
            <p className="text-xs text-rose-100 mt-1">
              Our 24/7 ambulance, ICU, and trauma emergency units are ready to respond immediately.
            </p>
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
              <span className="text-xs font-medium text-rose-200">Emergency Hotline:</span>
              <span className="text-sm font-bold font-mono">+880 1711-001122</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Patient Nurse Rating Modal */}
      {ratingTargetBooking && (
        <NurseRatingModal
          bookingId={ratingTargetBooking.id}
          bookingCode={ratingTargetBooking.booking_code}
          nurseName={ratingTargetBooking.nurse_name}
          nurseAvatar={ratingTargetBooking.nurse_avatar}
          onClose={() => setRatingTargetBooking(null)}
          onSuccess={({ rating, comment }) => {
            setNurseBookings((prev) =>
              prev.map((item) =>
                item.id === ratingTargetBooking.id
                  ? {
                      ...item,
                      has_reviewed: true,
                      submitted_rating: rating,
                      submitted_comment: comment,
                    }
                  : item
              )
            );
          }}
        />
      )}
    </div>
  );
}
