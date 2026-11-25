"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Appointment } from "@/types";
import {
  Stethoscope,
  Users,
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  Activity,
  ArrowRight,
  Search,
  Plus,
  Trash2,
  Heart,
  Thermometer,
  Bed,
  AlertCircle,
  X,
  Printer,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface MedicationItem {
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  meal_timing: "BEFORE_MEAL" | "AFTER_MEAL" | "WITH_MEAL" | "BEDTIME" | "EMPTY_STOMACH";
  instructions: string;
}

export default function DoctorDashboard() {
  const queryClient = useQueryClient();

  // Filter and search state
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "TODAY" | "SCHEDULED" | "CHECKED_IN" | "IN_CONSULTATION" | "COMPLETED">("ACTIVE");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Consultation state
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isConsultModalOpen, setIsConsultModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successBanner, setSuccessBanner] = useState<{ message: string; rxCode?: string; rxId?: string } | null>(null);

  // Form states for Consultation / Rx
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [bedAssignment, setBedAssignment] = useState<"OPD" | "BED" | "CABIN" | "ICU" | "CCU">("OPD");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [temperature, setTemperature] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [spo2, setSpo2] = useState("");
  const [generalAdvice, setGeneralAdvice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [medicines, setMedicines] = useState<MedicationItem[]>([
    {
      medicine_name: "Tab. Napa Extra (Paracetamol 500mg + Caffeine 65mg)",
      dosage: "1 Tablet",
      frequency: "1-0-1",
      duration: "5 Days",
      meal_timing: "AFTER_MEAL",
      instructions: "Take after food with plenty of water",
    },
  ]);

  // Fetch all appointments for the logged-in doctor
  const { data: allAppointments = [], refetch, isLoading } = useQuery({
    queryKey: ["doctor-appointments"],
    queryFn: () => apiClient<Appointment[]>("/appointments"),
    refetchInterval: 5000,
  });

  // Fetch hospital units for ward/cabin disposition assignment
  const { data: hospitalUnits = [] } = useQuery<any[]>({
    queryKey: ["hospital-units"],
    queryFn: () => apiClient<any[]>("/units"),
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAppointments = allAppointments.filter((a) => a.start_time?.startsWith(todayStr));
  const completedToday = todayAppointments.filter((a) => a.status === "COMPLETED").length;
  const waitingInQueue = allAppointments.filter(
    (a) => a.status === "SCHEDULED" || a.status === "PENDING" || a.status === "CHECKED_IN" || a.status === "IN_CONSULTATION"
  ).length;

  const inConsultationPatient = allAppointments.find((a) => a.status === "IN_CONSULTATION");
  const nextWaitingPatient = allAppointments.find((a) => a.status === "CHECKED_IN" || a.status === "SCHEDULED");

  // Open Consultation Modal
  const openConsultation = async (appt: Appointment) => {
    setSelectedAppointment(appt);
    setSymptoms(appt.reason_for_visit || "");
    setDiagnosis("");
    setBedAssignment("OPD");
    setBpSystolic("120");
    setBpDiastolic("80");
    setPulse("74");
    setTemperature("98.6");
    setWeightKg("68");
    setHeightCm("172");
    setSpo2("98");
    setGeneralAdvice("Rest adequately, drink plenty of fluids, and take medications as directed.");
    
    // Set follow up date to 7 days later
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    setFollowUpDate(futureDate.toISOString().split("T")[0]);

    setMedicines([
      {
        medicine_name: "Tab. Napa Extra (Paracetamol 500mg)",
        dosage: "1 Tablet",
        frequency: "1-0-1",
        duration: "5 Days",
        meal_timing: "AFTER_MEAL",
        instructions: "Take after meals",
      },
    ]);

    // Update appointment status to IN_CONSULTATION if it is still SCHEDULED or CHECKED_IN
    if (appt.status !== "IN_CONSULTATION" && appt.status !== "COMPLETED") {
      try {
        await apiClient(`/appointments/${appt.id}/status`, {
          method: "PATCH",
          params: { new_status: "IN_CONSULTATION" },
        });
        refetch();
      } catch (err) {
        console.error("Failed to update status to IN_CONSULTATION", err);
      }
    }

    setIsConsultModalOpen(true);
  };

  // Medicine items handlers
  const addMedicineRow = () => {
    setMedicines([
      ...medicines,
      {
        medicine_name: "",
        dosage: "1 Tablet",
        frequency: "1-0-1",
        duration: "5 Days",
        meal_timing: "AFTER_MEAL",
        instructions: "Take after meals",
      },
    ]);
  };

  const removeMedicineRow = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const updateMedicine = (index: number, field: keyof MedicationItem, val: string) => {
    const updated = [...medicines];
    updated[index] = { ...updated[index], [field]: val };
    setMedicines(updated);
  };

  // Save Consultation & Digital Prescription
  const handleSaveAndReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setIsSaving(true);
    try {
      const payload = {
        appointment_id: selectedAppointment.id,
        symptoms: symptoms || selectedAppointment.reason_for_visit || "Routine consultation",
        diagnosis: diagnosis || "Clinical evaluation completed",
        bed_assignment: bedAssignment,
        vitals: {
          blood_pressure_systolic: bpSystolic ? Number(bpSystolic) : null,
          blood_pressure_diastolic: bpDiastolic ? Number(bpDiastolic) : null,
          heart_rate_bpm: pulse ? Number(pulse) : null,
          temperature_f: temperature ? Number(temperature) : null,
          weight_kg: weightKg ? Number(weightKg) : null,
          height_cm: heightCm ? Number(heightCm) : null,
          spo2_percent: spo2 ? Number(spo2) : null,
        },
        general_advice: generalAdvice,
        follow_up_date: followUpDate || null,
        items: medicines
          .filter((m) => m.medicine_name.trim().length > 0)
          .map((m) => ({
            medicine_name: m.medicine_name.trim(),
            dosage: m.dosage || "1 Tablet",
            frequency: m.frequency || "1-0-1",
            duration: m.duration || "5 Days",
            meal_timing: m.meal_timing || "AFTER_MEAL",
            instructions: m.instructions || "",
          })),
      };

      const result = await apiClient<any>("/prescriptions/consultation", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // If doctor selected a specific hospital unit, assign it to patient
      if (selectedUnitId && selectedAppointment.patient_id) {
        try {
          await apiClient(`/units/${selectedUnitId}/assign`, {
            method: "POST",
            body: JSON.stringify({
              patient_id: selectedAppointment.patient_id,
              doctor_id: selectedAppointment.doctor_id,
              notes: `Admitted during consultation for ${diagnosis || symptoms || "clinical treatment"}`,
            }),
          });
          queryClient.invalidateQueries({ queryKey: ["hospital-units"] });
        } catch (unitErr) {
          console.error("Failed to auto-assign unit", unitErr);
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-live-queue"] });
      queryClient.invalidateQueries({ queryKey: ["prescriptions-list"] });
      refetch();

      setIsConsultModalOpen(false);
      setSuccessBanner({
        message: `Treatment completed & prescription issued for ${selectedAppointment.patient_name || selectedAppointment.patient?.first_name || "Patient"}!`,
        rxCode: result.prescription_code,
        rxId: result.id,
      });

      // Auto-dismiss banner after 8s
      setTimeout(() => setSuccessBanner(null), 8000);
    } catch (err: any) {
      alert(`Error saving treatment: ${err.message || "Failed to submit prescription"}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered Appointments
  const filteredAppointments = allAppointments.filter((appt) => {
    // Tab filter
    if (activeTab === "ACTIVE") {
      if (appt.status === "COMPLETED" || appt.status === "CANCELLED") return false;
    } else if (activeTab === "TODAY") {
      if (!appt.start_time?.startsWith(todayStr)) return false;
    } else if (activeTab === "SCHEDULED") {
      if (appt.status !== "SCHEDULED" && appt.status !== "PENDING") return false;
    } else if (activeTab === "CHECKED_IN") {
      if (appt.status !== "CHECKED_IN") return false;
    } else if (activeTab === "IN_CONSULTATION") {
      if (appt.status !== "IN_CONSULTATION") return false;
    } else if (activeTab === "COMPLETED") {
      if (appt.status !== "COMPLETED") return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const pName = (appt.patient_name || `${appt.patient?.first_name || ""} ${appt.patient?.last_name || ""}`).toLowerCase();
      const pMrn = (appt.patient_mrn || appt.patient?.mrn || "").toLowerCase();
      const pPhone = (appt.patient_phone || appt.patient?.phone || "").toLowerCase();
      const reason = (appt.reason_for_visit || "").toLowerCase();
      const num = (appt.appointment_number || "").toLowerCase();
      return pName.includes(q) || pMrn.includes(q) || pPhone.includes(q) || reason.includes(q) || num.includes(q);
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between text-emerald-800 animate-fadeIn">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold">{successBanner.message}</p>
              {successBanner.rxCode && (
                <p className="text-xs text-emerald-700">
                  Prescription Code: <span className="font-mono font-bold">{successBanner.rxCode}</span> (Digital RX visible in patient portal)
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {successBanner.rxId && (
              <button
                type="button"
                onClick={() => {
                  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
                  window.open(`/api/v1/prescriptions/${successBanner.rxId}/print-html?token=${token || ""}`, "_blank");
                }}
                className="px-3 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print A4 Rx</span>
              </button>
            )}
            <Link
              href="/dashboard/prescriptions"
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
            >
              View in Prescriptions
            </Link>
            <button
              onClick={() => setSuccessBanner(null)}
              className="p-1 text-emerald-600 hover:text-emerald-800 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Clinical Practice Portal
          </span>
          <h1 className="text-2xl font-bold mt-1">Doctor Consultation Workspace</h1>
          <p className="text-xs text-slate-300 mt-1">
            Review appointments, record vitals, write electronic prescriptions, and assign hospital wards/cabins in real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/units"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-2 transition"
          >
            <Bed className="w-4 h-4" /> Hospital Units (Bed/Cabin/ICU/CCU)
          </Link>
          <Link
            href="/dashboard/prescriptions"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition flex items-center gap-2"
          >
            <FileText className="w-4 h-4" /> All Prescriptions
          </Link>
          <Link
            href="/dashboard/doctor/schedule"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition"
          >
            Manage Shifts
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Waiting in Queue</span>
            <div className="text-3xl font-bold text-slate-900 mt-1">{waitingInQueue}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Scheduled, checked-in & active</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Consulted Today</span>
            <div className="text-3xl font-bold text-slate-900 mt-1">{completedToday}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Completed consultations</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Today</span>
            <div className="text-3xl font-bold text-slate-900 mt-1">{todayAppointments.length}</div>
            <p className="text-[11px] text-slate-400 mt-0.5">Booked for today</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Current Active Consultation Spotlight */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            Current Patient In Consultation
          </h2>
          {inConsultationPatient && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> LIVE SESSION
            </span>
          )}
        </div>

        {inConsultationPatient ? (
          <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded">
                  {inConsultationPatient.appointment_number}
                </span>
                {inConsultationPatient.serial_code && (
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded">
                    {inConsultationPatient.serial_code}
                  </span>
                )}
                <span className="text-xs font-mono bg-white border border-emerald-200 text-slate-600 px-2 py-0.5 rounded">
                  MRN: {inConsultationPatient.patient_mrn || inConsultationPatient.patient?.mrn || "N/A"}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900">
                {inConsultationPatient.patient_name || `${inConsultationPatient.patient?.first_name || ""} ${inConsultationPatient.patient?.last_name || ""}`.trim() || "Patient"}
              </h3>
              <p className="text-xs text-slate-600 flex items-center gap-3">
                <span>Age: {inConsultationPatient.patient_age || "N/A"}</span>
                <span>•</span>
                <span>Gender: {inConsultationPatient.patient_gender || inConsultationPatient.patient?.gender || "N/A"}</span>
                <span>•</span>
                <span>Phone: {inConsultationPatient.patient_phone || inConsultationPatient.patient?.phone || "N/A"}</span>
              </p>
              {inConsultationPatient.reason_for_visit && (
                <p className="text-xs text-emerald-800 bg-emerald-100/60 px-3 py-1.5 rounded-lg inline-block">
                  <span className="font-semibold">Reason:</span> {inConsultationPatient.reason_for_visit}
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => openConsultation(inConsultationPatient)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition"
              >
                <Stethoscope className="w-4 h-4" /> Open Treatment & Prescription <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : nextWaitingPatient ? (
          <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 bg-amber-50/50 rounded-xl border border-amber-100">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
                  Next Up in Queue
                </span>
                {nextWaitingPatient.serial_code && (
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded">
                    {nextWaitingPatient.serial_code}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {nextWaitingPatient.patient_name || `${nextWaitingPatient.patient?.first_name || ""} ${nextWaitingPatient.patient?.last_name || ""}`.trim() || "Patient"}
              </h3>
              <p className="text-xs text-slate-600">
                MRN: {nextWaitingPatient.patient_mrn || nextWaitingPatient.patient?.mrn || "N/A"} • Time:{" "}
                {new Date(nextWaitingPatient.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
              {nextWaitingPatient.reason_for_visit && (
                <p className="text-xs text-slate-500">Complaint: {nextWaitingPatient.reason_for_visit}</p>
              )}
            </div>
            <div>
              <button
                onClick={() => openConsultation(nextWaitingPatient)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition"
              >
                <Stethoscope className="w-4 h-4" /> Call Patient & Write Treatment
              </button>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-slate-400 text-sm">
            No patient currently waiting in queue. New bookings will automatically appear here.
          </div>
        )}
      </div>

      {/* Appointments Queue Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Header & Controls */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              Today's & Upcoming Patient Queue
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and consult patients assigned to your schedule
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, MRN, phone..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveTab("ACTIVE")}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === "ACTIVE" ? "bg-white text-emerald-600 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                Active ({waitingInQueue})
              </button>
              <button
                onClick={() => setActiveTab("TODAY")}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === "TODAY" ? "bg-white text-emerald-600 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                Today ({todayAppointments.length})
              </button>
              <button
                onClick={() => setActiveTab("CHECKED_IN")}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === "CHECKED_IN" ? "bg-white text-emerald-600 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                Checked-In
              </button>
              <button
                onClick={() => setActiveTab("COMPLETED")}
                className={`px-3 py-1 rounded-md transition ${
                  activeTab === "COMPLETED" ? "bg-white text-emerald-600 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                Completed ({completedToday})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading appointment queue...</div>
        ) : filteredAppointments.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            No appointments match the selected filter.
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[750px] w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Patient Information</th>
                  <th className="py-3 px-4 whitespace-nowrap">Schedule / Slot</th>
                  <th className="py-3 px-4 whitespace-nowrap">Reason / Complaint</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.map((appt) => {
                  const pName = appt.patient_name || `${appt.patient?.first_name || ""} ${appt.patient?.last_name || ""}`.trim() || "Patient";
                  const initials = pName.split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase() || "P";
                  const slotDate = new Date(appt.start_time);
                  const isToday = appt.start_time?.startsWith(todayStr);

                  return (
                    <tr key={appt.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-xs">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                              <span>{pName}</span>
                              {appt.serial_code && (
                                <span className="font-mono text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-1.5 py-0.2 rounded-full">
                                  {appt.serial_code}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="font-mono bg-slate-100 px-1.5 py-0.2 rounded text-slate-700">
                                {appt.patient_mrn || appt.patient?.mrn || "MRN-N/A"}
                              </span>
                              <span>•</span>
                              <span>{appt.patient_gender || appt.patient?.gender || "Unknown"}</span>
                              {appt.patient_age && (
                                <>
                                  <span>•</span>
                                  <span>{appt.patient_age} yrs</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{appt.patient_phone || appt.patient?.phone || "No phone"}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-800">
                          {isToday ? "Today" : slotDate.toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {slotDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-[200px] truncate">
                        <span className="text-slate-700">{appt.reason_for_visit || "General Checkup"}</span>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{appt.appointment_number}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {appt.status === "IN_CONSULTATION" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                            In Consultation
                          </span>
                        ) : appt.status === "CHECKED_IN" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                            Checked-In
                          </span>
                        ) : appt.status === "COMPLETED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Consulted
                          </span>
                        ) : appt.status === "CANCELLED" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                            Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
                            Scheduled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {appt.status === "COMPLETED" ? (
                          <Link
                            href="/dashboard/prescriptions"
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition inline-flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Rx
                          </Link>
                        ) : (
                          <button
                            onClick={() => openConsultation(appt)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs shadow-xs transition inline-flex items-center gap-1.5"
                          >
                            <Stethoscope className="w-3.5 h-3.5" /> Consult & Write Treatment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive "Write Treatment & Return to Patient" Modal */}
      {isConsultModalOpen && selectedAppointment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-[94vw] max-w-4xl max-h-[88vh] flex flex-col border border-slate-200 overflow-hidden my-auto animate-fadeIn">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-800 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Clinical Encounter & Prescription
                  </span>
                  <span className="bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded text-[11px] font-mono">
                    {selectedAppointment.appointment_number}
                  </span>
                </div>
                <h3 className="text-lg font-bold mt-1">
                  Patient: {selectedAppointment.patient_name || `${selectedAppointment.patient?.first_name || ""} ${selectedAppointment.patient?.last_name || ""}`.trim() || "Patient"}
                </h3>
                <div className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                  <span>MRN: {selectedAppointment.patient_mrn || selectedAppointment.patient?.mrn || "N/A"}</span>
                  <span>•</span>
                  <span>Age: {selectedAppointment.patient_age || "N/A"}</span>
                  <span>•</span>
                  <span>Gender: {selectedAppointment.patient_gender || selectedAppointment.patient?.gender || "N/A"}</span>
                  <span>•</span>
                  <span>Phone: {selectedAppointment.patient_phone || selectedAppointment.patient?.phone || "N/A"}</span>
                </div>
              </div>

              <button
                onClick={() => setIsConsultModalOpen(false)}
                className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveAndReturn} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Section 1: Vitals Signs */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-600" /> Patient Vitals Recorded
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">BP Systolic</label>
                    <input
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      placeholder="120"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">BP Diastolic</label>
                    <input
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      placeholder="80"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                      placeholder="72"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Temp (°F)</label>
                    <input
                      type="text"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      placeholder="98.6"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Weight (kg)</label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="68"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">Height (cm)</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="170"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600">SpO2 (%)</label>
                    <input
                      type="number"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      placeholder="98"
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Clinical Symptoms & Diagnosis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Symptoms / Chief Complaints
                  </label>
                  <textarea
                    rows={2}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="e.g. Mild fever, dry cough for 3 days, headache"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Clinical Diagnosis / Assessment <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="e.g. Acute Viral Upper Respiratory Infection, Mild Hypertension"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Section 3: Facility / Bed / Admission Selector */}
              <div className="space-y-3 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Patient Disposition & Facility Assignment
                  </label>
                  <Link
                    href="/dashboard/units"
                    target="_blank"
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 transition"
                  >
                    <Bed className="w-3.5 h-3.5" />
                    <span>View Ward Layout Grid (Free/Booked) ↗</span>
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {[
                    { key: "OPD", label: "Outpatient (OPD)", icon: "🩺", desc: "Discharge & Home Treatment" },
                    { key: "BED", label: "General Ward Bed", icon: "🛏️", desc: "Standard Ward Admission" },
                    { key: "CABIN", label: "Private Cabin", icon: "🚪", desc: "Single / Deluxe Room" },
                    { key: "ICU", label: "Intensive Care (ICU)", icon: "🚨", desc: "Critical Monitoring" },
                    { key: "CCU", label: "Coronary Care (CCU)", icon: "💓", desc: "Cardiac Special Unit" },
                  ].map((fac) => (
                    <button
                      key={fac.key}
                      type="button"
                      onClick={() => {
                        setBedAssignment(fac.key as any);
                        if (fac.key === "OPD") setSelectedUnitId("");
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        bedAssignment === fac.key
                          ? "bg-emerald-50 border-emerald-600 text-emerald-900 ring-2 ring-emerald-500/30"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <div className="text-xl mb-1">{fac.icon}</div>
                      <div>
                        <div className="text-xs font-bold">{fac.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{fac.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>

                {bedAssignment !== "OPD" && (
                  <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex-1">
                      <label className="font-semibold text-slate-700 block mb-1">
                        Select Specific Available ({bedAssignment}) Unit:
                      </label>
                      <select
                        value={selectedUnitId}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 font-medium"
                      >
                        <option value="">-- Auto / Any Available {bedAssignment} --</option>
                        {hospitalUnits
                          .filter((u) => {
                            const cat = (u.category || "").toLowerCase();
                            const b = bedAssignment.toLowerCase();
                            if (b === "bed") return cat.includes("bed");
                            if (b === "cabin") return cat.includes("cabin");
                            if (b === "icu") return cat.includes("icu");
                            if (b === "ccu") return cat.includes("ccu");
                            return true;
                          })
                          .map((u) => (
                            <option
                              key={u.id}
                              value={u.id}
                              disabled={u.status === "BOOKED"}
                            >
                              {u.unit_code} - {u.unit_name} ({u.floor || "1st Floor"}) | ৳ {Number(u.daily_price).toLocaleString()}/day {u.status === "BOOKED" ? "[BOOKED]" : "[FREE]"}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 4: Dynamic Medicines / Prescription Builder */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-emerald-600" /> Prescribed Medications (E-Rx)
                  </h4>
                  <button
                    type="button"
                    onClick={addMedicineRow}
                    className="px-3 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Medicine
                  </button>
                </div>

                <div className="space-y-2.5">
                  {medicines.map((med, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center"
                    >
                      <div className="md:col-span-4">
                        <label className="text-[10px] font-semibold text-slate-500">Medicine Name & Strength</label>
                        <input
                          type="text"
                          required
                          value={med.medicine_name}
                          onChange={(e) => updateMedicine(idx, "medicine_name", e.target.value)}
                          placeholder="e.g. Tab. Azithromycin 500mg"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500">Dosage</label>
                        <input
                          type="text"
                          value={med.dosage}
                          onChange={(e) => updateMedicine(idx, "dosage", e.target.value)}
                          placeholder="1 Tablet"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500">Frequency</label>
                        <input
                          type="text"
                          value={med.frequency}
                          onChange={(e) => updateMedicine(idx, "frequency", e.target.value)}
                          placeholder="1-0-1"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500">Duration</label>
                        <input
                          type="text"
                          value={med.duration}
                          onChange={(e) => updateMedicine(idx, "duration", e.target.value)}
                          placeholder="5 Days"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] font-semibold text-slate-500">Meal Timing</label>
                          <select
                            value={med.meal_timing}
                            onChange={(e) => updateMedicine(idx, "meal_timing", e.target.value as any)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                          >
                            <option value="AFTER_MEAL">After Meal</option>
                            <option value="BEFORE_MEAL">Before Meal</option>
                            <option value="WITH_MEAL">With Meal</option>
                            <option value="BEDTIME">Bedtime</option>
                            <option value="EMPTY_STOMACH">Empty Stomach</option>
                          </select>
                        </div>
                        {medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMedicineRow(idx)}
                            className="mt-4 p-1.5 text-slate-400 hover:text-rose-500 rounded transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 5: General Advice & Follow-Up */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Special Advice & Instructions
                  </label>
                  <textarea
                    rows={2}
                    value={generalAdvice}
                    onChange={(e) => setGeneralAdvice(e.target.value)}
                    placeholder="e.g. Rest for 3 days, drink plenty of fluids, avoid cold exposure."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Follow-Up Date</label>
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Recommended checkup after course completion</p>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsConsultModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-600 hover:from-emerald-700 hover:to-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-2 transition disabled:opacity-50"
                >
                  {isSaving ? (
                    "Finalizing & Saving..."
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" /> Save & Return to Patient
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
