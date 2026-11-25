"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DoctorLeave } from "@/types";
import {
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  Check,
  X,
  Stethoscope,
  AlertCircle,
  User,
} from "lucide-react";

export const DoctorLeaveApprovalCard: React.FC = () => {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Fetch all doctor leave requests
  const { data: leaves = [], isLoading } = useQuery<DoctorLeave[]>({
    queryKey: ["admin-doctor-leaves"],
    queryFn: () => apiClient<DoctorLeave[]>("/admin/leaves"),
    refetchInterval: 10000,
  });

  // Mutation: Approve or Reject Leave
  const updateStatusMutation = useMutation({
    mutationFn: (data: { leaveId: string; status: "APPROVED" | "REJECTED" | "PENDING" }) =>
      apiClient(`/admin/leaves/${data.leaveId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: data.status }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin-doctor-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["public-doctors"] });
      const actionLabel = vars.status === "APPROVED" ? "approved & confirmed" : "rejected";
      setActionSuccess(`Doctor leave request ${actionLabel} successfully!`);
      setTimeout(() => setActionSuccess(null), 4000);
    },
    onError: (err: any) => {
      alert("Failed to update leave status: " + (err.message || "Unknown error"));
    },
  });

  const pendingCount = leaves.filter((l) => l.status === "PENDING" || l.status === "Pending").length;

  const filteredLeaves = leaves.filter((l) => {
    if (filter === "ALL") return true;
    const s = (l.status || "").toUpperCase();
    if (filter === "PENDING") return s === "PENDING";
    if (filter === "APPROVED") return s === "APPROVED";
    if (filter === "REJECTED") return s === "REJECTED";
    return true;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <Calendar className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Doctor Leave Requests & Vacation Approvals</h2>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  {pendingCount} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review doctor time-off submissions. Approving a leave marks dates as blackouts to prevent patient booking conflicts.
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {[
            { id: "ALL", label: `All (${leaves.length})` },
            { id: "PENDING", label: `Pending (${pendingCount})` },
            { id: "APPROVED", label: "Confirmed" },
            { id: "REJECTED", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filter === tab.id
                  ? "bg-white text-slate-900 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Leave Requests Table */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading doctor leave requests...</div>
      ) : filteredLeaves.length === 0 ? (
        <div className="py-12 text-center bg-slate-50/60 rounded-2xl border border-slate-200/80">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-600">No leave requests found</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {filter === "PENDING"
              ? "All doctor leave requests have been reviewed."
              : "No doctor has submitted time-off under this filter."}
          </p>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-[700px] w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Doctor</th>
                <th className="py-3 px-4 whitespace-nowrap">Department</th>
                <th className="py-3 px-4 whitespace-nowrap">Leave Date Range</th>
                <th className="py-3 px-4 whitespace-nowrap">Duration</th>
                <th className="py-3 px-4 whitespace-nowrap">Reason</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Approval Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeaves.map((l) => {
                const isApproved = l.status === "APPROVED" || l.status === "Approved";
                const isRejected = l.status === "REJECTED" || l.status === "Rejected";
                const isPending = !isApproved && !isRejected;

                return (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Doctor Info */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        {l.doctor_avatar ? (
                          <img
                            src={l.doctor_avatar}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {l.doctor_name ? l.doctor_name.replace("Dr. ", "").charAt(0) : "D"}
                          </div>
                        )}
                        <span className="font-bold text-slate-900">{l.doctor_name || "Doctor"}</span>
                      </div>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {l.doctor_specialization || "General Medicine"}
                      </span>
                    </td>

                    {/* Leave Range */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {l.start_date} <span className="text-slate-400 font-normal">→</span> {l.end_date}
                    </td>

                    {/* Duration */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                      {l.total_days || 1} Day{l.total_days && l.total_days > 1 ? "s" : ""}
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 text-slate-700 font-medium max-w-[200px] truncate" title={l.reason}>
                      {l.reason}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {isApproved ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Leave Confirmed
                        </span>
                      ) : isRejected ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Approval
                        </span>
                      )}
                    </td>

                    {/* One-Click Approve / Reject Action Buttons */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 shrink-0">
                        {!isApproved && (
                          <button
                            type="button"
                            onClick={() => updateStatusMutation.mutate({ leaveId: l.id, status: "APPROVED" })}
                            disabled={updateStatusMutation.isPending}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition cursor-pointer"
                            title="Confirm & Approve Leave"
                          >
                            <Check className="w-3 h-3" />
                            <span>Approve Leave</span>
                          </button>
                        )}

                        {!isRejected && (
                          <button
                            type="button"
                            onClick={() => updateStatusMutation.mutate({ leaveId: l.id, status: "REJECTED" })}
                            disabled={updateStatusMutation.isPending}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Reject Leave Request"
                          >
                            <X className="w-3 h-3" />
                            <span>Reject</span>
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
  );
};
