"use client";

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DoctorProfile, Patient, AvailableSlotsResponse, TimeSlot } from "@/types";
import { formatDoctorName } from "@/lib/utils";
import {
  User,
  Calendar,
  Clock,
  Stethoscope,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Heart,
  ShieldAlert,
  FileText,
  UserCheck,
  Search,
  X,
  Sparkles,
  ArrowRight,
  Activity,
  AlertTriangle,
} from "lucide-react";

interface FormState {
  patientId: string;
  mrn: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  // Medical History
  chronicConditions: string;
  currentMedications: string;
  allergies: string;
  notes: string;
  // Emergency Contact
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  // Doctor & Schedule
  doctorId: string;
  appointmentDate: string;
  selectedSlot: TimeSlot | null;
  visitType: string;
  reasonForVisit: string;
  internalNotes: string;
}

const initialFormState: FormState = {
  patientId: "",
  mrn: "",
  firstName: "",
  middleName: "",
  lastName: "",
  gender: "MALE",
  dateOfBirth: "",
  bloodGroup: "UNKNOWN",
  phone: "",
  email: "",
  address: "",
  chronicConditions: "",
  currentMedications: "",
  allergies: "",
  notes: "",
  emergencyContactName: "",
  emergencyContactRelation: "Spouse",
  emergencyContactPhone: "",
  doctorId: "",
  appointmentDate: new Date().toISOString().split("T")[0],
  selectedSlot: null,
  visitType: "NEW_CONSULTATION",
  reasonForVisit: "",
  internalNotes: "",
};

