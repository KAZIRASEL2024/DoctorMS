"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DoctorScheduleOverview, DoctorLeave, DayScheduleItem } from "@/types";
import { BackButton } from "@/components/ui/back-button";
import {
  Calendar,
  Clock,
  Coffee,
  CheckCircle,
  Save,
  AlertCircle,
  XCircle,
  Stethoscope,
  Activity,
  Sparkles,
  ShieldCheck,
  Check,
  RefreshCw,
} from "lucide-react";

const DEFAULT_DAYS: DayScheduleItem[] = [
  { day: 0, name: "Monday", is_active: true, start_time: "08:00", end_time: "17:00", lunch_start: "12:00", lunch_end: "13:00" },
  { day: 1, name: "Tuesday", is_active: true, start_time: "08:00", end_time: "17:00", lunch_start: "12:00", lunch_end: "13:00" },
  { day: 2, name: "Wednesday", is_active: true, start_time: "08:00", end_time: "17:00", lunch_start: "12:00", lunch_end: "13:00" },
  { day: 3, name: "Thursday", is_active: true, start_time: "08:00", end_time: "17:00", lunch_start: "12:00", lunch_end: "13:00" },
  { day: 4, name: "Friday", is_active: true, start_time: "08:00", end_time: "13:00", lunch_start: "13:00", lunch_end: "14:00" },
  { day: 5, name: "Saturday", is_active: true, start_time: "09:00", end_time: "15:00", lunch_start: "13:00", lunch_end: "14:00" },
  { day: 6, name: "Sunday", is_active: false, start_time: "00:00", end_time: "00:00", lunch_start: "12:00", lunch_end: "13:00" },
];

