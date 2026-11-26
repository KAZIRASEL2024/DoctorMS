"use client";

import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  FileText,
  Printer,
  Download,
  Search,
  ShieldCheck,
  Stethoscope,
  Pill,
  Bed,
  Calendar,
  User,
} from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";

export default function PrescriptionsHistoryPage() {
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const isPatient = user?.system_role === "PATIENT";

  const { data: rawPrescriptions = [], isLoading } = useQuery({
    queryKey: ["prescriptions-list"],
    queryFn: () => apiClient<any[]>("/prescriptions"),
    refetchInterval: 10000,
  });

  const prescriptions = useMemo(() => {
    if (!Array.isArray(rawPrescriptions)) return [];
    if (!search.trim()) return rawPrescriptions;
    const q = search.toLowerCase();
    return rawPrescriptions.filter(
      (rx: any) =>
        rx.prescription_code?.toLowerCase().includes(q) ||
        rx.patient_name?.toLowerCase().includes(q) ||
        rx.patient_mrn?.toLowerCase().includes(q) ||
        rx.doctor_name?.toLowerCase().includes(q) ||
        rx.diagnosis?.toLowerCase().includes(q)
    );
  }, [rawPrescriptions, search]);

  const handlePrint = (rxId: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
    window.open(`/api/v1/prescriptions/${rxId}/print-html?token=${token || ""}`, "_blank");
  };

  const handleDownload = async (rxId: string, code: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      const activeClinicId = typeof window !== "undefined" ? localStorage.getItem("active_clinic_id") : "";
      const res = await fetch(`/api/v1/prescriptions/${rxId}/pdf?token=${token || ""}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(activeClinicId ? { "X-Clinic-ID": activeClinicId } : {}),
        },
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${code || "prescription"}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : "";
      window.open(`/api/v1/prescriptions/${rxId}/pdf?token=${token || ""}`, "_blank");
    }
  };

  const getBedBadge = (bed: string) => {
    const b = (bed || "").toUpperCase();
    if (b.includes("ICU")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          🚨 {bed.includes("[") ? bed : "ICU Unit"}
        </span>
      );
    }
    if (b.includes("CCU")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          💓 {bed.includes("[") ? bed : "CCU Unit"}
        </span>
      );
    }
    if (b.includes("CABIN")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          🚪 {bed.includes("[") ? bed : "Private Cabin"}
        </span>
      );
    }
    if (b.includes("BED")) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          🛏️ {bed.includes("[") ? bed : "General Ward Bed"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
        🩺 OPD
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref={isPatient ? "/patient/dashboard" : "/dashboard"} />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100/60">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              {isPatient ? "My Digital Prescriptions (E-Rx)" : "Issued Digital Prescriptions (E-Rx)"}
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Official digitally signed prescriptions with cryptographic QR verification proofs and printable letterheads.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search Bar & Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by RX Code, Patient, Doctor, or MRN..."
              className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-600 font-medium">
            Total E-Rx Records: <strong className="text-slate-900">{prescriptions.length}</strong>
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Loading digital prescriptions...</p>
          </div>
        ) : prescriptions.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No prescriptions found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search
                ? `No results matching "${search}". Try adjusting your keywords.`
                : "No electronic prescriptions have been issued yet for this account."}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[750px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">RX Code</th>
                  <th className="py-3 px-4 whitespace-nowrap">Patient Profile</th>
                  <th className="py-3 px-4 whitespace-nowrap">Consultant Physician</th>
                  <th className="py-3 px-4 whitespace-nowrap">Diagnosis & Facility</th>
                  <th className="py-3 px-4 whitespace-nowrap">Medications</th>
                  <th className="py-3 px-4 whitespace-nowrap">Date Issued</th>
                  <th className="py-3 px-4 whitespace-nowrap">QR Verification</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prescriptions.map((rx: any) => (
                  <tr key={rx.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* RX Code */}
                    <td className="py-3.5 px-4 tabular-nums font-bold text-emerald-700 text-xs whitespace-nowrap sticky left-0 bg-white z-10 shadow-xs">
                      {rx.prescription_code}
                    </td>

                    {/* Patient */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 text-xs">{rx.patient_name}</div>
                      <div className="text-[11px] text-slate-600 tabular-nums flex items-center gap-2">
                        <span>{rx.patient_mrn}</span>
                        {rx.patient_age && <span>• {rx.patient_age} yrs</span>}
                        {rx.patient_gender && <span>({rx.patient_gender[0]})</span>}
                      </div>
                    </td>

                    {/* Doctor */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-semibold text-slate-900">{rx.doctor_name}</div>
                      <div className="text-[11px] text-emerald-700 font-medium">{rx.doctor_specialization}</div>
                    </td>

                    {/* Diagnosis & Facility */}
                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-slate-900 line-clamp-1">
                        {rx.diagnosis || "Clinical Consultation"}
                      </div>
                      <div className="mt-1">{getBedBadge(rx.bed_assignment || rx.diet_instructions)}</div>
                    </td>

                    {/* Medications */}
                    <td className="py-3.5 px-4 text-xs font-medium text-slate-800">
                      <div className="flex items-center gap-1.5 text-slate-900 font-semibold">
                        <Pill className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{rx.items_count || rx.items?.length || 0} Medications</span>
                      </div>
                      {rx.items && rx.items.length > 0 && (
                        <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">
                          {rx.items.map((i: any) => i.medicine_name).join(", ")}
                        </div>
                      )}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {rx.created_at ? new Date(rx.created_at).toLocaleDateString() : "Today"}
                    </td>

                    {/* QR Verification Proof */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/verify-rx?code=${rx.verification_hash}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition whitespace-nowrap"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Verified E-Rx</span>
                      </Link>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handlePrint(rx.id)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-emerald-200 transition shadow-xs cursor-pointer"
                          title="Print Clinical Letterhead"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(rx.id, rx.prescription_code)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="Download A4 PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
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
