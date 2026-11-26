"use client";

import React, { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { BackButton } from "@/components/ui/back-button";
import {
  FlaskConical,
  PlusCircle,
  Search,
  Clock,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Droplet,
  Activity,
  Check,
  Copy,
  FileText,
  Upload,
  Download,
  Eye,
  ExternalLink,
  User,
  CreditCard,
  Filter,
  Receipt,
  FileCheck,
  ArrowRight,
} from "lucide-react";

interface LabTestItem {
  id: string;
  test_code: string;
  test_name: string;
  category: string;
  sample_type: string;
  price_bdt: number;
  report_delivery_time: string;
  is_active: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

interface PatientLabReportItem {
  id: string;
  order_code: string;
  patient_id: string;
  patient_name: string;
  patient_mrn?: string;
  patient_phone?: string;
  lab_test_id?: string;
  test_name: string;
  test_code?: string;
  fee_bdt: number;
  ordered_by_doctor?: string;
  status: "Sample Collected" | "Processing" | "Report Ready" | string;
  result_summary?: string;
  report_file_url?: string;
  invoice_id?: string;
  invoice_number?: string;
  invoice_payment_status?: string;
  created_at?: string;
  updated_at?: string;
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
  "Pathology",
  "Biochemistry",
  "Radiology & Imaging",
  "Cardiology",
];

const COMMON_DELIVERY_PRESETS = [
  "Instant (30 Mins)",
  "Same Day (2 Hours)",
  "Same Day (4 Hours)",
  "Same Day (6 Hours)",
  "1 Day",
  "2 Days",
];

const SAMPLE_TYPE_PRESETS = [
  "Blood",
  "Urine",
  "Imaging",
  "Non-Invasive",
  "Stool",
  "Swab",
  "Tissue",
];

export default function AdminLabTestsPage() {
  const queryClient = useQueryClient();

  // Active Segmented Tab
  const [activeTab, setActiveTab] = useState<"CATALOG" | "ORDERS">("CATALOG");

  // ==========================================
  // TAB 1: TEST CATALOG STATE
  // ==========================================
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editingTest, setEditingTest] = useState<LabTestItem | null>(null);
  const [deletingTest, setDeletingTest] = useState<LabTestItem | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [testCode, setTestCode] = useState("");
  const [testName, setTestName] = useState("");
  const [category, setCategory] = useState("Pathology");
  const [sampleType, setSampleType] = useState("Blood");
  const [priceBdt, setPriceBdt] = useState<number>(500);
  const [reportDeliveryTime, setReportDeliveryTime] = useState("Same Day (4 Hours)");
  const [isActive, setIsActive] = useState(true);
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // ==========================================
  // TAB 2: PATIENT LAB ORDERS STATE
  // ==========================================
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignPatientId, setAssignPatientId] = useState("");
  const [assignPatientSearch, setAssignPatientSearch] = useState("");
  const [assignLabTestId, setAssignLabTestId] = useState("");
  const [assignDoctorName, setAssignDoctorName] = useState("Dr. John Smith");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignError, setAssignError] = useState<string | null>(null);

  // Update / Upload Report Modal
  const [updatingReport, setUpdatingReport] = useState<PatientLabReportItem | null>(null);
  const [reportStatus, setReportStatus] = useState<string>("Report Ready");
  const [resultSummary, setResultSummary] = useState("");
  const [selectedReportFile, setSelectedReportFile] = useState<File | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF Preview Modal
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  // ==========================================
  // QUERIES
  // ==========================================
  const { data: tests = [], isLoading: isLoadingTests } = useQuery<LabTestItem[]>({
    queryKey: ["admin-lab-tests"],
    queryFn: () => apiClient<LabTestItem[]>("/admin/lab-tests"),
  });

  const { data: patientReports = [], isLoading: isLoadingReports } = useQuery<PatientLabReportItem[]>({
    queryKey: ["admin-patient-lab-reports", orderSearch, orderStatusFilter],
    queryFn: () =>
      apiClient<PatientLabReportItem[]>("/admin/patient-lab-reports", {
        params: {
          search: orderSearch.trim() || undefined,
          status: orderStatusFilter !== "ALL" ? orderStatusFilter : undefined,
        },
      }),
  });

  const { data: patients = [] } = useQuery<PatientOption[]>({
    queryKey: ["patients-selector-lab"],
    queryFn: () => apiClient<PatientOption[]>("/patients?limit=200"),
    enabled: showAssignModal,
  });

  // Filtered patients for dropdown search
  const filteredPatients = useMemo(() => {
    if (!assignPatientSearch.trim()) return patients;
    const q = assignPatientSearch.toLowerCase();
    return patients.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      return name.includes(q) || p.mrn?.toLowerCase().includes(q) || p.phone?.includes(q);
    });
  }, [patients, assignPatientSearch]);

  // ==========================================
  // MUTATIONS (CATALOG)
  // ==========================================
  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiClient<LabTestItem>("/admin/lab-tests", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lab-tests"] });
      queryClient.invalidateQueries({ queryKey: ["public-lab-tests"] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to create lab test.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) =>
      apiClient<LabTestItem>(`/admin/lab-tests/${data.id}`, {
        method: "PUT",
        body: JSON.stringify(data.payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lab-tests"] });
      queryClient.invalidateQueries({ queryKey: ["public-lab-tests"] });
      setShowModal(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || "Failed to update lab test.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/admin/lab-tests/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lab-tests"] });
      queryClient.invalidateQueries({ queryKey: ["public-lab-tests"] });
      setDeletingTest(null);
    },
    onError: (err: any) => {
      alert("Failed to delete test: " + (err.message || "Unknown error"));
    },
  });

  // ==========================================
  // MUTATIONS (PATIENT LAB ORDERS)
  // ==========================================
  const assignOrderMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient<PatientLabReportItem>("/admin/patient-lab-reports", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-patient-lab-reports"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
      setShowAssignModal(false);
      resetAssignForm();
    },
    onError: (err: any) => {
      setAssignError(err.message || "Failed to assign diagnostic test.");
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, file, resultSummary, statusStr }: any) => {
      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        if (resultSummary) formData.append("result_summary", resultSummary);
        if (statusStr) formData.append("status_str", statusStr);
        return apiClient(`/admin/patient-lab-reports/${id}/upload`, {
          method: "POST",
          body: formData,
        });
      } else {
        return apiClient(`/admin/patient-lab-reports/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: statusStr,
            result_summary: resultSummary,
          }),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-patient-lab-reports"] });
      queryClient.invalidateQueries({ queryKey: ["patient-lab-reports"] });
      queryClient.invalidateQueries({ queryKey: ["lab-reports"] });
      setUpdatingReport(null);
      setSelectedReportFile(null);
      setResultSummary("");
      setUpdateError(null);
    },
    onError: (err: any) => {
      setUpdateError(err.message || "Failed to update diagnostic report.");
    },
  });

  // ==========================================
  // FORM HANDLERS
  // ==========================================
  const resetForm = () => {
    setEditingTest(null);
    setTestCode("");
    setTestName("");
    setCategory("Pathology");
    setSampleType("Blood");
    setPriceBdt(500);
    setReportDeliveryTime("Same Day (4 Hours)");
    setIsActive(true);
    setDescription("");
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    const highestNum = tests.reduce((max, t) => {
      const match = t.test_code.match(/LAB-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 0);
    const nextCode = `LAB-${String(highestNum + 1).padStart(2, "0")}`;
    setTestCode(nextCode);
    setShowModal(true);
  };

  const openEditModal = (t: LabTestItem) => {
    setEditingTest(t);
    setTestCode(t.test_code);
    setTestName(t.test_name);
    setCategory(t.category);
    setSampleType(t.sample_type);
    setPriceBdt(t.price_bdt);
    setReportDeliveryTime(t.report_delivery_time);
    setIsActive(t.is_active);
    setDescription(t.description || "");
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmitTest = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!testName.trim()) {
      setFormError("Test investigation name is required.");
      return;
    }

    const payload = {
      test_code: testCode.trim() ? testCode.trim().toUpperCase() : undefined,
      test_name: testName.trim(),
      name: testName.trim(),
      category: category.trim(),
      department: category.trim(),
      sample_type: sampleType.trim(),
      price_bdt: Number(priceBdt),
      fee_bdt: Number(priceBdt),
      report_delivery_time: reportDeliveryTime.trim(),
      is_active: isActive,
      description: description.trim() || undefined,
    };

    if (editingTest) {
      updateMutation.mutate({ id: editingTest.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const resetAssignForm = () => {
    setAssignPatientId("");
    setAssignPatientSearch("");
    setAssignLabTestId("");
    setAssignDoctorName("Dr. John Smith");
    setAssignNotes("");
    setAssignError(null);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError(null);

    if (!assignPatientId) {
      setAssignError("Please select a patient to assign this investigation to.");
      return;
    }
    if (!assignLabTestId) {
      setAssignError("Please choose a diagnostic test from the catalog.");
      return;
    }

    const selectedTest = tests.find((t) => t.id === assignLabTestId);

    assignOrderMutation.mutate({
      patient_id: assignPatientId,
      lab_test_id: assignLabTestId,
      test_name: selectedTest?.test_name,
      test_code: selectedTest?.test_code,
      fee_bdt: selectedTest?.price_bdt,
      ordered_by_doctor: assignDoctorName,
      notes: assignNotes,
    });
  };

  const openUpdateModal = (report: PatientLabReportItem) => {
    setUpdatingReport(report);
    setReportStatus(report.status || "Report Ready");
    setResultSummary(report.result_summary || "");
    setSelectedReportFile(null);
    setUpdateError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReportUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingReport) return;
    setUpdateError(null);

    updateReportMutation.mutate({
      id: updatingReport.id,
      file: selectedReportFile,
      resultSummary: resultSummary.trim(),
      statusStr: reportStatus,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtered tests (Catalog)
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      if (selectedCategory !== "All" && t.category?.toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
      if (statusFilter === "ACTIVE" && !t.is_active) return false;
      if (statusFilter === "INACTIVE" && t.is_active) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return (
          t.test_name?.toLowerCase().includes(q) ||
          t.test_code?.toLowerCase().includes(q) ||
          t.sample_type?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tests, selectedCategory, statusFilter, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard/admin" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-emerald-600" />
              Lab Facilities & Patient Diagnostic Reports
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Manage hospital diagnostic catalog, assign investigations to patients, issue automated bills, and upload laboratory findings.
            </p>
          </div>
        </div>

        {/* Tab-Specific Top Action CTA */}
        {activeTab === "CATALOG" ? (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Diagnostic Test</span>
          </button>
        ) : (
          <button
            onClick={() => {
              resetAssignForm();
              setShowAssignModal(true);
            }}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Assign Test to Patient</span>
          </button>
        )}
      </div>

      {/* Segmented Glassy Tabs */}
      <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs flex max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab("CATALOG")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === "CATALOG"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
          }`}
        >
          <FlaskConical className="w-4 h-4" />
          <span>Test Catalog & Pricing</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "CATALOG" ? "bg-emerald-700/60 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {tests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ORDERS")}
          className={`flex-1 py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === "ORDERS"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Patient Lab Orders & Reports</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "ORDERS" ? "bg-emerald-700/60 text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            {patientReports.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TEST CATALOG & PRICING                                             */}
      {/* ========================================================================= */}
      {activeTab === "CATALOG" && (
        <div className="space-y-6">
          {/* KPI Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Tests</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{tests.length}</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Catalog Investigations</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                <FlaskConical className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pathology</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {tests.filter((t) => t.category === "Pathology").length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Blood & Urine Tests</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                <Droplet className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Radiology</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {tests.filter((t) => t.category?.includes("Radiology")).length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">X-Ray, USG, MRI</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Cardiology</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {tests.filter((t) => t.category === "Cardiology").length}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">ECG, Echo, Doppler</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <Activity className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tests by code (LAB-01), name, category, or sample type..."
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStatusFilter("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                    statusFilter === "ALL"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  All Status
                </button>
                <button
                  onClick={() => setStatusFilter("ACTIVE")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                    statusFilter === "ACTIVE"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter("INACTIVE")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                    statusFilter === "INACTIVE"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  Inactive
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
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

          {/* Tests Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoadingTests ? (
              <div className="py-20 text-center text-sm text-slate-400">Loading diagnostic test catalog...</div>
            ) : filteredTests.length === 0 ? (
              <div className="py-16 text-center px-4">
                <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800">No diagnostic tests match your criteria</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Try adjusting your search query, department category, or status filter.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="min-w-[850px] w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Test Code</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Investigation / Test Name</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Department</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Sample Type</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Report Delivery</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Fee (৳ BDT)</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTests.map((test) => (
                      <tr key={test.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Code */}
                        <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                              {test.test_code}
                            </span>
                            <button
                              onClick={() => copyToClipboard(test.test_code)}
                              className="p-1 text-slate-400 hover:text-slate-700 transition"
                              title="Copy Code"
                            >
                              {copiedCode === test.test_code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Name & Description */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-bold text-slate-900">{test.test_name}</div>
                          {test.description && (
                            <div className="text-xs text-slate-500 truncate mt-0.5" title={test.description}>
                              {test.description}
                            </div>
                          )}
                        </td>

                        {/* Department / Category */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {test.category}
                          </span>
                        </td>

                        {/* Sample */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 text-xs text-slate-700 font-medium">
                            <Droplet className="w-3 h-3 text-rose-500" />
                            <span>{test.sample_type}</span>
                          </span>
                        </td>

                        {/* Delivery Time */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{test.report_delivery_time}</span>
                          </div>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                            ৳{Number(test.price_bdt).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {test.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(test)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                              title="Edit Test Details"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setDeletingTest(test)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                              title="Delete Test"
                            >
                              <Trash2 className="w-4 h-4" />
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PATIENT LAB ORDERS & REPORTS                                       */}
      {/* ========================================================================= */}
      {activeTab === "ORDERS" && (
        <div className="space-y-6">
          {/* Search & Status Filters */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Search orders by Patient Name, MRN, Order ID (RPT-2026-...), or Test Name..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {orderSearch && (
                <button
                  onClick={() => setOrderSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {["ALL", "Sample Collected", "Processing", "Report Ready"].map((st) => (
                <button
                  key={st}
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                    orderStatusFilter === st
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {st === "ALL" ? "All Orders" : st}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoadingReports ? (
              <div className="py-20 text-center text-sm text-slate-400">Loading patient diagnostic orders...</div>
            ) : patientReports.length === 0 ? (
              <div className="py-16 text-center px-4">
                <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-slate-800">No diagnostic orders recorded</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Click &ldquo;+ Assign Test to Patient&rdquo; to prescribe or order an investigation for any hospital patient.
                </p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <table className="min-w-[950px] w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <th className="py-3.5 px-4 whitespace-nowrap sticky left-0 bg-slate-50 z-10 shadow-xs">Order ID</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Patient (EMR)</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Investigation Test</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Ordered By</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Fee & Invoice</th>
                      <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                      <th className="py-3.5 px-4 text-right whitespace-nowrap">Report Findings & Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {patientReports.map((report) => {
                      const isReady = report.status === "Report Ready";
                      const isProcessing = report.status === "Processing";

                      return (
                        <tr key={report.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Order ID */}
                          <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-xs">
                            <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                              {report.order_code}
                            </span>
                          </td>

                          {/* Patient Details with clickable link to EMR */}
                          <td className="py-3.5 px-4">
                            <Link
                              href={`/dashboard/patients?search=${encodeURIComponent(report.patient_mrn || report.patient_name)}`}
                              className="font-bold text-slate-900 hover:text-emerald-600 transition flex items-center gap-1 group"
                              title="Open Patient EMR"
                            >
                              <span>{report.patient_name}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-emerald-600 transition" />
                            </Link>
                            <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                              <span className="text-emerald-700 font-medium">MRN: {report.patient_mrn || "N/A"}</span>
                              {report.patient_phone && <span>• {report.patient_phone}</span>}
                            </div>
                          </td>

                          {/* Test Name & Code */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{report.test_name}</div>
                            {report.test_code && (
                              <div className="text-xs text-slate-500 font-mono">{report.test_code}</div>
                            )}
                          </td>

                          {/* Ordered By Doctor */}
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            <div className="font-medium text-slate-800">{report.ordered_by_doctor || "Physician"}</div>
                          </td>

                          {/* Fee & Billing Link */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="font-mono font-bold text-slate-900">
                              ৳{Number(report.fee_bdt).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </div>
                            {report.invoice_number ? (
                              <Link
                                href="/dashboard/billing"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline font-mono mt-0.5"
                                title="View in Billing"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>{report.invoice_number}</span>
                                <span
                                  className={`px-1 rounded text-[9px] font-bold ${
                                    report.invoice_payment_status === "Paid"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-amber-100 text-amber-800"
                                  }`}
                                >
                                  {report.invoice_payment_status || "Due"}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-[11px] text-slate-400">Direct Bill</span>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                                isReady
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : isProcessing
                                  ? "bg-blue-50 text-blue-700 border-blue-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isReady ? "bg-emerald-500" : isProcessing ? "bg-blue-500 animate-pulse" : "bg-amber-500"
                                }`}
                              />
                              {report.status}
                            </span>
                          </td>

                          {/* Findings & Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {report.report_file_url && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewPdfUrl(report.report_file_url!);
                                    setPreviewTitle(`${report.test_name} - ${report.patient_name} (${report.order_code})`);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition"
                                  title="View Report File"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Report</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openUpdateModal(report)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition shadow-2xs"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{isReady ? "Edit Findings" : "Update / Upload Report"}</span>
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT LAB TEST IN CATALOG                                   */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    {editingTest ? "Edit Diagnostic Lab Test" : "Add Diagnostic Lab Test"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {editingTest
                      ? "Update fee, turnaround time, or clinical details."
                      : "Add a new investigation to the hospital's public Lab Facilities catalog."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitTest} className="space-y-4">
              {/* Code & Name */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test Code</label>
                  <input
                    type="text"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    placeholder="e.g. LAB-16"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-[10px] text-slate-400">Auto-filled if left blank</span>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Investigation Name *</label>
                  <input
                    type="text"
                    required
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                    placeholder="e.g. Complete Blood Count (CBC)"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Department & Sample Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department / Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="Pathology">Pathology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Radiology & Imaging">Radiology & Imaging</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Immunology">Immunology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sample / Procedure Type *</label>
                  <select
                    value={sampleType}
                    onChange={(e) => setSampleType(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {SAMPLE_TYPE_PRESETS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Fee & Delivery Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test Fee (৳ BDT) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step={10}
                    value={priceBdt}
                    onChange={(e) => setPriceBdt(Number(e.target.value))}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Report Delivery Time *</label>
                  <input
                    type="text"
                    required
                    value={reportDeliveryTime}
                    onChange={(e) => setReportDeliveryTime(e.target.value)}
                    placeholder="e.g. Same Day (4 Hours)"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Quick Delivery Presets */}
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Quick Select Turnaround Presets:</label>
                <div className="flex flex-wrap gap-1">
                  {COMMON_DELIVERY_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReportDeliveryTime(preset)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition border ${
                        reportDeliveryTime === preset
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Patient Instructions</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Requires 8-10 hours overnight fasting. Avoid alcohol before sample."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="font-semibold text-xs text-slate-800">Public Visibility</div>
                  <div className="text-[11px] text-slate-500">
                    Active tests appear in the public &ldquo;/lab-facilities&rdquo; catalog.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isActive ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingTest
                    ? "Save Changes"
                    : "Add Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ASSIGN TEST TO PATIENT & GENERATE BILL                           */}
      {/* ========================================================================= */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Assign Test to Patient</h3>
                  <p className="text-xs text-slate-500">
                    Orders diagnostic test, creates order tracking (RPT-...), and generates a Due invoice for receptionist payment.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              {/* Patient Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Patient *</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={assignPatientSearch}
                    onChange={(e) => setAssignPatientSearch(e.target.value)}
                    placeholder="Search enrolled patient by Name, MRN, or Phone..."
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <select
                    required
                    value={assignPatientId}
                    onChange={(e) => setAssignPatientId(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">-- Choose Patient --</option>
                    {filteredPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name} ({p.mrn || "No MRN"} • {p.phone || "No Phone"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Diagnostic Test Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Choose Diagnostic Test *</label>
                <select
                  required
                  value={assignLabTestId}
                  onChange={(e) => setAssignLabTestId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="">-- Select Test from Catalog --</option>
                  {tests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.test_name} [{t.test_code}] — ৳{Number(t.price_bdt).toFixed(0)} ({t.report_delivery_time})
                    </option>
                  ))}
                </select>
              </div>

              {/* Doctor / Prescriber */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ordered By Physician</label>
                <input
                  type="text"
                  value={assignDoctorName}
                  onChange={(e) => setAssignDoctorName(e.target.value)}
                  placeholder="e.g. Dr. John Smith"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Clinical Notes / Patient Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Clinical Notes</label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Fasting sample requested for pre-op checkup."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Automated Billing Info Banner */}
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Automated Billing Generated:</span> Submitting this will create a Due invoice in the patient's billing record so the hospital receptionist can collect payment seamlessly.
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignOrderMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {assignOrderMutation.isPending ? "Assigning & Billing..." : "Assign & Generate Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: UPDATE / UPLOAD REPORT FINDINGS & PDF                            */}
      {/* ========================================================================= */}
      {updatingReport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Update Diagnostic Report</h3>
                  <p className="text-xs text-slate-500">
                    Order: <strong className="text-slate-800">{updatingReport.order_code}</strong> • {updatingReport.patient_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setUpdatingReport(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {updateError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{updateError}</span>
              </div>
            )}

            <form onSubmit={handleReportUpdateSubmit} className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Laboratory Status *</label>
                <select
                  value={reportStatus}
                  onChange={(e) => setReportStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  <option value="Sample Collected">Sample Collected</option>
                  <option value="Processing">Processing (Analyzer Queue)</option>
                  <option value="Report Ready">Report Ready (Verified Findings)</option>
                </select>
              </div>

              {/* Result Summary / Findings */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinical Findings & Parameter Results</label>
                <textarea
                  rows={4}
                  value={resultSummary}
                  onChange={(e) => setResultSummary(e.target.value)}
                  placeholder="e.g. Hemoglobin 14.2 g/dL (Normal: 13.0 - 17.0). Platelet Count: 240,000 /mcL (Normal: 150,000 - 450,000). Total WBC: 7,500 /mcL. No atypical cells detected."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* File Attachment */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Attach Signed Report Document (PDF / Image)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf"
                  onChange={(e) => setSelectedReportFile(e.target.files?.[0] || null)}
                  className="w-full p-1.5 border border-slate-200 rounded-xl text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
                {updatingReport.report_file_url && !selectedReportFile && (
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Existing report attached: {updatingReport.report_file_url.split("/").pop()}</span>
                  </div>
                )}
              </div>

              {selectedReportFile && (
                <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-medium truncate">{selectedReportFile.name}</span>
                    <span className="text-[10px] text-emerald-600">({(selectedReportFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setUpdatingReport(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateReportMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {updateReportMutation.isPending ? "Updating Report..." : "Save Findings & Mark Ready"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PDF REPORT PREVIEW                                               */}
      {/* ========================================================================= */}
      {previewPdfUrl && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-[95vw] max-w-4xl h-[88vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
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

            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewPdfUrl}
                className="w-full h-full rounded-xl border border-slate-200 bg-white"
                title="Diagnostic Report PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: DELETE TEST FROM CATALOG                                         */}
      {/* ========================================================================= */}
      {deletingTest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg text-slate-900">Delete Diagnostic Test?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to remove <strong className="text-slate-800">{deletingTest.test_name}</strong> (
                {deletingTest.test_code}) from the diagnostic catalog? This action will be logged in the system audit trail.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTest(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingTest.id)}
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