export default function DoctorSchedulePage() {
  const queryClient = useQueryClient();

  // 1. Fetch Doctor Schedule Overview
  const { data: scheduleData, isLoading: isLoadingSchedule } = useQuery<DoctorScheduleOverview>({
    queryKey: ["my-doctor-schedule"],
    queryFn: () => apiClient<DoctorScheduleOverview>("/doctors/me/schedule"),
  });

  // 2. Fetch Doctor Leaves
  const { data: leaves = [], isLoading: isLoadingLeaves } = useQuery<DoctorLeave[]>({
    queryKey: ["my-doctor-leaves"],
    queryFn: () => apiClient<DoctorLeave[]>("/doctors/me/leaves"),
  });

  // Live Duty Status State
  const [liveStatus, setLiveStatus] = useState<string>("Available");
  const [availableFrom, setAvailableFrom] = useState<string>("");
  const [statusNote, setStatusNote] = useState<string>("");
  const [liveStatusSuccess, setLiveStatusSuccess] = useState<string | null>(null);

  // Weekly Working Hours State
  const [slotDuration, setSlotDuration] = useState<number>(20);
  const [bufferTime, setBufferTime] = useState<number>(5);
  const [weeklyDays, setWeeklyDays] = useState<DayScheduleItem[]>(DEFAULT_DAYS);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  // Leave Form State
  const [leaveStart, setLeaveStart] = useState<string>("");
  const [leaveEnd, setLeaveEnd] = useState<string>("");
  const [leaveReason, setLeaveReason] = useState<string>("");
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveSuccess, setLeaveSuccess] = useState<string | null>(null);

  // Sync state with fetched scheduleData
  useEffect(() => {
    if (scheduleData) {
      if (scheduleData.current_status) setLiveStatus(scheduleData.current_status);
      if (scheduleData.available_from_time) setAvailableFrom(scheduleData.available_from_time);
      if (scheduleData.status_note) setStatusNote(scheduleData.status_note);
      if (scheduleData.slot_duration) setSlotDuration(scheduleData.slot_duration);
      if (scheduleData.buffer_time) setBufferTime(scheduleData.buffer_time);
      if (scheduleData.weekly_schedule && scheduleData.weekly_schedule.length > 0) {
        setWeeklyDays(scheduleData.weekly_schedule);
      }
    }
  }, [scheduleData]);

  // Mutation: Update Live Duty Status
  const updateLiveStatusMutation = useMutation({
    mutationFn: (data: { current_status: string; available_from_time?: string; status_note?: string }) =>
      apiClient("/doctors/me/schedule", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-doctor-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["public-doctors"] });
      setLiveStatusSuccess("Live status updated! Visible in real-time on patient directory and booking desk.");
      setTimeout(() => setLiveStatusSuccess(null), 4000);
    },
    onError: (err: any) => {
      alert("Failed to update status: " + (err.message || "Unknown error"));
    },
  });

  // Mutation: Save Weekly Shift Template
  const saveScheduleMutation = useMutation({
    mutationFn: (data: { slot_duration: number; buffer_time: number; weekly_schedule: DayScheduleItem[] }) =>
      apiClient("/doctors/me/schedule", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-doctor-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["public-doctors"] });
      setScheduleSuccess("Weekly consultation schedule saved and slot engine rules updated!");
      setTimeout(() => setScheduleSuccess(null), 4000);
    },
    onError: (err: any) => {
      alert("Failed to save schedule: " + (err.message || "Unknown error"));
    },
  });

  // Mutation: Submit Leave Request
  const requestLeaveMutation = useMutation({
    mutationFn: (data: { start_date: string; end_date: string; reason: string }) =>
      apiClient("/doctors/me/leaves", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-doctor-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["public-doctors"] });
      setLeaveSuccess("Leave request submitted! Super Admin will review and confirm.");
      setLeaveStart("");
      setLeaveEnd("");
      setLeaveReason("");
      setLeaveError(null);
      setTimeout(() => setLeaveSuccess(null), 5000);
    },
    onError: (err: any) => {
      setLeaveError(err.message || "Failed to submit leave request");
    },
  });

  // Handlers
  const handleUpdateLiveStatus = (e: React.FormEvent) => {
    e.preventDefault();
    updateLiveStatusMutation.mutate({
      current_status: liveStatus,
      available_from_time: availableFrom || undefined,
      status_note: statusNote || undefined,
    });
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    saveScheduleMutation.mutate({
      slot_duration: slotDuration,
      buffer_time: bufferTime,
      weekly_schedule: weeklyDays,
    });
  };

  const handleDayFieldChange = (index: number, field: keyof DayScheduleItem, value: any) => {
    setWeeklyDays((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRequestLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) {
      setLeaveError("Please fill in start date, end date, and reason.");
      return;
    }
    if (new Date(leaveEnd) < new Date(leaveStart)) {
      setLeaveError("End date cannot be earlier than start date.");
      return;
    }
    requestLeaveMutation.mutate({
      start_date: leaveStart,
      end_date: leaveEnd,
      reason: leaveReason.trim(),
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard/doctor" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/60">
                <Calendar className="w-5 h-5 text-emerald-600" />
              </div>
              Doctor Shifts & Availability Workspace
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Toggle live OT/clinic availability, configure weekly consulting hours, and submit vacation leave requests.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CARD 1: TOP LIVE DUTY STATUS & OT AVAILABILITY CARD */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
              <Activity className="w-5 h-5 text-emerald-600 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Current Clinical Status & OT Availability</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Patients and receptionist queue see this real-time status banner before booking.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Live Indicator:</span>
            {liveStatus === "Available" ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                Available in Chamber
              </span>
            ) : liveStatus === "In OT" ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
                In OT / Surgery
              </span>
            ) : liveStatus === "On Visit" ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                On Ward Visit
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1.5 whitespace-nowrap">
                Off Duty / Unavailable
              </span>
            )}
          </div>
        </div>

        {liveStatusSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{liveStatusSuccess}</span>
          </div>
        )}

        <form onSubmit={handleUpdateLiveStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Current Duty State
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "Available", label: "Available in Chamber", desc: "Consulting patients now", color: "border-emerald-300 bg-emerald-50/50 text-emerald-900" },
                { id: "In OT", label: "In OT / Surgery", desc: "Performing operation", color: "border-amber-300 bg-amber-50/50 text-amber-900" },
                { id: "On Visit", label: "On Ward Visit", desc: "Rounding admitted beds", color: "border-emerald-300 bg-emerald-50/50 text-emerald-900" },
                { id: "Off Duty", label: "Off Duty / Unavailable", desc: "Not seeing patients", color: "border-slate-300 bg-slate-100 text-slate-800" },
              ].map((opt) => {
                const isSelected = liveStatus === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLiveStatus(opt.id)}
                    className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? `${opt.color} ring-2 ring-emerald-600/30 shadow-xs font-bold`
                        : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">{opt.label}</span>
                      {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <span className="text-[11px] text-slate-500 font-normal block mt-1">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Next Expected Chamber Availability (e.g., 05:00 PM)
              </label>
              <input
                type="text"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                placeholder="e.g. In OT — Available after 04:30 PM"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clinical Status Note (Visible to Reception & Patients)
              </label>
              <input
                type="text"
                value={statusNote}
                onChange={(e) => setStatusNote(e.target.value)}
                placeholder="e.g. Emergency surgery scheduled in OT-2 until 5:00 PM"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={updateLiveStatusMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {updateLiveStatusMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>Update Live Status</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* CARD 2: EDITABLE WEEKLY CONSULTATION WORKING HOURS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Editable Weekly Consultation Working Hours</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Set regular shift hours, lunch break pauses, and toggle off-days for appointment slot generation.
              </p>
            </div>
          </div>
        </div>

        {scheduleSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{scheduleSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSaveSchedule} className="space-y-6">
          {/* Timing Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Consultation Slot Duration (Minutes per Patient)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Default: 20 minutes</span>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Buffer Time Between Appointments (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={bufferTime}
                onChange={(e) => setBufferTime(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-semibold"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Default: 5 minutes</span>
            </div>
          </div>

          {/* 7 Days of the Week Schedule Editor */}
          <div className="space-y-3">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span className="col-span-2">Day of Week</span>
              <span className="col-span-2">Status</span>
              <span className="col-span-4">Consultation Shift Hours</span>
              <span className="col-span-4">Lunch Break Pause</span>
            </div>

            {weeklyDays.map((d, idx) => (
              <div
                key={d.day}
                className={`p-4 rounded-2xl border transition-all ${
                  d.is_active
                    ? "bg-white border-slate-200 hover:border-emerald-200"
                    : "bg-slate-50/70 border-slate-200 text-slate-400"
                }`}
              >
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  {/* Day Name */}
                  <div className="md:col-span-2 flex items-center justify-between md:justify-start gap-2">
                    <span className="font-bold text-sm text-slate-900">{d.name}</span>
                  </div>

                  {/* Active / Off Toggle */}
                  <div className="md:col-span-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDayFieldChange(idx, "is_active", !d.is_active)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        d.is_active
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : "bg-slate-200 text-slate-600 border border-slate-300"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${d.is_active ? "bg-emerald-600" : "bg-slate-400"}`} />
                      <span>{d.is_active ? "Active" : "Off Day"}</span>
                    </button>
                  </div>

                  {/* Shift Hours */}
                  <div className="md:col-span-4">
                    {d.is_active ? (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">From:</span>
                        <input
                          type="time"
                          value={d.start_time}
                          onChange={(e) => handleDayFieldChange(idx, "start_time", e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                        />
                        <span className="text-slate-500 font-medium">To:</span>
                        <input
                          type="time"
                          value={d.end_time}
                          onChange={(e) => handleDayFieldChange(idx, "end_time", e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Weekly Day Off (No appointments scheduled)</span>
                    )}
                  </div>

                  {/* Lunch Break */}
                  <div className="md:col-span-4">
                    {d.is_active ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="text-slate-500 font-medium">Lunch:</span>
                        <input
                          type="time"
                          value={d.lunch_start || "12:00"}
                          onChange={(e) => handleDayFieldChange(idx, "lunch_start", e.target.value)}
                          className="px-2.5 py-1.5 bg-amber-50/50 border border-amber-200 rounded-lg text-xs font-mono font-semibold text-amber-900"
                        />
                        <span className="text-slate-500 font-medium">-</span>
                        <input
                          type="time"
                          value={d.lunch_end || "13:00"}
                          onChange={(e) => handleDayFieldChange(idx, "lunch_end", e.target.value)}
                          className="px-2.5 py-1.5 bg-amber-50/50 border border-amber-200 rounded-lg text-xs font-mono font-semibold text-amber-900"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saveScheduleMutation.isPending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saveScheduleMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Weekly Schedule</span>
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* CARD 3: SCHEDULE TIME-OFF / VACATION LEAVE & LEAVE TRACKER */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <Calendar className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Schedule Time-Off / Vacation Leave</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Submit planned leave dates for Super Admin approval. Once confirmed, online booking is blocked automatically.
            </p>
          </div>
        </div>

        {leaveSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{leaveSuccess}</span>
          </div>
        )}

        {leaveError && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{leaveError}</span>
          </div>
        )}

        {/* Leave Submission Form */}
        <form onSubmit={handleRequestLeave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Start Date *</label>
              <input
                type="date"
                required
                value={leaveStart}
                onChange={(e) => setLeaveStart(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Leave End Date *</label>
              <input
                type="date"
                required
                value={leaveEnd}
                onChange={(e) => setLeaveEnd(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave / Purpose *</label>
            <input
              type="text"
              required
              value={leaveReason}
              onChange={(e) => setLeaveReason(e.target.value)}
              placeholder="e.g. Annual Vacation / International Cardiology Conference / Medical Workshop"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={requestLeaveMutation.isPending}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {requestLeaveMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              <span>Submit Leave Request</span>
            </button>
          </div>
        </form>

        {/* ========================================================================= */}
        {/* LEAVE HISTORY TABLE */}
        {/* ========================================================================= */}
        <div className="pt-6 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>My Leave Requests & Confirmed Leaves</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                {leaves.length}
              </span>
            </h3>
          </div>

          {isLoadingLeaves ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading leave requests...</div>
          ) : leaves.length === 0 ? (
            <div className="py-8 text-center bg-slate-50/60 rounded-2xl border border-slate-200/80">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-600">No leave requests submitted yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Submit planned vacation or conference dates using the form above.
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-2xl border border-slate-200">
              <table className="min-w-[650px] w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Leave Date Range</th>
                    <th className="py-3 px-4 whitespace-nowrap">Duration</th>
                    <th className="py-3 px-4 whitespace-nowrap">Reason</th>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Requested On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leaves.map((l) => {
                    const isApproved = l.status === "APPROVED" || l.status === "Approved";
                    const isRejected = l.status === "REJECTED" || l.status === "Rejected";

                    return (
                      <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap sticky left-0 bg-white z-10 shadow-xs">
                          {l.start_date} <span className="text-slate-400">→</span> {l.end_date}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                          {l.total_days || 1} Day{l.total_days && l.total_days > 1 ? "s" : ""}
                        </td>
                        <td className="py-3.5 px-4 text-slate-800 font-medium max-w-[240px] truncate">
                          {l.reason}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Leave Confirmed
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              <XCircle className="w-3.5 h-3.5" />
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-3.5 h-3.5" />
                              Pending Admin Approval
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {l.created_at ? new Date(l.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
