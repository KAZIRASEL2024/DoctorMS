"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { DoctorProfile, Patient, AvailableSlotsResponse, TimeSlot } from "@/types";
import { formatDoctorName } from "@/lib/utils";
import {
  Calendar as CalendarIcon,
  Clock,
  User as UserIcon,
  CheckCircle,
  AlertCircle,
  Search,
  ArrowRight,
  ChevronLeft,
  ShieldCheck,
  Stethoscope,
  Activity,
  CreditCard,
} from "lucide-react";

export const BookingWizard: React.FC = () => {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const doctorIdParam = searchParams.get("doctorId");
  const { user, token } = useAuth();
  const isPatientUser = user?.system_role === "PATIENT";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorProfile | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [reasonForVisit, setReasonForVisit] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // 1. Fetch Doctors (Supports direct array, { data: [] }, or { items: [] })
  const {
    data: rawDoctors,
    isLoading: loadingDoctors,
    error: doctorsError,
  } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => apiClient<any>("/doctors"),
  });

  const doctors: DoctorProfile[] = useMemo(() => {
    if (Array.isArray(rawDoctors)) return rawDoctors;
    if (Array.isArray(rawDoctors?.data)) return rawDoctors.data;
    if (Array.isArray(rawDoctors?.items)) return rawDoctors.items;
    return [];
  }, [rawDoctors]);

  // Pre-select doctor if doctorId query param is provided
  useEffect(() => {
    if (doctorIdParam && doctors.length > 0 && !selectedDoctor) {
      const match = doctors.find((d) => d.id === doctorIdParam);
      if (match) {
        setSelectedDoctor(match);
        setStep(2);
      }
    }
  }, [doctorIdParam, doctors, selectedDoctor]);

  // 2. Auto-fetch current patient profile if logged in as PATIENT
  const { data: myPatientProfile } = useQuery({
    queryKey: ["my-patient-profile", user?.id],
    queryFn: () => apiClient<Patient>("/patients/me"),
    enabled: isPatientUser && !!token,
  });

  useEffect(() => {
    if (isPatientUser && myPatientProfile) {
      setSelectedPatient(myPatientProfile);
    }
  }, [isPatientUser, myPatientProfile]);

  // 3. Fetch Available Slots for Selected Doctor & Date
  const { data: slotsData, isLoading: loadingSlots } = useQuery({
    queryKey: ["doctor-slots", selectedDoctor?.id, selectedDate],
    queryFn: () =>
      apiClient<AvailableSlotsResponse>(`/doctors/${selectedDoctor?.id}/slots`, {
        params: { date: selectedDate },
      }),
    enabled: !!selectedDoctor && !!selectedDate,
  });

  // 4. Search Patients (for Staff / Receptionist booking)
  const { data: rawPatients = [] } = useQuery({
    queryKey: ["patients", patientSearch],
    queryFn: () =>
      apiClient<any>("/patients", {
        params: { search: patientSearch || undefined, limit: 10 },
      }),
    enabled: !isPatientUser,
  });

  const staffPatientsList: Patient[] = useMemo(() => {
    if (Array.isArray(rawPatients)) return rawPatients;
    if (Array.isArray(rawPatients?.data)) return rawPatients.data;
    if (Array.isArray(rawPatients?.items)) return rawPatients.items;
    return [];
  }, [rawPatients]);

  // 5. Booking Mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDoctor || !selectedSlot || !selectedPatient) {
        throw new Error("Missing booking details. Please verify doctor, slot, and patient.");
      }
      return apiClient("/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient_id: selectedPatient.id,
          doctor_id: selectedDoctor.id,
          appointment_type: "IN_PERSON",
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          reason_for_visit: reasonForVisit || "Routine Consultation",
        }),
      });
    },
    onSuccess: (data) => {
      setBookingSuccess(data);
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-slots"] });
      queryClient.invalidateQueries({ queryKey: ["live-queue"] });
    },
    onError: (err: any) => {
      setBookingError(err.message || "Failed to book appointment. Please try another slot.");
    },
  });

  const handleNext = () => {
    setBookingError(null);
    if (step === 1 && selectedDoctor) setStep(2);
    else if (step === 2 && selectedSlot) setStep(3);
    else if (step === 3 && selectedPatient) setStep(4);
  };

  const handleBack = () => {
    setBookingError(null);
    if (step > 1) setStep((step - 1) as any);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Wizard Header Progress */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold">
            <CalendarIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-base">Smart Appointment Booking</h2>
            <p className="text-[11px] text-slate-500">Conflict-free real-time doctor appointment scheduler</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[
            { s: 1, label: "Doctor" },
            { s: 2, label: "Schedule & Slot" },
            { s: 3, label: "Patient" },
            { s: 4, label: "Confirm" },
          ].map((item) => (
            <div
              key={item.s}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
                step === item.s
                  ? "bg-emerald-600 text-white shadow-sm"
                  : step > item.s
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-200 text-slate-600"
              }`}
            >
              <span>{item.s}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {bookingSuccess ? (
          <div className="text-center py-10 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800">Appointment Confirmed!</h3>
            <p className="text-slate-600 text-sm max-w-md mx-auto">
              Appointment reference{" "}
              <span className="font-mono font-bold text-emerald-600">
                {bookingSuccess.appointment_number}
              </span>{" "}
              has been successfully scheduled with{" "}
              <strong className="text-slate-800">{bookingSuccess.doctor_name}</strong> for{" "}
              <strong className="text-slate-800">{bookingSuccess.patient_name}</strong>.
            </p>
            <div className="pt-4 flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setBookingSuccess(null);
                  setSelectedDoctor(null);
                  setSelectedSlot(null);
                  setStep(1);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm transition"
              >
                Book Another Appointment
              </button>
              {isPatientUser ? (
                <Link
                  href="/patient/dashboard"
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                >
                  Go to Patient Dashboard
                </Link>
              ) : (
                <Link
                  href="/dashboard/appointments"
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition"
                >
                  View Appointment Desk
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            {bookingError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{bookingError}</span>
              </div>
            )}

            {/* STEP 1: DOCTOR SELECTION */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">Select Consulting Doctor:</h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {doctors.length} Doctor{doctors.length === 1 ? "" : "s"} Available
                  </span>
                </div>

                {loadingDoctors ? (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-sm text-slate-500">Loading consulting doctors directory...</p>
                  </div>
                ) : doctors.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
                    No active doctors available for booking at this time.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {doctors.map((doc) => {
                      const isSelected = selectedDoctor?.id === doc.id;
                      const formattedName = formatDoctorName(doc.first_name, doc.last_name);
                      const fee = Number(doc.consultation_fee) || 1000;
                      const followUpFee = Number(doc.follow_up_fee) || Math.round(fee * 0.5);

                      return (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDoctor(doc)}
                          className={`group relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 flex items-start gap-4 ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/60 shadow-md ring-2 ring-emerald-500/20"
                              : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/70 hover:shadow-sm"
                          }`}
                        >
                          {/* Profile Avatar / Photo */}
                          <div className="relative shrink-0">
                            {doc.avatar_url ? (
                              <img
                                src={doc.avatar_url}
                                alt={formattedName}
                                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm">
                                {(doc.first_name?.[0] || "D") + (doc.last_name?.[0] || "")}
                              </div>
                            )}
                            {/* Selection Checkmark Badge */}
                            {isSelected && (
                              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow">
                                <CheckCircle className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>

                          {/* Doctor Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">
                                {formattedName}
                              </h4>
                              {(() => {
                                const todayStr = new Date().toISOString().split("T")[0];
                                const onLeaveToday = doc.confirmed_leaves?.some(
                                  (l) => l.start_date <= todayStr && l.end_date >= todayStr
                                );

                                if (onLeaveToday) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                      On Leave
                                    </span>
                                  );
                                }
                                if (doc.current_status === "In OT") {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping" />
                                      In OT
                                    </span>
                                  );
                                }
                                if (doc.current_status === "On Visit") {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                                      On Visit
                                    </span>
                                  );
                                }
                                if (doc.current_status === "Off Duty" || !doc.is_available_for_booking) {
                                  return (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 shrink-0">
                                      Off Duty
                                    </span>
                                  );
                                }
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Available
                                  </span>
                                );
                              })()}
                            </div>

                            <p className="text-xs text-emerald-600 font-medium mt-0.5">
                              {doc.specialization || "General Medicine"}
                            </p>

                            {doc.chamber_location && (
                              <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                {doc.chamber_location}
                              </p>
                            )}

                            {doc.visiting_days && (
                              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                                Schedule: {doc.visiting_days} ({doc.visiting_hours || "Regular Hours"})
                              </p>
                            )}

                            {/* BDT Consultation Fee & Follow-up Fee */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1 font-bold text-emerald-700">
                                <span className="text-slate-400 font-normal">Fee:</span>
                                <span>৳ {fee.toLocaleString()}</span>
                              </div>
                              {followUpFee > 0 && (
                                <div className="text-[11px] text-slate-500">
                                  Follow-up: <span className="font-semibold text-slate-700">৳ {followUpFee.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: DATE & DYNAMIC SLOT GRID */}
            {step === 2 && selectedDoctor && (() => {
              const conflictingLeave = selectedDoctor.confirmed_leaves?.find(
                (l) => l.start_date <= selectedDate && l.end_date >= selectedDate
              );
              const targetDayIndex = (new Date(selectedDate + "T12:00:00").getDay() + 6) % 7;
              const daySchedule = selectedDoctor.weekly_schedule?.find((d) => d.day === targetDayIndex);
              const isDayOff = daySchedule ? !daySchedule.is_active : false;

              return (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-800">
                          {formatDoctorName(selectedDoctor.first_name, selectedDoctor.last_name)}
                        </h4>
                        {selectedDoctor.current_status === "In OT" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            In OT • {selectedDoctor.available_from_time || "Available soon"}
                          </span>
                        ) : selectedDoctor.current_status === "On Visit" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            On Ward Visit
                          </span>
                        ) : selectedDoctor.current_status === "Off Duty" ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Off Duty
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Available in Chamber
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {selectedDoctor.specialization} • {selectedDoctor.chamber_location || "Main OPD Building"}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-emerald-700">
                        <span>Consultation Fee: ৳ {(Number(selectedDoctor.consultation_fee) || 1000).toLocaleString()}</span>
                        {selectedDoctor.visiting_days && (
                          <span className="text-slate-400 font-normal">
                            • Schedule: {selectedDoctor.visiting_days} ({selectedDoctor.visiting_hours || "Regular"})
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Consultation Date
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                          setSelectedDate(e.target.value);
                          setSelectedSlot(null);
                        }}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Confirmed Leave Warning Alert */}
                  {conflictingLeave ? (
                    <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl flex items-start gap-3 animate-fadeIn">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold">Doctor is on Confirmed Leave</p>
                        <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">
                          Dr. {formatDoctorName(selectedDoctor.first_name, selectedDoctor.last_name)} has approved leave from{" "}
                          <strong className="font-semibold text-rose-900">{conflictingLeave.start_date}</strong> to{" "}
                          <strong className="font-semibold text-rose-900">{conflictingLeave.end_date}</strong> ({conflictingLeave.reason}). Online bookings are blocked on this date. Please select another date after {conflictingLeave.end_date}.
                        </p>
                      </div>
                    </div>
                  ) : isDayOff ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-start gap-3 animate-fadeIn">
                      <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold">Weekly Day Off</p>
                        <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                          Dr. {formatDoctorName(selectedDoctor.first_name, selectedDoctor.last_name)} does not conduct consultations on{" "}
                          <strong className="font-semibold text-amber-900">{daySchedule?.name || "this day"}</strong> (Weekly Day Off). Please select an active consulting day.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-700">
                          Available Time Slots ({slotsData?.slots?.filter((s) => s.is_available).length || 0} open)
                        </h3>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Available
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Break / Booked
                          </span>
                        </div>
                      </div>

                      {loadingSlots ? (
                        <div className="py-8 text-center text-sm text-slate-500">
                          Calculating real-time doctor availability...
                        </div>
                      ) : slotsData?.slots.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-500 text-sm">
                          Doctor is not scheduled or on leave on this date. Please select another day.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto p-1">
                          {slotsData?.slots.map((slot, index) => {
                            const start = new Date(slot.start_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            const end = new Date(slot.end_time).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            const isSelected = selectedSlot?.start_time === slot.start_time;

                            return (
                              <button
                                key={index}
                                type="button"
                                disabled={!slot.is_available}
                                onClick={() => setSelectedSlot(slot)}
                                className={`p-2.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                                  isSelected
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                    : slot.is_available
                                    ? "bg-white hover:bg-emerald-50 text-slate-800 border-slate-200 hover:border-emerald-400"
                                    : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through"
                                }`}
                              >
                                <div>{start} - {end}</div>
                                {slot.reason && (
                                  <div className="text-[10px] font-normal mt-0.5">{slot.reason}</div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* STEP 3: PATIENT SELECTION */}
            {step === 3 && (
              <div className="space-y-5">
                {isPatientUser && selectedPatient ? (
                  /* Auto-filled Patient Card for Logged-In Patient */
                  <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserIcon className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
                          Consultation Registered For (Self)
                        </h4>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Patient Profile Verified
                      </span>
                    </div>

                    <div className="p-4 bg-white rounded-xl border border-emerald-100 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-base text-slate-900">
                            {selectedPatient.first_name} {selectedPatient.last_name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500">
                            <span>MRN: <strong className="font-mono text-slate-700">{selectedPatient.mrn}</strong></span>
                            <span>Phone: <strong className="text-slate-700">{selectedPatient.phone}</strong></span>
                            <span>Gender: <strong className="text-slate-700">{selectedPatient.gender}</strong></span>
                            {selectedPatient.blood_group && (
                              <span>Blood: <strong className="text-rose-600">{selectedPatient.blood_group}</strong></span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Your patient profile is automatically linked to this appointment. You do not need to search or select another profile.
                    </p>
                  </div>
                ) : (
                  /* Staff Patient Search & Picker */
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                      <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="Search patient by Name, Phone, or MRN..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {staffPatientsList.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPatient(p)}
                          className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                            selectedPatient?.id === p.id
                              ? "bg-emerald-50 border-emerald-500"
                              : "hover:bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-sm text-slate-800">
                              {p.first_name} {p.last_name}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-3 mt-0.5">
                              <span>MRN: <strong className="font-mono text-slate-700">{p.mrn}</strong></span>
                              <span>Phone: {p.phone}</span>
                              <span>DOB: {p.date_of_birth}</span>
                            </div>
                          </div>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {p.gender}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chief Complaint / Reason for Visit */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Chief Complaint / Reason for Visit
                  </label>
                  <textarea
                    rows={2}
                    value={reasonForVisit}
                    onChange={(e) => setReasonForVisit(e.target.value)}
                    placeholder="E.g. Recurring migraine, follow-up blood pressure check, routine consultation..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* STEP 4: REVIEW & CONFIRM */}
            {step === 4 && selectedDoctor && selectedSlot && selectedPatient && (
              <div className="space-y-4">
                <div className="p-5 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-4">
                  <h4 className="font-bold text-sm text-emerald-900 border-b border-emerald-100 pb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Review Appointment Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block">Doctor:</span>
                      <strong className="text-slate-800 text-sm">
                        {formatDoctorName(selectedDoctor.first_name, selectedDoctor.last_name)}
                      </strong>
                      <span className="text-emerald-700 block">{selectedDoctor.specialization}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Patient:</span>
                      <strong className="text-slate-800 text-sm">
                        {selectedPatient.first_name} {selectedPatient.last_name}
                      </strong>
                      <span className="text-slate-600 block">MRN: {selectedPatient.mrn}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Time Slot:</span>
                      <strong className="text-slate-800 text-sm">
                        {new Date(selectedSlot.start_time).toLocaleDateString()}{" "}
                        {new Date(selectedSlot.start_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        -{" "}
                        {new Date(selectedSlot.end_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Consultation Fee:</span>
                      <strong className="text-emerald-700 text-base font-bold">
                        ৳ {(Number(selectedDoctor.consultation_fee) || 1000).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                  {reasonForVisit && (
                    <div className="pt-2 border-t border-emerald-100 text-xs text-slate-700">
                      <span className="text-slate-500 block">Reason for visit:</span>
                      {reasonForVisit}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Database-level atomic lock is active. No overlapping slot can be double-booked.
                  </span>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 flex items-center gap-1.5 transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              ) : (
                <div />
              )}

              {step < 4 ? (
                <button
                  type="button"
                  disabled={
                    (step === 1 && !selectedDoctor) ||
                    (step === 2 && !selectedSlot) ||
                    (step === 3 && !selectedPatient)
                  }
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={bookMutation.isPending}
                  onClick={() => bookMutation.mutate()}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-sm flex items-center gap-2 disabled:opacity-50 transition"
                >
                  {bookMutation.isPending ? "Confirming..." : "Confirm & Book Slot"}
                  <CheckCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
