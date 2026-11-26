"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Patient, LabReport } from "@/types";
import { CredentialsModal, UserCredentialsTarget } from "@/components/admin/credentials-modal";
import {
  UserPlus,
  Search,
  Calendar,
  Phone,
  AlertCircle,
  FileText,
  User,
  Eye,
  X,
  Printer,
  Download,
  FlaskConical,
  Upload,
  Plus,
  Heart,
  Activity,
  CheckCircle2,
  ExternalLink,
  Clock,
  MapPin,
  ShieldCheck,
  KeyRound,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";

export default function PatientsListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [showAddLabModal, setShowAddLabModal] = useState(false);

  // New Lab Report Form State
  const [newTestName, setNewTestName] = useState("CBC (Complete Blood Count)");
  const [newTestCategory, setNewTestCategory] = useState("Hematology");
  const [newTestDate, setNewTestDate] = useState(new Date().toISOString().split("T")[0]);
  const [newResultSummary, setNewResultSummary] = useState("");
  const [newLabName, setNewLabName] = useState("Metro Diagnostic & Clinical Laboratory");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isSubmittingLab, setIsSubmittingLab] = useState(false);
  const [expandedLabId, setExpandedLabId] = useState<string | null>(null);

  // Credentials Modal State (Super Admin)
  const [credTarget, setCredTarget] = useState<UserCredentialsTarget | null>(null);
  const [showCredModal, setShowCredModal] = useState(false);

  // Fetch Patients (Server automatically scopes to logged-in Doctor's patients or Super Admin's all clinic patients)
  const { data: patients = [], isLoading } = useQuery({
    queryKey: ["patients", search],
    queryFn: () =>
      apiClient<Patient[]>("/patients", {
        params: { search: search || undefined, limit: 50 },
      }),
  });

  // Fetch Clinical Summary when a patient is selected for "View"
  const {
    data: clinicalSummary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["patient-clinical-summary", selectedPatientId],
    queryFn: () => apiClient<any>(`/patients/${selectedPatientId}/clinical-summary`),
    enabled: !!selectedPatientId,
  });

  const handleAddLabReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setIsSubmittingLab(true);

    try {
      if (uploadedFile) {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        formData.append("test_name", newTestName);
        formData.append("test_category", newTestCategory);
        formData.append("test_date", newTestDate);
        formData.append(
          "result_summary",
          newResultSummary || `Uploaded ${uploadedFile.name} for diagnostic review.`
        );

        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token") || localStorage.getItem("token")
            : "";
        const res = await fetch(`/api/v1/patients/${selectedPatientId}/lab-reports/upload`, {
          method: "POST",
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        if (!res.ok) throw new Error("Failed to upload lab report PDF");
      } else {
        await apiClient(`/patients/${selectedPatientId}/lab-reports`, {
          method: "POST",
          body: JSON.stringify({
            test_name: newTestName,
            test_category: newTestCategory,
            test_date: newTestDate,
            result_summary: newResultSummary || "Clinical investigation conducted and verified.",
            lab_name: newLabName,
            status: "Completed",
          }),
        });
      }

      setShowAddLabModal(false);
      setUploadedFile(null);
      setNewResultSummary("");
      refetchSummary();
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    } catch (err: any) {
      alert(err.message || "Failed to create lab report");
    } finally {
      setIsSubmittingLab(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <User className="w-6 h-6 text-emerald-600" />
              Patient Records & Medical Histories
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Patients under your care, medical histories, and diagnostic lab reports.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/patients/new"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition"
        >
          <UserPlus className="w-4 h-4" /> Register New Patient
        </Link>
      </div>

      {/* Patients Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="relative w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Patient Name, Phone, or MRN..."
              className="w-full pl-9 pr-4 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <span className="text-xs text-slate-600 font-medium">
            Total Patients Under Care: <strong className="text-slate-900">{patients.length}</strong>
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-400">Loading patients directory...</div>
        ) : patients.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            <User className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <div className="font-semibold text-slate-700">No patients under active care found</div>
            <p className="text-xs text-slate-400 mt-1">
              Patients will appear here once they book an appointment, consult, or receive a prescription from you.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[750px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                  <th className="py-3 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">MRN</th>
                  <th className="py-3 px-4 whitespace-nowrap">Patient Name</th>
                  <th className="py-3 px-4 whitespace-nowrap">Gender & DOB</th>
                  <th className="py-3 px-4 whitespace-nowrap">Blood Group</th>
                  <th className="py-3 px-4 whitespace-nowrap">Contact Phone</th>
                  <th className="py-3 px-4 whitespace-nowrap">Allergies</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.map((p) => {
                const labCount = p.lab_reports_count || 0;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 tabular-nums font-bold text-emerald-700 text-xs sticky left-0 bg-white z-10 shadow-xs">{p.mrn}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">
                        {p.first_name} {p.last_name}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{p.email || "No login email"}</span>
                      </div>
                      {labCount > 0 && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <FlaskConical className="w-3 h-3 text-emerald-600" />
                            {labCount} Lab Report{labCount > 1 ? "s" : ""}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-600">
                      {p.gender} • {p.date_of_birth}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        {p.blood_group}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-600">{p.phone}</td>
                    <td className="py-3.5 px-4 text-xs">
                      {p.allergies && p.allergies.length > 0 ? (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          {p.allergies.join(", ")}
                        </span>
                      ) : (
                        <span className="text-slate-400">None reported</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCredTarget({
                              userId: p.user_id,
                              patientId: p.id,
                              name: `${p.first_name} ${p.last_name}`.trim(),
                              email: p.email || "",
                              role: "PATIENT",
                              identifier: p.mrn,
                            });
                            setShowCredModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition cursor-pointer"
                          title="Manage Login Email & Password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Credentials</span>
                        </button>
                        <button
                          onClick={() => setSelectedPatientId(p.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
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

      {/* Patient Details & Lab Reports Clinical Summary Modal */}
      {selectedPatientId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl w-[94vw] max-w-4xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[88vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                  {clinicalSummary?.patient?.first_name?.[0] || "P"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">
                      {clinicalSummary?.patient
                        ? `${clinicalSummary.patient.first_name} ${clinicalSummary.patient.last_name}`
                        : "Patient Clinical Summary"}
                    </h2>
                    {clinicalSummary?.patient?.mrn && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {clinicalSummary.patient.mrn}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Comprehensive Electronic Medical Record • Lab Reports & Consultations
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatientId(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Scrollable */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {isSummaryLoading ? (
                <div className="py-20 text-center text-slate-400 space-y-3">
                  <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm">Loading clinical history & diagnostic lab reports...</p>
                </div>
              ) : clinicalSummary ? (
                <>
                  {/* Patient Demographics & Baseline Card */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block font-medium">Age & Gender</span>
                        <strong className="text-slate-800 text-sm">
                          {clinicalSummary.patient.age} • {clinicalSummary.patient.gender}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Blood Group</span>
                        <strong className="text-rose-600 text-sm font-bold">
                          {clinicalSummary.patient.blood_group}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Contact Phone</span>
                        <strong className="text-slate-800 text-sm font-mono">
                          {clinicalSummary.patient.phone}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Email Address</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <strong className="text-slate-800 text-xs truncate block">
                            {clinicalSummary.patient.email || "Not specified"}
                          </strong>
                          <button
                            type="button"
                            onClick={() => {
                              setCredTarget({
                                userId: clinicalSummary.patient.user_id,
                                patientId: clinicalSummary.patient.id,
                                name: `${clinicalSummary.patient.first_name} ${clinicalSummary.patient.last_name}`.trim(),
                                email: clinicalSummary.patient.email || "",
                                role: "PATIENT",
                                identifier: clinicalSummary.patient.mrn,
                              });
                              setShowCredModal(true);
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-emerald-700 transition"
                            title="Manage Email & Password"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-200/80">
                      <div>
                        <span className="text-slate-400 block font-medium">Address</span>
                        <span className="text-slate-700">
                          {clinicalSummary.patient.address_line || "Chamber / Local Residence"}, {clinicalSummary.patient.city || "Dhaka"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Emergency Contact</span>
                        <span className="text-slate-700">
                          {clinicalSummary.patient.emergency_contact_name || "N/A"}{" "}
                          {clinicalSummary.patient.emergency_contact_phone && `(${clinicalSummary.patient.emergency_contact_phone})`}
                        </span>
                      </div>
                    </div>

                    {/* Allergies & Chronic Conditions */}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className="text-xs font-semibold text-slate-500 mr-1">Alerts:</span>
                      {clinicalSummary.patient.allergies && clinicalSummary.patient.allergies.length > 0 ? (
                        clinicalSummary.patient.allergies.map((alg: string, idx: number) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200"
                          >
                            <AlertCircle className="w-3 h-3 text-rose-600" />
                            Allergy: {alg}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">No drug allergies reported</span>
                      )}

                      {clinicalSummary.patient.chronic_conditions?.map((c: string, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200/70 text-slate-700"
                        >
                          {c}
                        </span>
                      ))}

                      {clinicalSummary.active_unit && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Activity className="w-3.5 h-3.5 text-emerald-600" />
                          Admitted: {clinicalSummary.active_unit.unit_name} ({clinicalSummary.active_unit.category})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Section 1: Diagnostic Lab Test Reports */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-base text-slate-900">
                          Diagnostic Lab Test Reports ({clinicalSummary.lab_reports?.length || 0})
                        </h3>
                      </div>
                      <button
                        onClick={() => setShowAddLabModal(true)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                      >
                        <Plus className="w-3.5 h-3.5" /> + Add / Upload Lab Report
                      </button>
                    </div>

                    {clinicalSummary.lab_reports?.length === 0 ? (
                      <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                        No laboratory diagnostic test reports on file for this patient yet. Click "+ Add / Upload Lab Report" to add test findings or upload a PDF.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clinicalSummary.lab_reports.map((report: any) => {
                          const isExpanded = expandedLabId === report.id;
                          const findings: any[] = report.findings_json || [];

                          return (
                            <div
                              key={report.id}
                              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:border-emerald-200 transition space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-sm text-slate-900">{report.test_name}</h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      {report.test_category}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      ✓ {report.status}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                                    <span>Date: {report.test_date}</span>
                                    <span>•</span>
                                    <span>{report.lab_name}</span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  {findings.length > 0 && (
                                    <button
                                      onClick={() => setExpandedLabId(isExpanded ? null : report.id)}
                                      className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                                    >
                                      {isExpanded ? "Hide Parameters" : `View ${findings.length} Parameters`}
                                    </button>
                                  )}

                                  {/* View / Download Printable Lab PDF Button */}
                                  <a
                                    href={report.print_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>View / Download PDF</span>
                                  </a>
                                </div>
                              </div>

                              {/* Summary interpretation */}
                              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
                                <strong>Clinical Impression:</strong> {report.result_summary}
                              </div>

                              {/* Expandable Parameter Findings Table */}
                              {isExpanded && findings.length > 0 && (
                                <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
                                  <table className="w-full text-left">
                                    <thead className="bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase">
                                      <tr>
                                        <th className="py-2 px-3">Parameter</th>
                                        <th className="py-2 px-3">Result</th>
                                        <th className="py-2 px-3">Unit</th>
                                        <th className="py-2 px-3">Normal Range</th>
                                        <th className="py-2 px-3 text-right">Flag</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                      {findings.map((f: any, idx: number) => {
                                        const flag = (f.flag || "NORMAL").toUpperCase();
                                        const isAbnormal = flag === "HIGH" || flag === "LOW";
                                        return (
                                          <tr key={idx} className={isAbnormal ? "bg-rose-50/40" : ""}>
                                            <td className="py-2 px-3 font-medium text-slate-900">{f.parameter}</td>
                                            <td className={`py-2 px-3 font-mono font-bold ${isAbnormal ? "text-rose-600" : "text-slate-800"}`}>
                                              {f.result}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500">{f.unit}</td>
                                            <td className="py-2 px-3 text-slate-600">{f.normal_range}</td>
                                            <td className="py-2 px-3 text-right">
                                              <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                  isAbnormal
                                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                }`}
                                              >
                                                {flag}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {report.report_file_url && (
                                <div className="text-xs text-emerald-700 flex items-center gap-1.5 pt-1">
                                  <span>📎 Attached File:</span>
                                  <a
                                    href={report.report_file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-semibold underline hover:text-emerald-900"
                                  >
                                    Open Original Uploaded Document ↗
                                  </a>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Section 2: Consultation & Prescription History */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-bold text-base text-slate-900">
                        Consultation & Prescription History ({clinicalSummary.prescriptions?.length || 0})
                      </h3>
                    </div>

                    {clinicalSummary.prescriptions?.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                        No prior prescriptions recorded under this doctor.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clinicalSummary.prescriptions.map((rx: any) => (
                          <div
                            key={rx.id}
                            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                  {rx.prescription_code}
                                </span>
                                <h4 className="font-bold text-sm text-slate-900">{rx.diagnosis}</h4>
                              </div>
                              <p className="text-xs text-slate-500 mt-1">
                                Issued: {rx.created_at ? new Date(rx.created_at).toLocaleDateString() : "Recent"} • {rx.items_count} Medicine(s)
                              </p>
                              {rx.medications && rx.medications.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {rx.medications.map((m: string, i: number) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md text-[11px] bg-slate-100 text-slate-700">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <a
                              href={rx.print_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-1.5 shrink-0 transition"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Prescription PDF</span>
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">DoctorMS Clinical EMR • Doctor's Patient View</span>
              <button
                onClick={() => setSelectedPatientId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Modal: Add / Upload New Lab Report */}
      {showAddLabModal && selectedPatientId && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-slate-900">Add / Upload Diagnostic Lab Report</h3>
              </div>
              <button onClick={() => setShowAddLabModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLabReport} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Investigation / Test Name</label>
                <input
                  type="text"
                  required
                  value={newTestName}
                  onChange={(e) => setNewTestName(e.target.value)}
                  placeholder="e.g. CBC, Serum Creatinine, Chest X-Ray, ECG, Lipid Profile..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category / Discipline</label>
                  <select
                    value={newTestCategory}
                    onChange={(e) => setNewTestCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Radiology">Radiology & Imaging</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Pathology">General Pathology</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Test / Sample Date</label>
                  <input
                    type="date"
                    required
                    value={newTestDate}
                    onChange={(e) => setNewTestDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Diagnostic Center / Lab Name</label>
                <input
                  type="text"
                  value={newLabName}
                  onChange={(e) => setNewLabName(e.target.value)}
                  placeholder="Metro Diagnostic & Clinical Laboratory"
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Result Summary & Clinical Impression</label>
                <textarea
                  rows={3}
                  required
                  value={newResultSummary}
                  onChange={(e) => setNewResultSummary(e.target.value)}
                  placeholder="Enter pathology findings, normal/abnormal parameters, and doctor's advice..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Optional: Attach Outside Lab Report PDF / Scanned Image
                </label>
                <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 text-center">
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  />
                  {uploadedFile && (
                    <div className="text-[11px] text-emerald-700 font-medium mt-1">
                      Selected: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddLabModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLab}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                >
                  {isSubmittingLab ? "Saving..." : "Save Lab Report"}
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
        onSuccess={() => refetchSummary()}
      />
    </div>
  );
}
