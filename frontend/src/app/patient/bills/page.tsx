"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  CreditCard,
  Printer,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Bed,
  Stethoscope,
  Info,
  Calendar,
  Building2,
  Eye,
  HeartPulse,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import {
  InvoiceReceiptModal,
  InvoiceModalData,
} from "@/components/billing/invoice-receipt-modal";

interface PatientInvoice {
  id: string;
  invoice_number: string;
  patient_id?: string;
  patient_name?: string;
  patient_mrn?: string;
  patient_phone?: string;
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

export default function PatientBillsPage() {
  const [filter, setFilter] = useState<"ALL" | "DUE" | "PAID">("ALL");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [receiptModalMode, setReceiptModalMode] = useState<"DETAILS" | "PRINT">("DETAILS");

  // Fetch patient invoices
  const {
    data: invoices = [],
    isLoading,
    refetch,
  } = useQuery<PatientInvoice[]>({
    queryKey: ["my-invoices"],
    queryFn: () => apiClient<PatientInvoice[]>("/invoices/my"),
  });

  // Calculate summary metrics
  const totalBilled = invoices.reduce((acc, inv) => acc + Number(inv.amount_bdt || 0), 0);
  const totalPaid = invoices.reduce((acc, inv) => acc + Number(inv.paid_amount_bdt || 0), 0);
  const totalDue = invoices.reduce((acc, inv) => acc + Number(inv.due_amount_bdt || 0), 0);

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "DUE") return Number(inv.due_amount_bdt) > 0;
    if (filter === "PAID") return Number(inv.due_amount_bdt) <= 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/patient/dashboard" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bills & Payment Receipts</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review your hospital consultations, bed charges, and official printable tax receipts.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Outstanding Dues */}
        <div
          className={`p-5 rounded-2xl border shadow-xs transition ${
            totalDue > 0
              ? "bg-rose-50/50 border-rose-200 text-rose-950"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Outstanding Dues
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                totalDue > 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-600"
              }`}
            >
              ৳
            </div>
          </div>
          <div
            className={`text-2xl font-bold mt-2 font-mono ${
              totalDue > 0 ? "text-rose-700" : "text-emerald-700"
            }`}
          >
            ৳{totalDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {totalDue > 0 ? "Payable at hospital reception" : "All medical accounts cleared"}
          </p>
        </div>

        {/* Total Paid */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Paid
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            ৳{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Verified payments</p>
        </div>

        {/* Total Invoices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Invoices
            </span>
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">{invoices.length}</div>
          <p className="text-[11px] text-slate-500 mt-1">Visits & admissions billed</p>
        </div>
      </div>

      {/* Reception Counter Notice */}
      {totalDue > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <span className="font-bold">Payment Instructions: </span>
            Please visit the hospital reception billing desk to clear pending dues using{" "}
            <span className="font-semibold">Cash, bKash, Nagad, or Debit/Credit Card</span>. An official
            stamped receipt will be handed to you and made downloadable here immediately.
          </div>
        </div>
      )}

      {/* Invoices List Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Tabs & Filter Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Itemized Medical Statements
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click &quot;Print Official Receipt&quot; to view or save your A4 clinical invoice.
            </p>
          </div>

          <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs">
            <button
              onClick={() => setFilter("ALL")}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filter === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({invoices.length})
            </button>
            <button
              onClick={() => setFilter("DUE")}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filter === "DUE" ? "bg-white text-rose-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Due
            </button>
            <button
              onClick={() => setFilter("PAID")}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                filter === "PAID" ? "bg-white text-emerald-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Paid
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading your statements...</div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 mx-auto flex items-center justify-center mb-2">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-800">No Statements Found</p>
            <p className="text-xs text-slate-500 mt-1">
              You do not have any invoices under this filter category.
            </p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="min-w-[750px] w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sticky left-0 bg-slate-50 z-10 shadow-xs">Invoice #</th>
                  <th className="py-3 px-4">Bill Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Total (৳)</th>
                  <th className="py-3 px-4">Paid (৳)</th>
                  <th className="py-3 px-4">Due (৳)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isPaid = Number(inv.due_amount_bdt) <= 0;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-xs text-emerald-700 whitespace-nowrap sticky left-0 bg-white z-10 shadow-xs">
                        <div>{inv.invoice_number}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {inv.issue_date || new Date(inv.created_at).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                            inv.bill_type === "Nurse Overtime Due"
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : inv.bill_type === "Nurse Care Service"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : inv.bill_type === "Bed / ICU / CCU"
                              ? "bg-slate-100 text-slate-700 border-slate-200"
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
                          <span>{inv.bill_type}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-700 max-w-[220px]">
                        <div className="font-medium text-slate-900 truncate">{inv.description}</div>
                        {inv.doctor_name && (
                          <div className="text-[11px] text-slate-400">
                            {inv.bill_type?.includes("Nurse") ? `Nurse: ${inv.doctor_name}` : inv.doctor_name}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-900 whitespace-nowrap">
                        ৳{Number(inv.amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-emerald-700 font-medium whitespace-nowrap">
                        ৳{Number(inv.paid_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-xs whitespace-nowrap">
                        {Number(inv.due_amount_bdt) > 0 ? (
                          <span className="text-rose-600">
                            ৳{Number(inv.due_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        ) : (
                          <span className="text-emerald-700">৳0.00</span>
                        )}
                      </td>

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

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setReceiptModalMode("DETAILS");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-semibold transition"
                            title="View Itemized Breakdown"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                            <span>Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setReceiptModalMode("PRINT");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold shadow-xs transition"
                            title="Print Official Hospital Receipt"
                          >
                            <Printer className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Receipt</span>
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

      {/* Itemized Breakdown & Print Receipt Modal */}
      {selectedInvoice && (
        <InvoiceReceiptModal
          invoice={selectedInvoice}
          initialMode={receiptModalMode}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
