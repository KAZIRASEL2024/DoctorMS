"use client";

import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { BackButton } from "@/components/ui/back-button";
import {
  FlaskConical,
  Upload,
  FileText,
  Download,
  Eye,
  Trash2,
  Search,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  X,
  User,
  Calendar,
  Clock,
  Filter,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";

interface LabReportItem {
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

interface PatientOption {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
}

const CATEGORIES = [
  "All",
  "Hematology",
  "Biochemistry",
  "Radiology / Imaging",
  "Microbiology",
  "Pathology",
  "Immunology",
  "Cardiology",
];

const COMMON_TESTS = [
  { name: "Complete Blood Count (CBC)", category: "Hematology" },
  { name: "Lipid Profile (Cholesterol, Triglycerides)", category: "Biochemistry" },
  { name: "HbA1c & Fasting Plasma Glucose", category: "Biochemistry" },
  { name: "Renal Function Test (Serum Creatinine, Urea)", category: "Biochemistry" },
  { name: "Liver Function Test (SGPT, SGOT, Bilirubin)", category: "Biochemistry" },
  { name: "Chest X-Ray (PA View)", category: "Radiology / Imaging" },
  { name: "Thyroid Function Test (TSH, FT4)", category: "Biochemistry" },
  { name: "Urine Routine & Microscopic Examination", category: "Microbiology" },
];

export default function LabReportsDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [customMrn, setCustomMrn] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [testName, setTestName] = useState("");
  const [testCategory, setTestCategory] = useState("Hematology");
  const [testDate, setTestDate] = useState(new Date().toISOString().split("T")[0]);
  const [remarks, setRemarks] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete Confirmation State
  const [deletingReport, setDeletingReport] = useState<LabReportItem | null>(null);

  // Query Lab Reports
  const {
    data: reports = [],
    isLoading,
    refetch,
  } = useQuery<LabReportItem[]>({
    queryKey: ["lab-reports", searchTerm],
    queryFn: () =>
      apiClient<LabReportItem[]>("/lab-reports", {
        params: searchTerm.trim() ? { search: searchTerm.trim() } : undefined,
      }),
  });

  // Query Patients list for selector
  const { data: patients = [] } = useQuery<PatientOption[]>({
    queryKey: ["patients-selector"],
    queryFn: () => apiClient<PatientOption[]>("/patients?limit=200"),
    enabled: showUploadModal,
  });

  // Filtered patients for dropdown search
  const filteredPatients = patients.filter((p) => {
    if (!patientSearch.trim()) return true;
    const q = patientSearch.toLowerCase();
    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    return (
      fullName.includes(q) ||
      (p.mrn && p.mrn.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
  });

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return apiClient<any>("/lab-reports", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-reports"] });
      setShowUploadModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setUploadError(err.message || "Failed to upload lab report. Please check file format and try again.");
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (reportId: string) => {
      return apiClient<any>(`/lab-reports/${reportId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-reports"] });
      setDeletingReport(null);
    },
    onError: (err: any) => {
      alert("Failed to delete report: " + (err.message || "Unknown error"));
    },
  });

  const resetForm = () => {
    setSelectedPatientId("");
    setCustomMrn("");
    setPatientSearch("");
    setTestName("");
    setTestCategory("Hematology");
    setTestDate(new Date().toISOString().split("T")[0]);
    setRemarks("");
    setSelectedFile(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setUploadError("Invalid file type. Please upload a PDF document (.pdf).");
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setUploadError(null);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!selectedPatientId && !customMrn.trim()) {
      setUploadError("Please select an enrolled patient or provide a valid Patient MRN.");
      return;
    }
    if (!testName.trim()) {
      setUploadError("Please enter the test or investigation name.");
      return;
    }
    if (!selectedFile) {
      setUploadError("Please select a diagnostic PDF report file to upload.");
      return;
    }

    const formData = new FormData();
    if (selectedPatientId) {
      formData.append("patient_id", selectedPatientId);
    }
    if (customMrn.trim()) {
      formData.append("patient_mrn", customMrn.trim());
    }
    formData.append("test_name", testName.trim());
    formData.append("test_category", testCategory);
    formData.append("test_date", testDate);
    if (remarks.trim()) {
      formData.append("remarks", remarks.trim());
    }
    formData.append("file", selectedFile);

    uploadMutation.mutate(formData);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredReports = reports.filter((r) => {
    if (selectedCategory === "All") return true;
    return r.test_category?.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  const isAuthorizedToUpload = Boolean(
    user?.system_role === "SUPER_ADMIN" ||
    user?.system_role === "LAB_ASSISTANT" ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "LAB_ASSISTANT" ||
    user?.role === "CLINIC_ADMIN"
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-emerald-600" />
              Diagnostic Lab Reports & EMR
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Upload verified laboratory PDF reports linked to Patient MRN and manage clinical diagnostic history.
            </p>
          </div>
        </div>

        {isAuthorizedToUpload && (
          <button
            onClick={() => {
              resetForm();
              setShowUploadModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
          >
            <Upload className="w-4 h-4" />
            <span>Upload PDF Lab Report</span>
          </button>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Reports</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{reports.length}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Digitally Archival</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Hematology & Blood</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {reports.filter((r) => r.test_category?.toLowerCase().includes("hematology")).length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">CBC & Blood Profiles</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Biochemistry & Panels</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {reports.filter((r) => r.test_category?.toLowerCase().includes("biochemistry")).length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Lipids, RFT, LFT, Sugar</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Radiology & Imaging</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {reports.filter((r) => r.test_category?.toLowerCase().includes("radiology")).length}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">X-Ray, Ultrasound, CT</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Eye className="w-6 h-6" />
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
              placeholder="Search by Report Code (LAB-2026-...), Patient Name, MRN, or Test Name..."
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

        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition border ${selectedCategory === cat
                ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lab Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading diagnostic lab reports...</div>
        ) : filteredReports.length === 0 ? (
          <div className="py-16 text-center px-4">
            <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No diagnostic lab reports found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchTerm || selectedCategory !== "All"
                ? "No reports match your current search or category filter. Try clearing filters."
                : "No diagnostic lab reports uploaded yet. Click 'Upload PDF Lab Report' to add the first record."}
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Report Code</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Patient Details</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Investigation / Test</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Category</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Test Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Uploaded By</th>
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

                    {/* Patient Name & MRN */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{report.patient_name}</div>
                      <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                        <span className="text-emerald-700 font-medium">MRN: {report.patient_mrn}</span>
                        {report.patient_phone && <span>• {report.patient_phone}</span>}
                      </div>
                    </td>

                    {/* Test Name & Remarks */}
                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="font-medium text-slate-900">{report.test_name}</div>
                      {report.remarks && (
                        <div className="text-xs text-slate-500 truncate mt-0.5" title={report.remarks}>
                          {report.remarks}
                        </div>
                      )}
                    </td>

                    {/* Category Badge */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {report.test_category || "General Pathology"}
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

                    {/* Uploaded By */}
                    <td className="py-3.5 px-4 text-xs text-slate-600 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{report.uploaded_by_name || "Diagnostic Staff"}</div>
                      <div className="text-[10px] text-slate-500 uppercase">{report.uploaded_by_role || "LAB_ASSISTANT"}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {report.pdf_url && (
                          <>
                            <button
                              onClick={() => {
                                setPreviewPdfUrl(report.pdf_url);
                                setPreviewTitle(`${report.test_name} - ${report.patient_name} (${report.report_code})`);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                              title="Preview PDF"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>

                            <a
                              href={report.pdf_url}
                              download={`${report.report_code}_${report.test_name.replace(/\s+/g, "_")}.pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>PDF</span>
                            </a>
                          </>
                        )}

                        {isAuthorizedToUpload && (
                          <button
                            onClick={() => setDeletingReport(report)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                            title="Delete Report"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* UPLOAD PDF LAB REPORT MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[95vw] max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Upload PDF Lab Report</h3>
                  <p className="text-xs text-slate-500">
                    Attach diagnostic test document linked to Patient MRN for instant patient portal access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Patient Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Patient *</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search patient by Name, MRN, or Phone..."
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <select
                    value={selectedPatientId}
                    onChange={(e) => {
                      setSelectedPatientId(e.target.value);
                      if (e.target.value) setCustomMrn("");
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- Choose Enrolled Patient --</option>
                    {filteredPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.mrn || "No MRN"} • {p.phone || "No phone"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span>Or enter custom Patient MRN:</span>
                  <input
                    type="text"
                    value={customMrn}
                    onChange={(e) => {
                      setCustomMrn(e.target.value);
                      if (e.target.value) setSelectedPatientId("");
                    }}
                    placeholder="e.g. MRN-2026-0001"
                    className="px-2 py-1 border border-slate-200 rounded-lg text-xs font-mono w-40 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Test Selection Pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Common Tests Quick-Select</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_TESTS.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        setTestName(t.name);
                        setTestCategory(t.category);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 transition"
                    >
                      {t.name.split(" ")[0]} ({t.category.split(" ")[0]})
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Name & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Investigation / Test Name *</label>
                  <input
                    type="text"
                    required
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g. Complete Blood Count (CBC)"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Diagnostic Category *</label>
                  <select
                    value={testCategory}
                    onChange={(e) => setTestCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Hematology">Hematology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Radiology / Imaging">Radiology / Imaging</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Pathology">Pathology</option>
                    <option value="Immunology">Immunology</option>
                    <option value="Cardiology">Cardiology</option>
                  </select>
                </div>
              </div>

              {/* Test Date & File */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test / Investigation Date *</label>
                  <input
                    type="date"
                    required
                    value={testDate}
                    onChange={(e) => setTestDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select PDF File *</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    required
                    onChange={handleFileChange}
                    className="w-full p-1.5 border border-slate-200 rounded-xl text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                  />
                </div>
              </div>

              {/* Selected File Feedback */}
              {selectedFile && (
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span className="font-medium truncate max-w-xs">{selectedFile.name}</span>
                    <span className="text-[11px] text-emerald-600">
                      ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              )}

              {/* Remarks / Clinical Findings */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Remarks / Result Summary</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Hemoglobin 13.8 g/dL (Normal). Platelets 240,000 /mcL. No abnormal blasts seen."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Uploading PDF...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload & Link to Patient</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {/* DELETE CONFIRMATION MODAL */}
      {deletingReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-slate-900">Delete Lab Report?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong className="text-slate-800">{deletingReport.test_name}</strong> (
                {deletingReport.report_code}) for <strong className="text-slate-800">{deletingReport.patient_name}</strong>?
                This action is permanent and logged in the system audit trail.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingReport(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingReport.id)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-sm font-semibold transition flex-1 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