export const AdminBookingForm: React.FC = () => {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<FormState>(initialFormState);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState<string>("");

  // 1. Fetch Doctors
  const { data: rawDoctors = [], isLoading: loadingDoctors } = useQuery<any>({
    queryKey: ["doctors"],
    queryFn: () => apiClient<any>("/doctors"),
  });

  const doctorsList: DoctorProfile[] = useMemo(() => {
    if (Array.isArray(rawDoctors)) return rawDoctors;
    if (Array.isArray(rawDoctors?.data)) return rawDoctors.data;
    if (Array.isArray(rawDoctors?.items)) return rawDoctors.items;
    return [];
  }, [rawDoctors]);

  // 2. Fetch Patients for Lookup
  const { data: rawPatients = [], isLoading: loadingPatients } = useQuery<any>({
    queryKey: ["patients-lookup", patientSearch],
    queryFn: () => apiClient<any>("/patients?limit=100"),
  });

  const patientsList: Patient[] = useMemo(() => {
    if (Array.isArray(rawPatients)) return rawPatients;
    if (Array.isArray(rawPatients?.data)) return rawPatients.data;
    if (Array.isArray(rawPatients?.items)) return rawPatients.items;
    return [];
  }, [rawPatients]);

  // Filtered patients for dropdown search
  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patientsList.slice(0, 20);
    const q = patientSearch.toLowerCase();
    return patientsList.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      const mrn = (p.mrn || "").toLowerCase();
      const phone = (p.phone || "").toLowerCase();
      return name.includes(q) || mrn.includes(q) || phone.includes(q);
    });
  }, [patientsList, patientSearch]);

  // Selected Doctor Object
  const selectedDoctor = useMemo(() => {
    return doctorsList.find((d) => d.id === form.doctorId) || null;
  }, [doctorsList, form.doctorId]);

  // Check if doctor is on approved leave for the chosen appointment date
  const doctorLeaveOnDate = useMemo(() => {
    if (!selectedDoctor || !form.appointmentDate || !selectedDoctor.confirmed_leaves) return null;
    return selectedDoctor.confirmed_leaves.find((l) => {
      return (
        l.status === "APPROVED" &&
        form.appointmentDate >= l.start_date &&
        form.appointmentDate <= l.end_date
      );
    });
  }, [selectedDoctor, form.appointmentDate]);

  // 3. Fetch Slots for selected Doctor and Date
  const { data: slotsData, isLoading: loadingSlots } = useQuery<AvailableSlotsResponse>({
    queryKey: ["doctor-slots", form.doctorId, form.appointmentDate],
    queryFn: () =>
      apiClient<AvailableSlotsResponse>(`/doctors/${form.doctorId}/slots`, {
        params: { date: form.appointmentDate },
      }),
    enabled: !!form.doctorId && !!form.appointmentDate && !doctorLeaveOnDate,
  });

  const availableSlots: TimeSlot[] = useMemo(() => {
    return slotsData?.slots || [];
  }, [slotsData]);

  // Field validation logic
  const validateField = (field: string, value: any, currentForm: FormState = form): string => {
    switch (field) {
      case "firstName":
        if (!value || !value.trim()) return "First name is required";
        if (value.trim().length < 2) return "First name must be at least 2 characters";
        return "";

      case "lastName":
        if (!value || !value.trim()) return "Last name is required";
        if (value.trim().length < 2) return "Last name must be at least 2 characters";
        return "";

      case "gender":
        if (!value) return "Gender is required";
        return "";

      case "dateOfBirth":
        if (!value) return "Date of birth is required";
        if (new Date(value) > new Date()) return "Date of birth cannot be a future date";
        return "";

      case "phone": {
        const clean = (value || "").replace(/[\s-]/g, "");
        if (!clean) return "Mobile number is required";
        if (!/^\d+$/.test(clean)) return "Phone number must contain digits only";
        if (clean.length < 8 || clean.length > 15) {
          return "Phone number must be 8–11 digits (e.g., 017XXXXXXXX)";
        }
        return "";
      }

      case "email":
        if (value && value.trim()) {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value.trim())) {
            return "Please enter a valid email address (e.g., name@domain.com)";
          }
        }
        return "";

      case "address":
        if (!value || !value.trim()) return "Address is required";
        return "";

      case "emergencyContactName":
        if (!value || !value.trim()) return "Emergency contact name is required";
        return "";

      case "emergencyContactRelation":
        if (!value || !value.trim()) return "Relationship is required";
        return "";

      case "emergencyContactPhone": {
        const clean = (value || "").replace(/[\s-]/g, "");
        if (!clean) return "Emergency contact phone is required";
        if (!/^\d+$/.test(clean)) return "Emergency phone must contain digits only";
        if (clean.length < 8 || clean.length > 15) {
          return "Phone number must be 8–11 digits (e.g., 017XXXXXXXX)";
        }
        return "";
      }

      case "doctorId":
        if (!value) return "Please select a consulting doctor";
        return "";

      case "appointmentDate": {
        if (!value) return "Appointment date is required";
        const today = new Date().toISOString().split("T")[0];
        if (value < today) return "Cannot schedule appointment in the past";
        return "";
      }

      case "selectedSlot":
        if (!value) return "Please select an appointment time slot";
        return "";

      case "reasonForVisit":
        if (!value || !value.trim()) return "Chief complaint / reason for visit is required";
        return "";

      default:
        return "";
    }
  };

  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, (form as any)[field], form);
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  const handleChange = (field: keyof FormState, value: any) => {
    const updated = { ...form, [field]: value };
    setForm(updated);
    if (touched[field]) {
      const errorMsg = validateField(field, value, updated);
      setErrors((prev) => ({ ...prev, [field]: errorMsg }));
    }
  };

  // Auto-fill from Existing Patient
  const handleSelectExistingPatient = (patient: Patient) => {
    const allergiesStr = Array.isArray(patient.allergies) ? patient.allergies.join(", ") : "";
    const chronicStr = Array.isArray(patient.chronic_conditions)
      ? patient.chronic_conditions.join(", ")
      : "";

    setForm((prev) => ({
      ...prev,
      patientId: patient.id,
      mrn: patient.mrn,
      firstName: patient.first_name,
      middleName: "",
      lastName: patient.last_name,
      gender: patient.gender || "MALE",
      dateOfBirth: patient.date_of_birth ? patient.date_of_birth.split("T")[0] : "",
      bloodGroup: patient.blood_group || "UNKNOWN",
      phone: patient.phone,
      email: patient.email || "",
      address: patient.address_line || "",
      emergencyContactName: patient.emergency_contact_name || "",
      emergencyContactRelation: (patient as any).emergency_contact_relation || "Spouse",
      emergencyContactPhone: patient.emergency_contact_phone || "",
      chronicConditions: chronicStr,
      allergies: allergiesStr,
      notes: patient.notes || "",
    }));

    // Clear patient validation errors
    setErrors((prev) => ({
      ...prev,
      firstName: "",
      lastName: "",
      gender: "",
      dateOfBirth: "",
      phone: "",
      email: "",
      address: "",
      emergencyContactName: "",
      emergencyContactRelation: "",
      emergencyContactPhone: "",
    }));
  };

  const handleClearPatient = () => {
    setForm((prev) => ({
      ...prev,
      patientId: "",
      mrn: "",
      firstName: "",
      middleName: "",
      lastName: "",
      gender: "MALE",
      dateOfBirth: "",
      bloodGroup: "UNKNOWN",
      phone: "",
      email: "",
      address: "",
      chronicConditions: "",
      currentMedications: "",
      allergies: "",
      notes: "",
      emergencyContactName: "",
      emergencyContactRelation: "Spouse",
      emergencyContactPhone: "",
    }));
  };

  // Submit Mutation
  const bookMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient<any>("/appointments/admin-book", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      setBookingSuccess(data);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["clinical-patients"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-slots"] });
    },
    onError: (err: any) => {
      setServerError(
        err.message || "Failed to book appointment. Please verify details and try another slot."
      );
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // Validate all required fields
    const fieldsToValidate: (keyof FormState | "selectedSlot")[] = [
      "firstName",
      "lastName",
      "gender",
      "dateOfBirth",
      "phone",
      "email",
      "address",
      "emergencyContactName",
      "emergencyContactRelation",
      "emergencyContactPhone",
      "doctorId",
      "appointmentDate",
      "selectedSlot",
      "reasonForVisit",
    ];

    const newErrors: Record<string, string> = {};
    const newTouched: Record<string, boolean> = {};
    let firstErrorField: string | null = null;

    fieldsToValidate.forEach((f) => {
      newTouched[f] = true;
      const error = validateField(f, (form as any)[f], form);
      if (error) {
        newErrors[f] = error;
        if (!firstErrorField) firstErrorField = f;
      }
    });

    setTouched((prev) => ({ ...prev, ...newTouched }));
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      if (firstErrorField) {
        const el = document.getElementById(`field-${firstErrorField}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }
      return;
    }

    if (doctorLeaveOnDate) {
      setServerError(
        `Selected doctor is on approved leave from ${doctorLeaveOnDate.start_date} to ${doctorLeaveOnDate.end_date}. Booking on this date is restricted.`
      );
      return;
    }

    if (!form.selectedSlot) {
      setErrors((prev) => ({ ...prev, selectedSlot: "Please select an appointment time slot" }));
      return;
    }

    // Split allergies and chronic conditions into arrays
    const allergiesList = form.allergies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const chronicList = form.chronicConditions
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      patient_id: form.patientId || null,
      mrn: form.mrn || null,
      first_name: form.firstName.trim(),
      middle_name: form.middleName ? form.middleName.trim() : null,
      last_name: form.lastName.trim(),
      gender: form.gender,
      date_of_birth: form.dateOfBirth,
      blood_group: form.bloodGroup,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address_line: form.address.trim(),
      chronic_conditions: chronicList,
      current_medications: form.currentMedications.trim() || null,
      allergies: allergiesList,
      notes: form.notes.trim() || null,
      emergency_contact_name: form.emergencyContactName.trim(),
      emergency_contact_relation: form.emergencyContactRelation.trim(),
      emergency_contact_phone: form.emergencyContactPhone.trim(),
      doctor_id: form.doctorId,
      appointment_date: form.appointmentDate,
      start_time: form.selectedSlot.start_time,
      end_time: form.selectedSlot.end_time,
      visit_type: form.visitType,
      reason_for_visit: form.reasonForVisit.trim(),
      internal_notes: form.internalNotes.trim() || null,
    };

    bookMutation.mutate(payload);
  };

  // SUCCESS CONFIRMATION MODAL / BANNER
  if (bookingSuccess) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-3xl mx-auto shadow-sm text-center space-y-6 animate-in fade-in zoom-in-95">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
          <CheckCircle2 className="w-9 h-9" />
        </div>

        <div>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full uppercase tracking-wider">
            Booking Confirmed
          </span>
          <h2 className="text-2xl font-bold text-slate-900 mt-2">
            Appointment Successfully Registered
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            The consultation has been added to the doctor’s schedule and live queue token has been provisioned.
          </p>
        </div>

        {/* Confirmation Details Card */}
        <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-left grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">
              Appointment Reference
            </span>
            <span className="text-sm font-mono font-bold text-slate-900">
              {bookingSuccess.appointment_number}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">
              Assigned Queue Serial
            </span>
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
              {bookingSuccess.serial_code || `Serial #${bookingSuccess.serial_number || 1}`}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">
              Patient Name & MRN
            </span>
            <span className="text-sm font-semibold text-slate-900 block">
              {bookingSuccess.patient_name}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              MRN: {bookingSuccess.patient_mrn || "N/A"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">
              Consulting Physician
            </span>
            <span className="text-sm font-semibold text-slate-900 block">
              {bookingSuccess.doctor_name}
            </span>
            <span className="text-[11px] text-slate-500">
              {bookingSuccess.doctor_specialty || "Specialist"}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">
              Consultation Schedule
            </span>
            <span className="text-xs font-semibold text-slate-800">
              {bookingSuccess.start_time
                ? new Date(bookingSuccess.start_time).toLocaleDateString(undefined, {
                    weekday: "short",
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "Today"}
            </span>
            <span className="text-[11px] text-slate-500 block">
              {bookingSuccess.start_time
                ? new Date(bookingSuccess.start_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}{" "}
              -{" "}
              {bookingSuccess.end_time
                ? new Date(bookingSuccess.end_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : ""}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px] font-semibold uppercase">
              Chamber Location
            </span>
            <span className="text-xs font-semibold text-slate-800">
              {bookingSuccess.chamber_location || "Room 101, Main Building"}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              setBookingSuccess(null);
              setForm(initialFormState);
              setTouched({});
              setErrors({});
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            + Book Another Appointment
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/appointments")}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-1.5"
          >
            <span>Go to Appointments Desk</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {serverError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-bold">Booking Request Failed</h4>
            <p className="mt-0.5">{serverError}</p>
          </div>
          <button
            type="button"
            onClick={() => setServerError(null)}
            className="text-rose-500 hover:text-rose-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: Patient Information */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <User className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Section 1: Patient Information
              </h2>
              <p className="text-[11px] text-slate-500">
                Walk-in patient registration or quick lookup from existing records.
              </p>
            </div>
          </div>

          {/* Quick Lookup Indicator */}
          {form.mrn ? (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Matched: {form.mrn}</span>
              </span>
              <button
                type="button"
                onClick={handleClearPatient}
                className="text-[11px] text-slate-500 hover:text-rose-600 underline font-medium"
              >
                Clear / New Walk-in
              </button>
            </div>
          ) : (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[11px] font-medium self-start sm:self-auto">
              New Walk-in Registration
            </span>
          )}
        </div>

        {/* Existing Patient Search Selector Dropdown */}
        <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-xl space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 block">
            Existing Patient MRN / ID Lookup (Optional)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="relative sm:col-span-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search MRN / Name..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="sm:col-span-2">
              <select
                value={form.patientId}
                onChange={(e) => {
                  const pid = e.target.value;
                  if (!pid) {
                    handleClearPatient();
                  } else {
                    const match = patientsList.find((p) => p.id === pid);
                    if (match) handleSelectExistingPatient(match);
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose Existing Patient (Auto-fills Form) --</option>
                {filteredPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.mrn} • {p.first_name} {p.last_name} • {p.phone}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Selecting an existing patient automatically populates contact, demographic, and medical baseline details.
          </p>
        </div>

        {/* Name Fields Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              First Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-firstName"
              type="text"
              placeholder="e.g. Tanvir"
              value={form.firstName}
              onChange={(e) => handleChange("firstName", e.target.value)}
              onBlur={() => handleBlur("firstName")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.firstName && errors.firstName
                  ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            />
            {touched.firstName && errors.firstName && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.firstName}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Middle Name <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="field-middleName"
              type="text"
              placeholder="e.g. Hossain"
              value={form.middleName}
              onChange={(e) => handleChange("middleName", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Last Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-lastName"
              type="text"
              placeholder="e.g. Hasan"
              value={form.lastName}
              onChange={(e) => handleChange("lastName", e.target.value)}
              onBlur={() => handleBlur("lastName")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.lastName && errors.lastName
                  ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            />
            {touched.lastName && errors.lastName && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.lastName}</span>
              </p>
            )}
          </div>
        </div>

        {/* Demographics: Gender, DOB, Blood Group */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Gender <span className="text-rose-500">*</span>
            </label>
            <select
              id="field-gender"
              value={form.gender}
              onChange={(e) => handleChange("gender", e.target.value)}
              onBlur={() => handleBlur("gender")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.gender && errors.gender
                  ? "border-rose-400 focus:ring-rose-400"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            >
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
            {touched.gender && errors.gender && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.gender}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Date of Birth <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-dateOfBirth"
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={form.dateOfBirth}
              onChange={(e) => handleChange("dateOfBirth", e.target.value)}
              onBlur={() => handleBlur("dateOfBirth")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.dateOfBirth && errors.dateOfBirth
                  ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            />
            {touched.dateOfBirth && errors.dateOfBirth && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.dateOfBirth}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Blood Group
            </label>
            <select
              id="field-bloodGroup"
              value={form.bloodGroup}
              onChange={(e) => handleChange("bloodGroup", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="UNKNOWN">Unknown</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>
        </div>

        {/* Contact Info: Mobile Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Mobile Number (8–11 Digits) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                id="field-phone"
                type="tel"
                placeholder="017XXXXXXXX"
                value={form.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                onBlur={() => handleBlur("phone")}
                className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 font-mono ${
                  touched.phone && errors.phone
                    ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:ring-emerald-500"
                }`}
              />
            </div>
            {touched.phone && errors.phone && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.phone}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Email Address <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                id="field-email"
                type="email"
                placeholder="patient@example.com"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => handleBlur("email")}
                className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                  touched.email && errors.email
                    ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:ring-emerald-500"
                }`}
              />
            </div>
            {touched.email && errors.email && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.email}</span>
              </p>
            )}
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">
            Residential Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <textarea
              id="field-address"
              rows={2}
              placeholder="e.g. House #14, Road #5, Dhanmondi, Dhaka"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              onBlur={() => handleBlur("address")}
              className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.address && errors.address
                  ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            />
          </div>
          {touched.address && errors.address && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{errors.address}</span>
            </p>
          )}
        </div>
      </div>

      {/* SECTION 2: Medical History & Vitals Baseline */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Heart className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Section 2: Medical History & Vitals Baseline
            </h2>
            <p className="text-[11px] text-slate-500">
              Baseline clinical notes, known drug sensitivities, and existing chronic conditions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Existing Chronic Conditions
            </label>
            <input
              type="text"
              placeholder="e.g. Hypertension, Type 2 Diabetes"
              value={form.chronicConditions}
              onChange={(e) => handleChange("chronicConditions", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Separate multiple items with commas</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Current Medications
            </label>
            <input
              type="text"
              placeholder="e.g. Metformin 500mg, Losartan 50mg"
              value={form.currentMedications}
              onChange={(e) => handleChange("currentMedications", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Allergies & Drug Sensitivities
            </label>
            <input
              type="text"
              placeholder="e.g. Penicillin, Peanuts, Dust"
              value={form.allergies}
              onChange={(e) => handleChange("allergies", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Previous Surgeries / Clinical Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Appendectomy in 2021"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Emergency Contact */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <ShieldAlert className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Section 3: Emergency Contact
            </h2>
            <p className="text-[11px] text-slate-500">
              Primary attendant or next-of-kin for clinical updates and immediate notifications.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Contact Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-emergencyContactName"
              type="text"
              placeholder="e.g. Nasreen Akter"
              value={form.emergencyContactName}
              onChange={(e) => handleChange("emergencyContactName", e.target.value)}
              onBlur={() => handleBlur("emergencyContactName")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.emergencyContactName && errors.emergencyContactName
                  ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            />
            {touched.emergencyContactName && errors.emergencyContactName && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.emergencyContactName}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Relationship <span className="text-rose-500">*</span>
            </label>
            <select
              id="field-emergencyContactRelation"
              value={form.emergencyContactRelation}
              onChange={(e) => handleChange("emergencyContactRelation", e.target.value)}
              onBlur={() => handleBlur("emergencyContactRelation")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.emergencyContactRelation && errors.emergencyContactRelation
                  ? "border-rose-400 focus:ring-rose-400"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            >
              <option value="Spouse">Spouse</option>
              <option value="Parent">Parent</option>
              <option value="Sibling">Sibling</option>
              <option value="Child">Child</option>
              <option value="Relative">Relative</option>
              <option value="Friend">Friend</option>
              <option value="Other">Other</option>
            </select>
            {touched.emergencyContactRelation && errors.emergencyContactRelation && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.emergencyContactRelation}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Emergency Phone (8–11 Digits) <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-emergencyContactPhone"
              type="tel"
              placeholder="018XXXXXXXX"
              value={form.emergencyContactPhone}
              onChange={(e) => handleChange("emergencyContactPhone", e.target.value)}
              onBlur={() => handleBlur("emergencyContactPhone")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 font-mono ${
                touched.emergencyContactPhone && errors.emergencyContactPhone
                  ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            />
            {touched.emergencyContactPhone && errors.emergencyContactPhone && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.emergencyContactPhone}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: Doctor & Appointment Schedule */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Stethoscope className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Section 4: Doctor & Appointment Schedule
            </h2>
            <p className="text-[11px] text-slate-500">
              Select physician, conflict-free consultation slot, and appointment type.
            </p>
          </div>
        </div>

        {/* Doctor Selection Grid / Dropdown */}
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            Select Consulting Doctor <span className="text-rose-500">*</span>
          </label>
          <div
            id="field-doctorId"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1"
          >
            {loadingDoctors ? (
              <p className="text-xs text-slate-400 col-span-full py-4 text-center">
                Loading available specialists...
              </p>
            ) : doctorsList.length === 0 ? (
              <p className="text-xs text-slate-400 col-span-full py-4 text-center">
                No active doctors found in clinic roster.
              </p>
            ) : (
              doctorsList.map((doc) => {
                const isSelected = form.doctorId === doc.id;
                const formattedName = formatDoctorName(doc.first_name, doc.last_name);
                const isAvailable = doc.is_available_for_booking !== false;
                const activeLeave = doc.confirmed_leaves?.find(
                  (l) => l.status === "APPROVED" && form.appointmentDate >= l.start_date && form.appointmentDate <= l.end_date
                );
                const hasLeave = !!activeLeave;

                return (
                  <button
                    key={doc.id}
                    type="button"
                    disabled={hasLeave}
                    onClick={() => {
                      handleChange("doctorId", doc.id);
                      handleChange("selectedSlot", null);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                      isSelected
                        ? "bg-emerald-50/70 border-emerald-500 shadow-xs"
                        : hasLeave
                        ? "bg-slate-50/80 border-slate-200 opacity-60 cursor-not-allowed"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {formattedName}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-slate-700 shrink-0">
                          ৳{Number(doc.consultation_fee).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-700 font-medium truncate">
                        {doc.specialization}
                      </div>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                      {hasLeave ? (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>On Leave ({activeLeave.start_date.substring(5)} - {activeLeave.end_date.substring(5)})</span>
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{doc.current_status || "Available"}</span>
                        </span>
                      )}
                      <span className="text-slate-400 truncate max-w-[100px]">
                        {doc.visiting_hours || "Evening"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          {touched.doctorId && errors.doctorId && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{errors.doctorId}</span>
            </p>
          )}
        </div>

        {/* Doctor Leave Warning Banner */}
        {doctorLeaveOnDate && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Doctor is on Confirmed Leave</span>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Dr. {selectedDoctor?.first_name} {selectedDoctor?.last_name} has approved leave from{" "}
                <strong>{doctorLeaveOnDate.start_date}</strong> to{" "}
                <strong>{doctorLeaveOnDate.end_date}</strong>. Please select another date.
              </p>
            </div>
          </div>
        )}

        {/* Appointment Date, Visit Type & Slots */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Appointment Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
              <input
                id="field-appointmentDate"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={form.appointmentDate}
                onChange={(e) => {
                  handleChange("appointmentDate", e.target.value);
                  handleChange("selectedSlot", null);
                }}
                onBlur={() => handleBlur("appointmentDate")}
                className={`w-full pl-8 pr-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                  touched.appointmentDate && errors.appointmentDate
                    ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:ring-emerald-500"
                }`}
              />
            </div>
            {touched.appointmentDate && errors.appointmentDate && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.appointmentDate}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Visit Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChange("visitType", "NEW_CONSULTATION")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                  form.visitType === "NEW_CONSULTATION"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                New Consultation
              </button>
              <button
                type="button"
                onClick={() => handleChange("visitType", "FOLLOW_UP")}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                  form.visitType === "FOLLOW_UP"
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Follow-up Visit
              </button>
            </div>
          </div>
        </div>

        {/* Time Slot Chips Grid */}
        <div id="field-selectedSlot">
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            Available Time Slot <span className="text-rose-500">*</span>
          </label>
          {!form.doctorId ? (
            <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg">
              Please select a doctor to view their schedule slots.
            </p>
          ) : doctorLeaveOnDate ? (
            <p className="text-xs text-amber-700 font-medium p-3 bg-amber-50 rounded-lg">
              Slots are unavailable on approved leave dates.
            </p>
          ) : loadingSlots ? (
            <p className="text-xs text-slate-500 p-3 bg-slate-50 rounded-lg animate-pulse">
              Checking real-time doctor availability and existing appointments...
            </p>
          ) : availableSlots.length === 0 ? (
            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
              No available slots found for this date. The doctor may be off duty or fully booked.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {availableSlots.map((slot, idx) => {
                const isSelected =
                  form.selectedSlot?.start_time === slot.start_time &&
                  form.selectedSlot?.end_time === slot.end_time;
                const timeLabel = new Date(slot.start_time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={!slot.is_available}
                    onClick={() => {
                      handleChange("selectedSlot", slot);
                      setErrors((prev) => ({ ...prev, selectedSlot: "" }));
                    }}
                    className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1 ${
                      isSelected
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : slot.is_available
                        ? "bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40"
                        : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through"
                    }`}
                  >
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{timeLabel}</span>
                  </button>
                );
              })}
            </div>
          )}
          {touched.selectedSlot && errors.selectedSlot && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{errors.selectedSlot}</span>
            </p>
          )}
        </div>

        {/* Reason for Visit & Internal Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Chief Complaint / Reason for Visit <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-reasonForVisit"
              type="text"
              placeholder="e.g. Chest tightness, routine blood pressure review"
              value={form.reasonForVisit}
              onChange={(e) => handleChange("reasonForVisit", e.target.value)}
              onBlur={() => handleBlur("reasonForVisit")}
              className={`w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border transition focus:outline-none focus:ring-2 ${
                touched.reasonForVisit && errors.reasonForVisit
                  ? "border-rose-400 focus:ring-rose-400 bg-rose-50/20"
                  : "border-slate-200 focus:ring-emerald-500"
              }`}
            />
            {touched.reasonForVisit && errors.reasonForVisit && (
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.reasonForVisit}</span>
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Internal Front-Desk Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              id="field-internalNotes"
              type="text"
              placeholder="e.g. VIP patient, requires wheelchair assistance"
              value={form.internalNotes}
              onChange={(e) => handleChange("internalNotes", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-slate-800 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* FORM ACTION CONTROLS */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/dashboard/appointments")}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={bookMutation.isPending || !!doctorLeaveOnDate}
          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {bookMutation.isPending ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing & Booking...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Register Appointment</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
