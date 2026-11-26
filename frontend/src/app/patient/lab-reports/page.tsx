"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { BackButton } from "@/components/ui/back-button";
import {
  FlaskConical,
  FileText,
  Download,
  Eye,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Clock,
  Filter,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Building2,
} from "lucide-react";

interface PatientLabReport {
  id: string;
  report_code: string;
  patient_id: string;
  patient_mrn: string;
  patient_name: string;
  patient_phone?: string;
  test_name: string;
  test_category: string;
  test_date: string;
  remarks?: string;
  pdf_url: string;
  uploaded_by_name?: string;
  uploaded_by_role?: string;
  created_at?: string;
}

const CATEGORIES = [
  "All",
  "Hematology",
  "Biochemistry",
  "Radiology / Imaging",
  "Microbiology",
  "Pathology",
  "Immunology",
];

export default function PatientLabReportsPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch patient's reports (backend auto-scopes to the authenticated patient)
  const {
    data: reports = [],
    isLoading,
    refetch,
  } = useQuery<PatientLabReport[]>({
    queryKey: ["patient-lab-reports", searchTerm],
    queryFn: () =>
      apiClient<PatientLabReport[]>("/lab-reports", {
        params: searchTerm.trim() ? { search: searchTerm.trim() } : undefined,
      }),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredReports = reports.filter((r) => {
    if (selectedCategory === "All") return true;
    return r.test_category?.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  const latestReport = reports.length > 0 ? reports[0] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/patient/dashboard" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-emerald-600" />
              Digital EMR & Diagnostic Lab Reports
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Access and download official diagnostic pathology & radiology PDF reports linked to your Patient MRN.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Verified Patient EMR</span>
          </span>
        </div>
      </div>

      {/* KPI / Diagnostic Highlights Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Lab Reports */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Diagnostic Records</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{reports.length}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Verified Laboratory PDFs</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>

        {/* Latest Test Completed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="max-w-[80%]">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Latest Investigation</p>
            <p className="text-base font-bold text-slate-900 mt-1 truncate">
              {latestReport ? latestReport.test_name : "None recorded"}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {latestReport
                ? new Date(latestReport.test_date).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Awaiting new results"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Diagnostic Laboratory Accreditation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Diagnostic Facility</p>
            <p className="text-sm font-bold text-slate-900 mt-1">Metro Clinical Lab</p>
            <p className="text-xs text-emerald-600 mt-0.5">Dhaka, Bangladesh</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Building2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tests by Report Code (LAB-2026-...), Test Name, or Category..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition border ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Reports List / Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading your diagnostic lab reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 text-center px-4">
            <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No diagnostic reports found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedCategory !== "All"
                ? "No diagnostic reports match your active search or filter. Try clearing filters."
                : "No diagnostic lab reports uploaded under your Patient MRN yet. When tests are completed by our clinical laboratory, they will appear here instantly."}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[750px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Report Code</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Investigation / Test</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Test Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Clinical Findings</th>
                  <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Report Code */}
                    <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                          {report.report_code}
                        </span>
                        <button
                          onClick={() => copyToClipboard(report.report_code)}
                          className="p-1 text-slate-400 hover:text-slate-700 transition"
                          title="Copy Report Code"
                        >
                          {copiedCode === report.report_code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Investigation / Test Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{report.test_name}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Uploaded by {report.uploaded_by_name || "Diagnostic Staff"}</span>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {report.test_category || "General"}
                      </span>
                    </td>

                    {/* Test Date */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 whitespace-nowrap">
                      <div className="font-medium">
                        {new Date(report.test_date).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                    </td>

                    {/* Findings / Remarks */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {report.remarks ? (
                        <p className="text-xs text-slate-600 truncate" title={report.remarks}>
                          {report.remarks}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-400">Diagnostic report completed</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {report.pdf_url && (
                          <>
                            <button
                              onClick={() => {
                                setPreviewPdfUrl(report.pdf_url);
                                setPreviewTitle(`${report.test_name} (${report.report_code})`);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            <a
                              href={report.pdf_url}
                              download={`${report.report_code}_${report.test_name.replace(/\s+/g, "_")}.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Download PDF</span>
                            </a>
                          </>
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

      {/* PDF PREVIEW MODAL */}
      {previewPdfUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-[95vw] max-w-4xl h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm sm:text-base text-slate-900 truncate max-w-lg">{previewTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Tab</span>
                </a>
                <a
                  href={previewPdfUrl}
                  download
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 flex items-center gap-1 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Embedded Iframe */}
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full rounded-xl border border-slate-200 bg-white"
                title="Lab Report PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

