"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Appointment, DoctorProfile, AppointmentStatus } from "@/types";
import { Calendar, Plus, Filter, CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";

export default function AppointmentsMasterPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["all-appointments", statusFilter, selectedDate],
    queryFn: () =>
      apiClient<Appointment[]>("/appointments", {
        params: {
          status: statusFilter || undefined,
          date: selectedDate || undefined,
        },
      }),
  });

  const checkInMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      apiClient(`/appointments/${appointmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CHECKED_IN" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["live-queue"] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (appointmentId: string) =>
      apiClient(`/appointments/${appointmentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "CANCELLED",
          cancellation_reason: "Cancelled by patient or reception",
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-appointments"] });
    },
  });

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "SCHEDULED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Scheduled</span>;
      case "CHECKED_IN":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Checked-In</span>;
      case "IN_CONSULTATION":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Consult</span>;
      case "COMPLETED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>;
      case "CANCELLED":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
              Appointments Management
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Master roster of doctor consultation bookings, arrival check-ins, and schedule statuses.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/appointments/book"
          className="px-3.5 sm:px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-xs transition min-h-[40px] whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" /> Book Appointment
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4 text-xs">
        <div>
          <label className="block text-slate-500 font-semibold mb-1">Filter by Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2 border rounded-lg bg-white font-medium text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="CHECKED_IN">Checked-In</option>
            <option value="IN_CONSULTATION">In Consultation</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-500 font-semibold mb-1">Target Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 border rounded-lg text-slate-700"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No appointments found.</div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[750px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                  <th className="py-3 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Ref #</th>
                  <th className="py-3 px-4 whitespace-nowrap">Patient</th>
                  <th className="py-3 px-4 whitespace-nowrap">Doctor</th>
                  <th className="py-3 px-4 whitespace-nowrap">Scheduled Slot</th>
                  <th className="py-3 px-4 whitespace-nowrap">Reason</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-xs whitespace-nowrap sticky left-0 bg-white z-10 shadow-xs">
                      <div>{a.appointment_number}</div>
                      {a.serial_code && (
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded font-bold inline-block mt-0.5 whitespace-nowrap">
                          {a.serial_code}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">{a.patient_name}</td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs font-medium whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {a.doctor_avatar ? (
                          <img src={a.doctor_avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-slate-200 shrink-0" />
                        ) : null}
                        <span className="truncate">{a.doctor_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {new Date(a.start_time).toLocaleDateString()}{" "}
                      {new Date(a.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500 max-w-[200px] truncate">{a.reason_for_visit || "General"}</td>
                    <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(a.status)}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 shrink-0">
                        {a.status === "SCHEDULED" && (
                          <button
                            onClick={() => checkInMutation.mutate(a.id)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-xs font-semibold transition whitespace-nowrap shrink-0"
                          >
                            Check In
                          </button>
                        )}
                        {a.status !== "COMPLETED" && a.status !== "CANCELLED" && (
                          <button
                            onClick={() => cancelMutation.mutate(a.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition shrink-0"
                            title="Cancel Booking"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
