"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  HeartPulse,
  Calendar,
  Clock,
  MapPin,
  Phone,
  PhoneCall,
  User,
  CheckCircle2,
  AlertCircle,
  Clock3,
  DollarSign,
  ShieldCheck,
  Award,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  CreditCard,
  FileText,
  Play,
  PowerOff,
  AlertTriangle,
  Upload,
  Star,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { LiveDutyTimer } from "@/components/nurse/live-duty-timer";
import { NurseProfile, NurseBooking } from "@/types";

export default function NurseDashboardPage() {
  const { user, token } = useAuth();
  const [profile, setProfile] = useState<NurseProfile | null>(null);
  const [bookings, setBookings] = useState<NurseBooking[]>([]);
  const [filter, setFilter] = useState<"ALL" | "Pending" | "Confirmed" | "Completed">("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      // 1. Fetch Profile
      const profRes = await fetch("/api/v1/nurse/me/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profRes.ok) {
        const pData = await profRes.json();
        setProfile(pData);
      }

      // 2. Fetch Bookings
      const bookRes = await fetch("/api/v1/nurse/me/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (bookRes.ok) {
        const bData = await bookRes.json();
        setBookings(bData);
      }
    } catch (err) {
      console.error("Error loading nurse dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  const handleStartDuty = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/v1/nurse/bookings/${bookingId}/start-duty`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to start duty");
      }
      setFeedbackMsg({
        type: "success",
        text: "Duty timer started! Live duration is now tracking.",
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
      await fetchDashboardData();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "Failed to start duty",
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEndDuty = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    try {
      const res = await fetch(`/api/v1/nurse/bookings/${bookingId}/end-duty`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to end duty");
      }
      const data = await res.json();
      const otMsg =
        data.overtime_hours > 0
          ? ` Overtime billed: +${data.overtime_hours} hrs (৳${data.overtime_due_bdt.toLocaleString()}).`
          : "";
      setFeedbackMsg({
        type: "success",
        text: `Duty completed successfully!${otMsg}`,
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      await fetchDashboardData();
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "Failed to end duty",
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleAvailability = async () => {
    if (!profile) return;
    try {
      const res = await fetch("/api/v1/nurse/me/availability", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, is_available: data.is_available });
        setFeedbackMsg({
          type: "success",
          text: data.is_available
            ? "Your status is now ACTIVE: You appear in patient home care booking searches."
            : "Your status is now PAUSED: New bookings are temporarily stopped.",
        });
        setTimeout(() => setFeedbackMsg(null), 3000);
      }
    } catch (err) {
      console.error("Failed to toggle availability:", err);
    }
  };

  // Find active duty in progress
  const activeDutyBooking = bookings.find((b) => b.duty_status === "In Progress");

  // KPIs
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter((b) => b.status === "Pending");
  const confirmedBookings = bookings.filter((b) => b.status === "Confirmed");
  const completedBookings = bookings.filter((b) => b.status === "Completed");

  const totalEarningsBdt = completedBookings.reduce((acc, curr) => acc + (curr.fee_bdt || 0), 0);
  const totalOvertimeBdt = bookings.reduce((acc, curr) => acc + (curr.overtime_due_bdt || 0), 0);

  const filteredBookings = bookings.filter((b) => {
    if (filter === "ALL") return true;
    return b.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Registered Home Care Nurse
              </span>
              <span className="text-xs text-slate-500 font-sans">
                Duty Engine v2.0
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <HeartPulse className="w-6 h-6 text-emerald-600" />
              <span>Nurse Clinical Portal</span>
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Review assigned patient home visits, run live duty timers, and track completed care earnings.
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/dashboard/nurse/profile"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & DP Upload</span>
          </Link>
          <Link
            href="/nurses"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center gap-1.5"
          >
            <span>Public Directory</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </Link>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 transition-all ${
            feedbackMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* LIVE DUTY TIMER CARD (Prominently displayed when duty is in progress) */}
      {activeDutyBooking && (
        <LiveDutyTimer
          booking={activeDutyBooking}
          onEndDuty={handleEndDuty}
          isEnding={actionLoadingId === activeDutyBooking.id}
        />
      )}

      {/* Nurse Profile Overview Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <Link href="/dashboard/nurse/profile" className="relative group shrink-0" title="Click to change profile picture">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-100 shadow-xs group-hover:border-emerald-500 transition"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white font-bold text-xl flex items-center justify-center shadow-xs">
                  {profile?.full_name ? profile.full_name.charAt(0) : "N"}
                </div>
              )}
              <span className="absolute bottom-0 right-0 bg-emerald-600 text-white p-1 rounded-full shadow-xs border border-white group-hover:scale-110 transition">
                <Upload className="w-2.5 h-2.5" />
              </span>
            </Link>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">
                  {profile?.full_name || (user?.first_name ? `Nurse ${user.first_name} ${user.last_name || ""}` : "Registered Nurse")}
                </h2>
                {profile?.is_available ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Available for Visits
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Paused / Off-Duty
                  </span>
                )}
                {/* Nurse Live Rating Badge */}
                {profile?.total_reviews && profile.total_reviews > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                    <span>★ {Number(profile.average_rating || 5.0).toFixed(1)}</span>
                    <span className="font-normal text-amber-700">
                      ({profile.total_reviews} {profile.total_reviews === 1 ? "review" : "reviews"})
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                    <Star className="w-3 h-3 text-slate-400" />
                    <span>★ No reviews yet</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-medium text-slate-800">
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  {profile?.education || "B.Sc in Nursing (DU), Critical Care Certified"}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  Coverage: {profile?.service_location || "Dhaka Central"}
                </span>
                <span className="flex items-center gap-1 text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded tabular-nums">
                  ৳ {Number(profile?.service_fee_bdt || 1500).toLocaleString()} / session
                </span>
              </div>
            </div>
          </div>

          {/* Action & Availability Toggle */}
          <div className="flex flex-wrap items-center gap-3 border-t md:border-t-0 pt-4 md:pt-0">
            <Link
              href="/dashboard/nurse/profile"
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition flex items-center gap-1.5"
            >
              <span>Edit Bio & Location</span>
            </Link>

            <button
              onClick={handleToggleAvailability}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition border shadow-xs ${
                profile?.is_available
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              }`}
            >
              {profile?.is_available ? (
                <>
                  <ToggleRight className="w-4 h-4" />
                  <span>Accepting Bookings</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4" />
                  <span>Paused</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Patient Rating & Feedback */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patient Rating</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums">
                {profile?.total_reviews ? Number(profile.average_rating || 5.0).toFixed(1) : "5.0"}
              </span>
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <p className="text-[11px] text-amber-700 font-medium mt-0.5">
              {profile?.total_reviews || 0} {profile?.total_reviews === 1 ? "Verified Review" : "Verified Reviews"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <Star className="w-6 h-6 fill-amber-400 text-amber-500" />
          </div>
        </div>

        {/* Total Bookings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Bookings</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">{totalBookings}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Assigned Home Care</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Pending / Active Shifts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active & Scheduled</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">
              {bookings.filter((b) => b.duty_status === "In Progress" || b.duty_status === "Ready to Start").length}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              {activeDutyBooking ? "1 Duty In Progress" : "Ready for Home Visits"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Clock3 className="w-6 h-6" />
          </div>
        </div>

        {/* Completed Shifts */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Completed Sessions</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">{completedBookings.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Verified Patient Visits</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Completed Revenue & Overtime */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">
              ৳ {totalEarningsBdt.toLocaleString()}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
              {totalOvertimeBdt > 0 ? `Incl. ৳${totalOvertimeBdt} overtime` : "Standard shift rates"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <span className="font-bold text-lg text-emerald-700">৳</span>
          </div>
        </div>
      </div>

      {/* Main Care Visits Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filter Tabs */}
        <div className="p-4 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Patient Care Visits & Roster</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Payment-gated duty timer activation, patient contacts, and automatic overtime tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                filter === "ALL"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All ({bookings.length})
            </button>
            <button
              onClick={() => setFilter("Pending")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                filter === "Pending"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Pending ({pendingBookings.length})
            </button>
            <button
              onClick={() => setFilter("Confirmed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                filter === "Confirmed"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Confirmed ({confirmedBookings.length})
            </button>
            <button
              onClick={() => setFilter("Completed")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                filter === "Completed"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              Completed ({completedBookings.length})
            </button>
          </div>
        </div>

        {/* Bookings Table */}
        {isLoading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading home care visits...</div>
        ) : filteredBookings.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-200">
              <Calendar className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No care visits under this filter</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              When patients book home nursing care sessions in your coverage area, they will appear right here.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="min-w-[950px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Booking Code</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Patient Details</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Schedule & Duration</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Home Address & Notes</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Shift Fee (৳)</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Duty Status</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Duty Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBookings.map((b) => {
                  const isBusy = actionLoadingId === b.id;
                  const isPaid = b.payment_status === "Paid";
                  const inProgress = b.duty_status === "In Progress";
                  const isCompleted = b.duty_status === "Completed" || b.status === "Completed";
                  const readyToStart = isPaid && !inProgress && !isCompleted;
                  const awaitingPayment = !isPaid && !isCompleted;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Booking Code */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {b.booking_code}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {new Date(b.created_at).toLocaleDateString()}
                        </div>
                        {b.invoice_number && (
                          <div className="text-[10px] text-emerald-700 font-mono mt-0.5">
                            {b.invoice_number}
                          </div>
                        )}
                      </td>

                      {/* Patient Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{b.patient_name || "Patient Member"}</span>
                        </div>
                        {b.patient_phone && (
                          <a
                            href={`tel:${b.patient_phone}`}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-0.5"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span>{b.patient_phone}</span>
                          </a>
                        )}
                      </td>

                      {/* Schedule & Duration */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-800 text-xs">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{new Date(b.service_date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-medium text-slate-700">{b.shift_time}</span>
                        </div>
                        <div className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                          Contracted: {b.contracted_hours || 4}h (@ ৳{b.hourly_rate_bdt || 300}/h)
                        </div>
                      </td>

                      {/* Address & Notes */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-start gap-1 text-xs text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{b.patient_address}</span>
                        </div>
                        {b.care_notes && (
                          <div className="text-[11px] text-slate-500 italic mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 line-clamp-2">
                            &ldquo;{b.care_notes}&rdquo;
                          </div>
                        )}
                      </td>

                      {/* Fee & Billing */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">
                          ৳{Number(b.fee_bdt || 0).toLocaleString()}
                        </div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          Payment: {b.payment_status || "Due"}
                        </span>
                        {b.overtime_due_bdt && b.overtime_due_bdt > 0 ? (
                          <div className="text-[10px] font-bold text-amber-700 mt-1">
                            +OT Due: ৳{Number(b.overtime_due_bdt).toLocaleString()}
                          </div>
                        ) : null}
                      </td>

                      {/* Duty Status */}
                      <td className="py-3.5 px-4">
                        {inProgress ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            <span>Duty In Progress</span>
                          </span>
                        ) : readyToStart ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Paid — Ready to Start</span>
                          </span>
                        ) : awaitingPayment ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                            <Clock3 className="w-3 h-3 text-slate-500" />
                            <span>Awaiting Reception Payment</span>
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Completed</span>
                            </span>
                            {b.actual_worked_minutes ? (
                              <div className="text-[10px] text-slate-500 font-mono">
                                Worked: {Math.floor(b.actual_worked_minutes / 60)}h {b.actual_worked_minutes % 60}m
                              </div>
                            ) : null}
                            {b.overtime_hours && b.overtime_hours > 0 ? (
                              <div className="text-[10px] font-semibold text-amber-700">
                                Overtime: +{b.overtime_hours}h
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Direct Patient Call */}
                          {b.patient_phone && (
                            <a
                              href={`tel:${b.patient_phone}`}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                              title="Call Patient Family"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                          )}

                          {/* Duty in progress -> Off / Complete button */}
                          {inProgress && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleEndDuty(b.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                              <span>{isBusy ? "Ending..." : "Off Duty"}</span>
                            </button>
                          )}

                          {/* Ready to start -> Start Duty button */}
                          {readyToStart && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleStartDuty(b.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>{isBusy ? "Starting..." : "Start Duty"}</span>
                            </button>
                          )}

                          {/* Awaiting payment -> Disabled button */}
                          {awaitingPayment && (
                            <button
                              disabled
                              className="px-3 py-1.5 bg-slate-100 text-slate-400 text-xs font-medium rounded-lg border border-slate-200 cursor-not-allowed flex items-center gap-1"
                              title="Start is payment-gated: Receptionist must record invoice payment first"
                            >
                              <Clock3 className="w-3.5 h-3.5 text-slate-400" />
                              <span>Start (Unpaid)</span>
                            </button>
                          )}

                          {/* Completed */}
                          {isCompleted && (
                            <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Done</span>
                            </span>
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
    </div>
  );
}
