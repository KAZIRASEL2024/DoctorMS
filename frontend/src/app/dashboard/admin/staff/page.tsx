"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { formatDoctorName } from "@/lib/utils";
import { BackButton } from "@/components/ui/back-button";
import { DoctorLeaveApprovalCard } from "@/components/admin/doctor-leave-approval-card";
import { CredentialsModal, UserCredentialsTarget } from "@/components/admin/credentials-modal";
import {
  Users,
  UserPlus,
  Mail,
  Phone,
  Shield,
  Stethoscope,
  CheckCircle,
  Search,
  Banknote,
  Edit3,
  Calendar,
  AlertCircle,
  Award,
  ToggleLeft,
  ToggleRight,
  Check,
  X,
  KeyRound,
} from "lucide-react";

interface StaffItem {
  id: string;
  user_id: string;
  clinic_id: string;
  email: string;
  phone?: string | null;
  first_name: string;
  last_name: string;
  role: "DOCTOR" | "SUPER_ADMIN" | "CLINIC_ADMIN" | "RECEPTIONIST" | "NURSE";
  designation?: string;
  department?: string;
  is_active: boolean;
  created_at: string;
  doctor_id?: string | null;
  specialization?: string | null;
  specialty?: string | null;
  qualifications?: string | null;
  degrees?: string | null;
  chamber_location?: string | null;
  visiting_days?: string | null;
  visiting_hours?: string | null;
  consultation_fee?: number | null;
  follow_up_fee?: number | null;
  is_available_for_booking?: boolean | null;
}

