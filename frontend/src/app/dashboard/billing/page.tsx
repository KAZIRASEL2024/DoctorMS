"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  CreditCard,
  Banknote,
  Printer,
  CheckCircle2,
  FileText,
  Search,
  Bed,
  Stethoscope,
  Clock,
  AlertCircle,
  X,
  Filter,
  Smartphone,
  User,
  Phone,
  RefreshCw,
  Sparkles,
  Eye,
  HeartPulse,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import {
  InvoiceReceiptModal,
  InvoiceModalData,
} from "@/components/billing/invoice-receipt-modal";

interface PendingUnit {
  unit_id: string;
  unit_code: string;
  unit_name: string;
  category: string;
  floor: string;
  daily_price: number;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  patient_phone: string;
  doctor_id: string;
  doctor_name: string;
  assigned_at: string;
  notes?: string;
  confirmation_status: string;
}

interface InvoiceItem {
  id: string;
  invoice_number: string;
  patient_id: string;
  patient_name: string;
  patient_mrn: string;
  patient_phone: string;
  patient_address?: string;
  doctor_name?: string;
  doctor_specialty?: string;
  chamber_location?: string;
  unit_code?: string;
  bill_type: string;
  description: string;
  amount_bdt: number;
  paid_amount_bdt: number;
  due_amount_bdt: number;
  payment_status: string;
  payment_method?: string;
  confirmed_by_name?: string;
  issue_date: string;
  created_at: string;
  paid_at?: string;
  notes?: string;
  line_items?: any[];
}

