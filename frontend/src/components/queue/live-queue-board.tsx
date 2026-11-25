"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { LiveQueueItem, DoctorProfile } from "@/types";
import { formatDoctorName } from "@/lib/utils";
import {
  Clock,
  User,
  Volume2,
  Stethoscope,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Tv,
} from "lucide-react";
import Link from "next/link";

export const LiveQueueBoard: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");

  // 1. Fetch Doctors for filter
  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => apiClient<DoctorProfile[]>("/doctors"),
  });

  // 2. Poll Live Queue (every 4 seconds for real-time responsiveness)
  const { data: queue = [], isLoading, isRefetching } = useQuery({
    queryKey: ["live-queue", selectedDoctorId],
    queryFn: () =>
      apiClient<LiveQueueItem[]>("/queue/live", {
        params: { doctor_id: selectedDoctorId || undefined },
      }),
    refetchInterval: 4000,
  });

  // 3. Action Mutations
  const callMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiClient(`/queue/${tokenId}/call`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-queue"] }),
  });

  const startMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiClient(`/queue/${tokenId}/start-consultation`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-queue"] }),
  });

  const completeMutation = useMutation({
    mutationFn: (tokenId: string) =>
      apiClient(`/queue/${tokenId}/complete`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["live-queue"] }),
  });

  const getStatusBadge = (status: LiveQueueItem["status"]) => {
    switch (status) {
      case "WAITING":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Waiting
          </span>
        );
      case "CALLED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 animate-pulse">
            Called to Desk
          </span>
        );
      case "WITH_DOCTOR":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
            In Consultation
          </span>
        );
      default:
        return null;
    }
  };

  const getWaitBadge = (minutes: number) => {
    if (minutes > 30) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
          <AlertTriangle className="w-3 h-3" /> {minutes} min
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
        <Clock className="w-3 h-3" /> {minutes} min
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            Live Waiting Room Queue Manager
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time queue tracking, token callouts, and doctor consultation progression.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-700 bg-white"
          >
            <option value="">All Doctors / Rooms</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDoctorName(d.first_name, d.last_name)} ({d.specialization})
              </option>
            ))}
          </select>

          <Link
            href="/queue/display"
            target="_blank"
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Tv className="w-4 h-4" /> Open TV Screen
          </Link>

          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["live-queue"] })}
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600"
            title="Refresh Queue"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Queue List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading live queue feed...</div>
        ) : queue.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400 mb-3">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="font-semibold text-slate-700 text-sm">Waiting Room is Empty</h4>
            <p className="text-xs text-slate-400 mt-1">
              No patients are currently checked in or waiting for consultation today.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[700px] w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Token</th>
                  <th className="py-3 px-4 whitespace-nowrap">Patient Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Consulting Doctor</th>
                  <th className="py-3 px-4 whitespace-nowrap">Wait Time</th>
                  <th className="py-3 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Queue Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {queue.map((item) => (
                  <tr
                    key={item.token_id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      item.status === "CALLED" ? "bg-emerald-50/40" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-base sticky left-0 bg-white z-10 shadow-xs">
                      {item.token_code}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {item.patient_name}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                      {item.doctor_name}
                    </td>
                    <td className="py-3.5 px-4">{getWaitBadge(item.wait_time_minutes)}</td>
                    <td className="py-3.5 px-4">{getStatusBadge(item.status)}</td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {item.status === "WAITING" && (
                          <button
                            onClick={() => callMutation.mutate(item.token_id)}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 border border-emerald-200 transition"
                          >
                            <Volume2 className="w-3.5 h-3.5" /> Call
                          </button>
                        )}

                        {item.status === "CALLED" && (
                          <button
                            onClick={() => startMutation.mutate(item.token_id)}
                            className="px-2.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition"
                          >
                            <Stethoscope className="w-3.5 h-3.5" /> Start Consult
                          </button>
                        )}

                        {item.status === "WITH_DOCTOR" && (
                          <button
                            onClick={() => completeMutation.mutate(item.token_id)}
                            className="px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1 transition"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Complete
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
};