export default function AdminStaffPage() {
  const queryClient = useQueryClient();

  // Filter tab state
  const [filterRole, setFilterRole] = useState<"ALL" | "DOCTOR" | "NURSE" | "OTHER">("ALL");

  // Create Staff Modal State
  const [showModal, setShowModal] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("DOCTOR");
  const [designation, setDesignation] = useState("Specialist Physician");
  const [department, setDepartment] = useState("Cardiology");
  const [tempPassword, setTempPassword] = useState("Doc12345!");
  // Doctor & Nurse specific fields
  const [specialization, setSpecialization] = useState("Cardiology");
  const [consultationFee, setConsultationFee] = useState<number>(1000);
  const [followUpFee, setFollowUpFee] = useState<number>(500);
  const [qualifications, setQualifications] = useState("MBBS, MD");
  const [chamberLocation, setChamberLocation] = useState("Room 302, 3rd Floor, Main Building");
  const [visitingDays, setVisitingDays] = useState("Sat - Thu");
  const [visitingHours, setVisitingHours] = useState("5:00 PM - 9:00 PM");
  const [isAvailable, setIsAvailable] = useState(true);

  // Edit Doctor Fee Modal State
  const [editingStaff, setEditingStaff] = useState<StaffItem | null>(null);
  const [editConsultFee, setEditConsultFee] = useState<number>(1000);
  const [editFollowUpFee, setEditFollowUpFee] = useState<number>(500);
  const [editSpecialization, setEditSpecialization] = useState("");
  const [editQualifications, setEditQualifications] = useState("");
  const [editChamberLocation, setEditChamberLocation] = useState("");
  const [editVisitingDays, setEditVisitingDays] = useState("");
  const [editVisitingHours, setEditVisitingHours] = useState("");
  const [editAvailability, setEditAvailability] = useState(true);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  // Credentials Modal State
  const [credTarget, setCredTarget] = useState<UserCredentialsTarget | null>(null);
  const [showCredModal, setShowCredModal] = useState(false);

  const { data: staff = [], isLoading } = useQuery<StaffItem[]>({
    queryKey: ["clinic-staff"],
    queryFn: () => apiClient<StaffItem[]>("/clinics/staff"),
  });

  const addStaffMutation = useMutation({
    mutationFn: (data: any) =>
      apiClient("/clinics/staff", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-staff"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-slots"] });
      setShowModal(false);
      resetCreateForm();
    },
    onError: (err: any) => {
      alert("Failed to add staff: " + (err.message || "Unknown error"));
    },
  });

  const updateDoctorFeeMutation = useMutation({
    mutationFn: (data: { staffId: string; payload: any }) =>
      apiClient(`/clinics/staff/${data.staffId}/doctor-fee`, {
        method: "PUT",
        body: JSON.stringify(data.payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinic-staff"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-slots"] });
      setEditSuccessMsg("Doctor fees & clinical profile updated successfully!");
      setTimeout(() => {
        setEditingStaff(null);
        setEditSuccessMsg(null);
      }, 1200);
    },
    onError: (err: any) => {
      alert("Failed to update doctor fee: " + (err.message || "Unknown error"));
    },
  });

  const resetCreateForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRole("DOCTOR");
    setDesignation("Specialist Physician");
    setDepartment("Cardiology");
    setSpecialization("Cardiology");
    setConsultationFee(1000);
    setFollowUpFee(500);
    setQualifications("MBBS, MD");
    setChamberLocation("Room 302, 3rd Floor, Main Building");
    setVisitingDays("Sat - Thu");
    setVisitingHours("5:00 PM - 9:00 PM");
    setIsAvailable(true);
  };

  const handleRoleChange = (newRole: string) => {
    setRole(newRole);
    if (newRole === "NURSE") {
      setDesignation("Registered Home Care Nurse");
      setDepartment("Home Nursing");
      setSpecialization("Home Care Nursing");
      setQualifications("B.Sc in Nursing (DU), Certified Critical Care");
      setChamberLocation("Dhanmondi, Lalmatia, Mohammadpur");
      setConsultationFee(1500);
      setFollowUpFee(0);
      setVisitingDays("Daily Shifts");
      setVisitingHours("Morning / Evening / 24hr");
    } else if (newRole === "DOCTOR") {
      setDesignation("Specialist Physician");
      setDepartment("Cardiology");
      setSpecialization("Cardiology");
      setQualifications("MBBS, MD");
      setChamberLocation("Room 302, 3rd Floor, Main Building");
      setConsultationFee(1000);
      setFollowUpFee(500);
      setVisitingDays("Sat - Thu");
      setVisitingHours("5:00 PM - 9:00 PM");
    } else if (newRole === "LAB_ASSISTANT") {
      setDesignation("Medical Lab Technologist");
      setDepartment("Diagnostic Laboratory");
    } else {
      setDesignation("Staff Officer");
      setDepartment("Frontdesk");
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isDoc = role === "DOCTOR";
    const isNurse = role === "NURSE";

    addStaffMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      role,
      designation: designation || (isDoc ? "Consultant Physician" : (isNurse ? "Registered Home Care Nurse" : "Staff Officer")),
      department: isDoc ? (specialization || department) : (isNurse ? `Home Care (${chamberLocation || "Dhaka"})` : department),
      temporary_password: tempPassword,
      // Clinical fields for Doctor or Nurse
      specialization: isDoc ? (specialization || department) : (isNurse ? "Home Care Nursing" : undefined),
      specialty: isDoc ? (specialization || department) : (isNurse ? "Home Care Nursing" : undefined),
      consultation_fee: (isDoc || isNurse) ? Number(consultationFee) : undefined,
      follow_up_fee: isDoc ? Number(followUpFee) : (isNurse ? 0 : undefined),
      qualifications: (isDoc || isNurse) ? qualifications : undefined,
      degrees: (isDoc || isNurse) ? qualifications : undefined,
      chamber_location: (isDoc || isNurse) ? chamberLocation : undefined,
      visiting_days: isDoc ? visitingDays : (isNurse ? "Daily Shifts" : undefined),
      visiting_hours: isDoc ? visitingHours : (isNurse ? "Morning / Evening / 24hr" : undefined),
      is_available: (isDoc || isNurse) ? isAvailable : undefined,
    });
  };

  const openEditModal = (s: StaffItem) => {
    const isNurse = s.role === "NURSE";
    setEditingStaff(s);
    setEditConsultFee(s.consultation_fee ?? (isNurse ? 1500 : 1000));
    setEditFollowUpFee(s.follow_up_fee ?? 0);
    setEditSpecialization(s.specialization || s.specialty || s.department || (isNurse ? "Home Care Nursing" : "General Medicine"));
    setEditQualifications(s.degrees || s.qualifications || (isNurse ? "B.Sc in Nursing" : "MBBS, MD"));
    setEditChamberLocation(s.chamber_location || (isNurse ? "Dhanmondi, Dhaka" : "Room 101, Main Building"));
    setEditVisitingDays(s.visiting_days || "Sat - Thu");
    setEditVisitingHours(s.visiting_hours || "5:00 PM - 9:00 PM");
    setEditAvailability(s.is_available_for_booking ?? true);
    setEditSuccessMsg(null);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    updateDoctorFeeMutation.mutate({
      staffId: editingStaff.id,
      payload: {
        consultation_fee: Number(editConsultFee),
        follow_up_fee: Number(editFollowUpFee),
        specialization: editSpecialization,
        specialty: editSpecialization,
        qualifications: editQualifications,
        degrees: editQualifications,
        chamber_location: editChamberLocation,
        visiting_days: editVisitingDays,
        visiting_hours: editVisitingHours,
        is_available_for_booking: editAvailability,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard/admin" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-600" />
              Staff & Clinical Directory
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Manage clinic doctors, home care nurses, receptionists, consultation fees (৳ BDT), and assign booking availability.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            resetCreateForm();
            setShowModal(true);
          }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff / Doctor / Nurse</span>
        </button>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilterRole("ALL")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${filterRole === "ALL"
            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
        >
          All Staff ({staff.length})
        </button>
        <button
          onClick={() => setFilterRole("DOCTOR")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${filterRole === "DOCTOR"
            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
        >
          🩺 Doctors ({staff.filter((s) => s.role === "DOCTOR").length})
        </button>
        <button
          onClick={() => setFilterRole("NURSE")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${filterRole === "NURSE"
            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
        >
          👩‍⚕️ Home Care Nurses ({staff.filter((s) => s.role === "NURSE").length})
        </button>
        <button
          onClick={() => setFilterRole("OTHER")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition border ${filterRole === "OTHER"
            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
        >
          📋 Reception, Lab & Admins ({staff.filter((s) => s.role !== "DOCTOR" && s.role !== "NURSE").length})
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-slate-400">Loading clinic staff, doctors, and nurses...</div>
        ) : staff.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">No staff members enrolled yet.</div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[750px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Staff Member</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Role</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Department / Coverage</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Service Fee (৳)</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Follow-up / Rate</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Booking Status</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff
                  .filter((s) => {
                    if (filterRole === "DOCTOR") return s.role === "DOCTOR";
                    if (filterRole === "NURSE") return s.role === "NURSE";
                    if (filterRole === "OTHER") return s.role !== "DOCTOR" && s.role !== "NURSE";
                    return true;
                  })
                  .map((s) => {
                    const isDoctor = s.role === "DOCTOR";
                    const isNurse = s.role === "NURSE";
                    const displayName = isDoctor
                      ? formatDoctorName(s.first_name, s.last_name)
                      : isNurse
                        ? (s.first_name.startsWith("Nurse") ? `${s.first_name} ${s.last_name}` : `Nurse ${s.first_name} ${s.last_name}`)
                        : `${s.first_name} ${s.last_name}`;

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name & Contact */}
                        <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-xs">
                          <div className="font-semibold text-slate-900">{displayName}</div>
                          <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                            <span>{s.email}</span>
                            {s.phone && <span>• {s.phone}</span>}
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${isDoctor
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : isNurse
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                              }`}
                          >
                            {isDoctor && <Stethoscope className="w-3 h-3" />}
                            {isNurse && <span>👩‍⚕️</span>}
                            {s.role}
                          </span>
                        </td>

                        {/* Department / Spec / Area */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">
                            {isNurse
                              ? (s.chamber_location || s.department || "Home Care Nursing")
                              : (s.specialization || s.department || "General")}
                          </div>
                          <div className="text-xs text-slate-600">{s.designation || s.qualifications || "-"}</div>
                        </td>

                        {/* Consult / Shift Fee */}
                        <td className="py-3.5 px-4">
                          {isDoctor ? (
                            <span className="tabular-nums font-semibold text-emerald-700">
                              ৳{Number(s.consultation_fee ?? 1000).toFixed(2)}
                            </span>
                          ) : isNurse ? (
                            <span className="tabular-nums font-semibold text-emerald-700">
                              ৳{Number(s.consultation_fee ?? 1500).toFixed(2)}
                              <span className="text-[10px] text-slate-600 font-sans font-normal"> / shift</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Follow-up Fee / Rate */}
                        <td className="py-3.5 px-4">
                          {isDoctor ? (
                            <span className="tabular-nums text-slate-700 font-medium">
                              ৳{Number(s.follow_up_fee ?? 500).toFixed(2)}
                            </span>
                          ) : isNurse ? (
                            <span className="text-xs text-slate-600">Flat Visit</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {isDoctor || isNurse ? (
                            s.is_available_for_booking !== false ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Bookable
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Unavailable
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">
                              Active
                            </span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setCredTarget({
                                  userId: s.user_id,
                                  name: displayName,
                                  email: s.email,
                                  role: s.role,
                                  identifier: s.designation || undefined,
                                });
                                setShowCredModal(true);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition"
                              title="Manage Email & Reset Password"
                            >
                              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Credentials</span>
                            </button>
                            {(isDoctor || isNurse) && (
                              <button
                                onClick={() => openEditModal(s)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                              >
                                <span className="font-bold text-emerald-700 text-xs">৳</span>
                                <span>{isNurse ? "Edit Fee & Area" : "Edit Fee & Spec"}</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Doctor Leave Requests Approval Section */}
      <DoctorLeaveApprovalCard />

      {/* 1. ADD STAFF / DOCTOR MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Add Staff / Doctor Profile</h3>
                <p className="text-xs text-slate-500">
                  {role === "DOCTOR"
                    ? "Enrolls doctor into staff directory and auto-generates clinical booking profile."
                    : "Creates staff account with role permissions."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Kazi"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Rasel"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Role & Designation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Staff Role *</label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="DOCTOR">🩺 Doctor (Consultant)</option>
                    <option value="NURSE">👩‍⚕️ Home Care Nurse</option>
                    <option value="LAB_ASSISTANT">🔬 Lab Assistant</option>
                    <option value="RECEPTIONIST">📋 Receptionist</option>
                    <option value="CLINIC_ADMIN">🛡️ Clinic Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation Title</label>
                  <input
                    type="text"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    placeholder={role === "DOCTOR" ? "e.g. Senior Consultant" : role === "NURSE" ? "e.g. Registered Nurse" : "e.g. Frontdesk Officer"}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* DYNAMIC FIELDS SPECIFIC TO NURSE */}
              {role === "NURSE" && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    <span>👩‍⚕️</span>
                    <span>Home Care Nurse Coverage & Shift Rate</span>
                  </div>

                  {/* Coverage Location & Quick Area Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Service Coverage Area (Dhaka) *
                      </label>
                      <span className="text-[10px] text-slate-400">Quick select areas</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {["Dhanmondi", "Gulshan", "Uttara", "Mirpur", "Banani", "Mohammadpur", "Bashundhara"].map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setChamberLocation(loc)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${chamberLocation.includes(loc)
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      required
                      value={chamberLocation}
                      onChange={(e) => setChamberLocation(e.target.value)}
                      placeholder="e.g. Dhanmondi, Lalmatia, Mohammadpur"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  {/* Nursing Qualifications */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nursing Education & Qualifications *
                    </label>
                    <input
                      type="text"
                      required
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. B.Sc in Nursing (DU), Certified Critical Care"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Shift Rate (৳ BDT) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Shift Service Fee (৳ BDT / Session) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        required
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(Number(e.target.value))}
                        className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Standard home nursing shift rate charged to the patient
                    </span>
                  </div>
                </div>
              )}

              {/* DYNAMIC FIELDS SPECIFIC TO DOCTOR */}
              {role === "DOCTOR" && (
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    <Stethoscope className="w-4 h-4 text-emerald-600" />
                    <span>Doctor Clinical Settings, Chamber & Schedule</span>
                  </div>

                  {/* Specialty Category & Quick Picker */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Specialty Category *
                      </label>
                      <span className="text-[10px] text-slate-400">Used for homepage filter pills</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {["Cardiology", "Medicine", "Gynecology", "Orthopedics", "Pediatrics", "Neurology", "Dermatology", "ENT", "General Surgery"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setSpecialization(cat);
                            setDepartment(cat);
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${specialization === cat
                            ? "bg-emerald-600 text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                            }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      required
                      value={specialization}
                      onChange={(e) => {
                        setSpecialization(e.target.value);
                        setDepartment(e.target.value);
                      }}
                      placeholder="e.g. Cardiology / Internal Medicine / Pediatrics"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  {/* Degrees & Qualifications */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Degrees & Qualifications *
                    </label>
                    <input
                      type="text"
                      required
                      value={qualifications}
                      onChange={(e) => setQualifications(e.target.value)}
                      placeholder="e.g. MBBS, FCPS (Medicine), MD, MRCP (UK)"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Chamber Location */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chamber / Room Location (Where they sit) *
                    </label>
                    <input
                      type="text"
                      required
                      value={chamberLocation}
                      onChange={(e) => setChamberLocation(e.target.value)}
                      placeholder="e.g. Room 302, 3rd Floor, Diagnostic Complex"
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Visiting Days & Visiting Hours */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Visiting Days *
                      </label>
                      <input
                        type="text"
                        required
                        value={visitingDays}
                        onChange={(e) => setVisitingDays(e.target.value)}
                        placeholder="e.g. Sat - Thu / Daily except Friday"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Visiting Hours *
                      </label>
                      <input
                        type="text"
                        required
                        value={visitingHours}
                        onChange={(e) => setVisitingHours(e.target.value)}
                        placeholder="e.g. 5:00 PM - 9:00 PM"
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Consultation Fee & Follow-up Fee */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Consultation Fee (৳ BDT) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          required
                          value={consultationFee}
                          onChange={(e) => setConsultationFee(Number(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Follow-up Fee (৳ BDT) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          required
                          value={followUpFee}
                          onChange={(e) => setFollowUpFee(Number(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Availability */}
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={isAvailable}
                      onChange={(e) => setIsAvailable(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Enable for live online appointment booking immediately
                    </span>
                  </label>
                </div>
              )}

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@metrohealth.com"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1..."
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Temporary Password */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Temporary Password *
                </label>
                <input
                  type="password"
                  required
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addStaffMutation.isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {addStaffMutation.isPending ? "Enrolling..." : "Enroll Staff & Doctor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT DOCTOR / NURSE FEE & PROFILE MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {editingStaff.role === "NURSE" ? "Edit Nurse Care Fee & Coverage Area" : "Edit Clinical Fees & Roster"}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingStaff.role === "NURSE"
                    ? (editingStaff.first_name.startsWith("Nurse") ? `${editingStaff.first_name} ${editingStaff.last_name}` : `Nurse ${editingStaff.first_name} ${editingStaff.last_name}`)
                    : formatDoctorName(editingStaff.first_name, editingStaff.last_name)} • {editingStaff.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{editSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {editingStaff.role === "NURSE" ? (
                <>
                  {/* Nurse Coverage Area */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Service Coverage Area (Dhaka) *
                    </label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {["Dhanmondi", "Gulshan", "Uttara", "Mirpur", "Banani", "Mohammadpur", "Bashundhara"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setEditChamberLocation(cat)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${editChamberLocation.includes(cat)
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      required
                      value={editChamberLocation}
                      onChange={(e) => setEditChamberLocation(e.target.value)}
                      placeholder="e.g. Dhanmondi, Lalmatia, Mohammadpur"
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  {/* Nurse Qualifications */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nursing Education & Qualifications *
                    </label>
                    <input
                      type="text"
                      required
                      value={editQualifications}
                      onChange={(e) => setEditQualifications(e.target.value)}
                      placeholder="e.g. B.Sc in Nursing (DU), Critical Care"
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Nurse Shift Fee */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Shift Service Fee (৳ BDT) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        required
                        value={editConsultFee}
                        onChange={(e) => setEditConsultFee(Number(e.target.value))}
                        className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Specialty Category *
                    </label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {["Cardiology", "Medicine", "Gynecology", "Orthopedics", "Pediatrics", "Neurology", "Dermatology", "ENT", "General Surgery"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setEditSpecialization(cat)}
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${editSpecialization === cat
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      required
                      value={editSpecialization}
                      onChange={(e) => setEditSpecialization(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Degrees & Qualifications *
                    </label>
                    <input
                      type="text"
                      required
                      value={editQualifications}
                      onChange={(e) => setEditQualifications(e.target.value)}
                      placeholder="e.g. MBBS, FCPS, MD, MRCP"
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Chamber / Room Location (Where they sit) *
                    </label>
                    <input
                      type="text"
                      required
                      value={editChamberLocation}
                      onChange={(e) => setEditChamberLocation(e.target.value)}
                      placeholder="e.g. Room 302, 3rd Floor, Diagnostic Complex"
                      className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Visiting Days *
                      </label>
                      <input
                        type="text"
                        required
                        value={editVisitingDays}
                        onChange={(e) => setEditVisitingDays(e.target.value)}
                        placeholder="e.g. Sat - Thu"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Visiting Hours *
                      </label>
                      <input
                        type="text"
                        required
                        value={editVisitingHours}
                        onChange={(e) => setEditVisitingHours(e.target.value)}
                        placeholder="e.g. 5:00 PM - 9:00 PM"
                        className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Consultation Fee (৳) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          required
                          value={editConsultFee}
                          onChange={(e) => setEditConsultFee(Number(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Follow-up Fee (৳) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                        <input
                          type="number"
                          min="0"
                          step="50"
                          required
                          value={editFollowUpFee}
                          onChange={(e) => setEditFollowUpFee(Number(e.target.value))}
                          className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Availability Toggle */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    {editingStaff.role === "NURSE" ? "Home Care Visit Status" : "Online Slot Booking Status"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {editingStaff.role === "NURSE"
                      ? (editAvailability ? "Nurse listed in public directory & taking home care visits" : "Nurse paused from taking new bookings")
                      : (editAvailability ? "Doctor appears in Patient Booking wizard" : "Doctor hidden from new bookings")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditAvailability(!editAvailability)}
                  className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${editAvailability
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-300 text-slate-700"
                    }`}
                >
                  {editAvailability ? "Bookable" : "Paused"}
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateDoctorFeeMutation.isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {updateDoctorFeeMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Super Admin Credentials (Email & Password) Modal */}
      <CredentialsModal
        isOpen={showCredModal}
        onClose={() => {
          setShowCredModal(false);
          setCredTarget(null);
        }}
        target={credTarget}
      />
    </div>
  );
}