export default function BillingPage() {
  const queryClient = useQueryClient();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "DUE" | "PAID">("ALL");
  const [billTypeFilter, setBillTypeFilter] = useState<string>("ALL");

  // Modals state
  const [selectedUnitForConfirmation, setSelectedUnitForConfirmation] = useState<PendingUnit | null>(null);
  const [admissionDays, setAdmissionDays] = useState<number>(1);
  const [customDailyRate, setCustomDailyRate] = useState<number>(2000);
  const [admissionNotes, setAdmissionNotes] = useState<string>("");

  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<InvoiceItem | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "bKash/Nagad" | "Card">("Cash");
  const [amountToPay, setAmountToPay] = useState<number>(0);
  const [paymentNotes, setPaymentNotes] = useState<string>("");

  // Breakdown & Receipt Modal state
  const [selectedInvoiceForBreakdown, setSelectedInvoiceForBreakdown] = useState<InvoiceItem | null>(null);
  const [receiptModalMode, setReceiptModalMode] = useState<"DETAILS" | "PRINT">("DETAILS");

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Fetch Pending Reception Units (Doctor Assigned Bed/ICU/CCU)
  const {
    data: pendingUnits = [],
    isLoading: loadingPending,
    refetch: refetchPending,
  } = useQuery<PendingUnit[]>({
    queryKey: ["reception-pending-units"],
    queryFn: () => apiClient<PendingUnit[]>("/reception/pending-units"),
    refetchInterval: 10000,
  });

  // 2. Fetch Invoices List
  const {
    data: invoices = [],
    isLoading: loadingInvoices,
    refetch: refetchInvoices,
  } = useQuery<InvoiceItem[]>({
    queryKey: ["invoices", statusFilter, billTypeFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (billTypeFilter !== "ALL") params.append("bill_type", billTypeFilter);
      return apiClient<InvoiceItem[]>(`/invoices?${params.toString()}`);
    },
  });

  // KPI Calculations
  const metrics = useMemo(() => {
    let totalBilled = 0;
    let totalPaid = 0;
    let totalDue = 0;
    invoices.forEach((inv) => {
      totalBilled += Number(inv.amount_bdt || 0);
      totalPaid += Number(inv.paid_amount_bdt || 0);
      totalDue += Number(inv.due_amount_bdt || 0);
    });
    return {
      count: invoices.length,
      totalBilled,
      totalPaid,
      totalDue,
    };
  }, [invoices]);

  // Client Filter for Search Term
  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices;
    const term = searchTerm.toLowerCase();
    return invoices.filter(
      (inv) =>
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.patient_name?.toLowerCase().includes(term) ||
        inv.patient_mrn?.toLowerCase().includes(term) ||
        inv.patient_phone?.includes(term) ||
        inv.description?.toLowerCase().includes(term) ||
        inv.doctor_name?.toLowerCase().includes(term) ||
        inv.unit_code?.toLowerCase().includes(term)
    );
  }, [invoices, searchTerm]);

  // Mutation 1: Confirm Doctor-Assigned Unit Bill
  const confirmUnitMutation = useMutation({
    mutationFn: (payload: {
      unit_id: string;
      patient_id?: string;
      days: number;
      daily_rate_bdt: number;
      notes?: string;
    }) =>
      apiClient("/reception/confirm-unit-bill", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          daily_rate: payload.daily_rate_bdt,
          daily_rate_bdt: payload.daily_rate_bdt,
        }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["reception-pending-units"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["hospital-units"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      setSelectedUnitForConfirmation(null);
      showToast(`Unit admission confirmed! Generated invoice #${data.invoice_number} (৳${data.amount_bdt}).`);
    },
    onError: (err: any) => {
      alert("Failed to confirm unit admission: " + (err.message || "Unknown error"));
    },
  });

  // Mutation 2: Record Payment
  const recordPaymentMutation = useMutation({
    mutationFn: (payload: {
      invoiceId: string;
      payment_method: string;
      amount_paid: number;
      notes?: string;
    }) =>
      apiClient(`/invoices/${payload.invoiceId}/confirm-payment`, {
        method: "PATCH",
        body: JSON.stringify({
          payment_method: payload.payment_method,
          amount_paid: payload.amount_paid,
          amount_bdt: payload.amount_paid,
          notes: payload.notes,
        }),
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      setSelectedInvoiceForPayment(null);
      showToast(`Payment of ৳${amountToPay} recorded for #${data.invoice_number} via ${paymentMethod}!`);
    },
    onError: (err: any) => {
      alert("Failed to record payment: " + (err.message || "Unknown error"));
    },
  });

  const handleOpenUnitModal = (unit: PendingUnit) => {
    setSelectedUnitForConfirmation(unit);
    setAdmissionDays(1);
    setCustomDailyRate(unit.daily_price || 2000);
    setAdmissionNotes(unit.notes || `Admitted to ${unit.unit_name} (${unit.category})`);
  };

  const handleOpenPaymentModal = (inv: InvoiceItem) => {
    setSelectedInvoiceForPayment(inv);
    setAmountToPay(inv.due_amount_bdt || 0);
    setPaymentMethod("Cash");
    setPaymentNotes("");
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-emerald-500/50 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Hospital Revenue & Billing Desk</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Manage doctor visit charges, bed & ICU admission approvals, and instant payment collections in BDT (৳).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              refetchPending();
              refetchInvoices();
            }}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Desk</span>
          </button>
        </div>
      </div>

      {/* Live Financial Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoices</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tabular-nums">{metrics.count}</div>
          <p className="text-[11px] text-slate-600 mt-1">Itemized clinical records</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Billed</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              ৳
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 tabular-nums">
            ৳{metrics.totalBilled.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">Doctor visits & admission totals</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Collected Revenue</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-2 tabular-nums">
            ৳{metrics.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-800 font-medium mt-1">Settled & verified at reception</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Dues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-700 mt-2 tabular-nums">
            ৳{metrics.totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-rose-800 font-medium mt-1">Pending patient payment</p>
        </div>
      </div>

      {/* SECTION A: Pending Doctor-Assigned Bed / ICU / CCU Requests */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Bed className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Pending Bed & ICU Admission Approvals
                </h2>
                {pendingUnits.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {pendingUnits.length} Awaiting Reception
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Doctor-ordered hospital unit assignments awaiting reception admission billing generation.
              </p>
            </div>
          </div>
        </div>

        {loadingPending ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading pending admission requests...</div>
        ) : pendingUnits.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No Pending Admission Approvals</p>
            <p className="text-xs text-slate-500 mt-1">
              All doctor bed and ICU assignments have been confirmed and billed.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[800px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10 shadow-xs">Unit / Facility</th>
                  <th className="py-3 px-4">Patient Details</th>
                  <th className="py-3 px-4">Prescribing Doctor</th>
                  <th className="py-3 px-4">Daily Rate</th>
                  <th className="py-3 px-4">Assigned At</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingUnits.map((u) => (
                  <tr key={u.unit_id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 sticky left-0 bg-white z-10 shadow-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">
                          {u.unit_code}
                        </span>
                        <div>
                          <div className="font-semibold text-slate-900 text-xs">{u.unit_name}</div>
                          <div className="text-[11px] text-slate-500">{u.category} • Floor {u.floor}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 text-xs">{u.patient_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {u.patient_mrn} {u.patient_phone && `• ${u.patient_phone}`}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-slate-900 font-medium flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.doctor_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-900">
                      ৳{Number(u.daily_price).toLocaleString()}
                      <span className="text-[10px] text-slate-400 font-normal"> / day</span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {u.assigned_at ? new Date(u.assigned_at).toLocaleDateString() : "Today"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenUnitModal(u)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 ml-auto transition"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Confirm & Generate Bill</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION B: Itemized Hospital Invoices Desk */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Controls Row */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Itemized Invoices & Billing Records
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Review consultations, admission bills, payment statuses, and printable receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search invoice, patient, MRN..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-white"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bill Type Filter */}
            <select
              value={billTypeFilter}
              onChange={(e) => setBillTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="ALL">All Bill Types</option>
              <option value="Doctor Visit">Doctor Visit</option>
              <option value="Bed / ICU / CCU">Bed / ICU / CCU</option>
              <option value="Nurse Care Service">Nurse Care Service</option>
              <option value="Nurse Overtime Due">Nurse Overtime Due</option>
            </select>

            {/* Status Filter Tabs */}
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs">
              <button
                onClick={() => setStatusFilter("ALL")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  statusFilter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("DUE")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  statusFilter === "DUE" ? "bg-white text-rose-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Due
              </button>
              <button
                onClick={() => setStatusFilter("PAID")}
                className={`px-3 py-1 rounded-lg font-semibold transition ${
                  statusFilter === "PAID"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Paid
              </button>
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        {loadingInvoices ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading invoice records...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No Invoices Found</p>
            <p className="text-xs text-slate-500 mt-1">
              No bills match the selected status filter or search query.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10 shadow-xs">Invoice #</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Total (৳)</th>
                  <th className="py-3 px-4">Paid (৳)</th>
                  <th className="py-3 px-4">Due (৳)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isPaid = inv.due_amount_bdt <= 0;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      {/* Invoice Code */}
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700 text-xs whitespace-nowrap sticky left-0 bg-white z-10 shadow-xs">
                        <div>{inv.invoice_number}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {inv.issue_date || new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      {/* Patient */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-xs">{inv.patient_name || "Patient"}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {inv.patient_mrn || "MRN-N/A"}
                        </div>
                      </td>

                      {/* Bill Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            inv.bill_type === "Nurse Overtime Due"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : inv.bill_type === "Nurse Care Service"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {inv.bill_type === "Nurse Overtime Due" ? (
                            <Clock className="w-3 h-3 text-amber-600" />
                          ) : inv.bill_type === "Nurse Care Service" ? (
                            <HeartPulse className="w-3 h-3 text-emerald-600" />
                          ) : inv.bill_type === "Bed / ICU / CCU" ? (
                            <Bed className="w-3 h-3 text-slate-600" />
                          ) : (
                            <Stethoscope className="w-3 h-3 text-slate-600" />
                          )}
                          <span>{inv.bill_type || "Doctor Visit"}</span>
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 max-w-[200px] truncate">
                        {inv.description}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-900 whitespace-nowrap">
                        ৳{Number(inv.amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3.5 px-4 font-mono text-xs text-emerald-700 font-medium whitespace-nowrap">
                        ৳{Number(inv.paid_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      {/* Due Amount */}
                      <td className="py-3.5 px-4 font-mono font-bold text-xs whitespace-nowrap">
                        {inv.due_amount_bdt > 0 ? (
                          <span className="text-rose-600">
                            ৳{Number(inv.due_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-emerald-700">৳0.00</span>
                        )}
                      </td>

                      {/* Status Pill */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {isPaid ? "Paid" : "Due"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceForBreakdown(inv);
                              setReceiptModalMode("DETAILS");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold transition"
                            title="View Itemized Cost Breakdown"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoiceForBreakdown(inv);
                              setReceiptModalMode("PRINT");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition"
                            title="Print Official Hospital Receipt"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Receipt</span>
                          </button>

                          {!isPaid && (
                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(inv)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition"
                            >
                              Collect Payment
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

      {/* MODAL 1: Confirm Doctor-Assigned Unit Bill */}
      {selectedUnitForConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl w-[94vw] max-w-lg max-h-[88vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-5 my-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Bed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Confirm Unit Admission & Bill</h3>
                  <p className="text-xs text-slate-500">Unit: {selectedUnitForConfirmation.unit_code}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUnitForConfirmation(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Patient & Facility Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="font-semibold text-slate-900">
                  {selectedUnitForConfirmation.patient_name} ({selectedUnitForConfirmation.patient_mrn})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Facility / Category:</span>
                <span className="font-semibold text-slate-900">
                  {selectedUnitForConfirmation.unit_name} ({selectedUnitForConfirmation.category})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Prescribing Doctor:</span>
                <span className="font-semibold text-slate-900">{selectedUnitForConfirmation.doctor_name}</span>
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Stay Duration (Days) *</label>
                  <input
                    type="number"
                    min={1}
                    value={admissionDays}
                    onChange={(e) => setAdmissionDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Daily Rate (৳ BDT) *</label>
                  <input
                    type="number"
                    min={0}
                    value={customDailyRate}
                    onChange={(e) => setCustomDailyRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {/* Real-time Calculation */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-900">Estimated Total Bill:</span>
                <span className="text-base font-bold font-mono text-emerald-800">
                  ৳{(admissionDays * customDailyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Admission Notes</label>
                <textarea
                  rows={2}
                  value={admissionNotes}
                  onChange={(e) => setAdmissionNotes(e.target.value)}
                  placeholder="Admission notes, clinical reasons..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedUnitForConfirmation(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmUnitMutation.isPending}
                onClick={() =>
                  confirmUnitMutation.mutate({
                    unit_id: selectedUnitForConfirmation.unit_id,
                    patient_id: selectedUnitForConfirmation.patient_id,
                    days: admissionDays,
                    daily_rate_bdt: customDailyRate,
                    notes: admissionNotes,
                  })
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {confirmUnitMutation.isPending ? "Confirming..." : "Confirm & Generate Invoice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Payment / Confirm Bill Paid */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-2xl w-[94vw] max-w-md max-h-[88vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-5 my-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  ৳
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Record Patient Payment</h3>
                  <p className="text-xs text-slate-500">Invoice: {selectedInvoiceForPayment.invoice_number}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bill Summary */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="font-semibold text-slate-900">{selectedInvoiceForPayment.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Service:</span>
                <span className="font-semibold text-slate-900">{selectedInvoiceForPayment.bill_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Billed:</span>
                <span className="font-mono text-slate-800">
                  ৳{Number(selectedInvoiceForPayment.amount_bdt).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-rose-600 font-bold">Outstanding Due:</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  ৳{Number(selectedInvoiceForPayment.due_amount_bdt).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Select Payment Method *</label>
              <div className="grid grid-cols-3 gap-2">
                {(["Cash", "bKash/Nagad", "Card"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                      paymentMethod === method
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-xs"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {method === "Cash" && <Banknote className="w-4 h-4" />}
                    {method === "bKash/Nagad" && <Smartphone className="w-4 h-4" />}
                    {method === "Card" && <CreditCard className="w-4 h-4" />}
                    <span>{method}</span>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount to Pay (৳ BDT) *</label>
                <input
                  type="number"
                  min={1}
                  max={selectedInvoiceForPayment.due_amount_bdt}
                  value={amountToPay}
                  onChange={(e) => setAmountToPay(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Transaction Notes / Receipt Reference
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g. bKash TrxID, counter reference..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedInvoiceForPayment(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={recordPaymentMutation.isPending || amountToPay <= 0}
                onClick={() =>
                  recordPaymentMutation.mutate({
                    invoiceId: selectedInvoiceForPayment.id,
                    payment_method: paymentMethod,
                    amount_paid: amountToPay,
                    notes: paymentNotes,
                  })
                }
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-2"
              >
                {recordPaymentMutation.isPending ? "Recording..." : "Confirm & Clear Bill"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Itemized Breakdown & Print Receipt Modal */}
      {selectedInvoiceForBreakdown && (
        <InvoiceReceiptModal
          invoice={selectedInvoiceForBreakdown}
          initialMode={receiptModalMode}
          onClose={() => setSelectedInvoiceForBreakdown(null)}
        />
      )}
    </div>
  );
}
