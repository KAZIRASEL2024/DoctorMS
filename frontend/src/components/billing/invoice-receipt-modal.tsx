"use client";

import React, { useState } from "react";
import {
  Printer,
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MapPin,
  Stethoscope,
  Bed,
  User,
  Phone,
  Calendar,
  Building,
  ShieldCheck,
  CreditCard,
  Eye,
  HeartPulse,
} from "lucide-react";

export interface LineItem {
  service: string;
  location: string;
  reason: string;
  unit_price: number;
  qty: number;
  total: number;
}

export interface InvoiceModalData {
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
  bill_type?: string;
  description?: string;
  amount_bdt: number;
  paid_amount_bdt: number;
  due_amount_bdt: number;
  payment_status: string;
  payment_method?: string;
  confirmed_by_name?: string;
  issue_date?: string;
  created_at: string;
  paid_at?: string;
  notes?: string;
  line_items?: LineItem[];
}

interface InvoiceReceiptModalProps {
  invoice: InvoiceModalData | null;
  initialMode?: "DETAILS" | "PRINT";
  onClose: () => void;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
}

export function InvoiceReceiptModal({
  invoice,
  initialMode = "DETAILS",
  onClose,
  clinicName = "Mir Health",
  clinicAddress = "Hospital Central Road, Dhaka, Bangladesh",
  clinicPhone = "+880 1800 000000",
}: InvoiceReceiptModalProps) {
  const [viewMode, setViewMode] = useState<"DETAILS" | "PRINT">(initialMode);

  if (!invoice) return null;

  const isPaid = Number(invoice.due_amount_bdt) <= 0 || invoice.payment_status?.toUpperCase() === "PAID";
  const lineItems: LineItem[] = invoice.line_items && invoice.line_items.length > 0
    ? invoice.line_items
    : [
        {
          service: invoice.bill_type?.includes("Nurse")
            ? invoice.bill_type
            : invoice.bill_type === "Bed / ICU / CCU"
            ? `Hospital Facility Admission (${invoice.unit_code || "BED-101"})`
            : "Consultant Consultation Fee",
          location: invoice.chamber_location || (invoice.bill_type?.includes("Nurse") ? (invoice.patient_address || "Patient Residence / Ward") : invoice.bill_type === "Bed / ICU / CCU" ? "Inpatient Ward" : "OPD Chamber 101, Main Block"),
          reason: invoice.description || "Hospital Clinical Service",
          unit_price: Number(invoice.amount_bdt),
          qty: 1,
          total: Number(invoice.amount_bdt),
        },
      ];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in">
      {/* Global Print Styles to print strictly the receipt on A4 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #official-hospital-receipt, #official-hospital-receipt * {
            visibility: visible;
          }
          #official-hospital-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      <div className="bg-white rounded-2xl w-[94vw] max-w-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col">
        {/* Modal Top Bar (Controls) */}
        <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 bg-slate-50/80 sticky top-0 z-20 shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              {viewMode === "DETAILS" ? <FileText className="w-4 h-4" /> : <Printer className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {invoice.invoice_number}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    isPaid
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-rose-50 text-rose-700 border border-rose-200"
                  }`}
                >
                  {isPaid ? "Paid" : "Due"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {viewMode === "DETAILS" ? "Itemized Bill Breakdown" : "A4 Print-Ready Money Receipt"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-xl p-0.5 bg-slate-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("DETAILS")}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === "DETAILS"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Breakdown
              </button>
              <button
                type="button"
                onClick={() => setViewMode("PRINT")}
                className={`px-3 py-1 rounded-lg transition ${
                  viewMode === "PRINT"
                    ? "bg-white text-emerald-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Print Receipt
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {viewMode === "DETAILS" ? (
            /* ========================================================== */
            /* MODE A: ITEMIZED BILL BREAKDOWN VIEW                      */
            /* ========================================================== */
            <div className="space-y-6">
              {/* Demographics Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Information Box */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="font-bold text-emerald-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200/60 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Patient Information</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Full Name:</span>
                    <span className="font-semibold text-slate-900">{invoice.patient_name || "Patient"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hospital MRN:</span>
                    <span className="font-mono font-bold text-slate-900">{invoice.patient_mrn || "MRN-N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact Phone:</span>
                    <span className="text-slate-800">{invoice.patient_phone || "Not provided"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Address:</span>
                    <span className="text-slate-800 text-right">{invoice.patient_address || "Registered Address"}</span>
                  </div>
                </div>

                {/* Clinical & Service Reference */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                  <div className="font-bold text-emerald-700 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200/60 flex items-center gap-1.5">
                    {invoice.bill_type?.includes("Nurse") ? (
                      <HeartPulse className="w-3.5 h-3.5" />
                    ) : (
                      <Stethoscope className="w-3.5 h-3.5" />
                    )}
                    <span>{invoice.bill_type?.includes("Nurse") ? "Nursing Care Reference" : "Clinical Reference"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {invoice.bill_type?.includes("Nurse") ? "Assigned Nurse:" : "Consulting Physician:"}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {invoice.doctor_name || (invoice.bill_type?.includes("Nurse") ? "Registered Clinical Nurse" : "Medical Specialist")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Specialty / Dept:</span>
                    <span className="text-slate-800">
                      {invoice.doctor_specialty || (invoice.bill_type?.includes("Nurse") ? "Home Care Nursing" : "General Medicine")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service Location:</span>
                    <span className="font-semibold text-slate-900">
                      {invoice.chamber_location || (invoice.bill_type?.includes("Nurse") ? (invoice.patient_address || "Patient Residence") : "OPD Block Room 101")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Channel:</span>
                    <span className="font-semibold text-slate-900">{invoice.payment_method || "Pending Settlement"}</span>
                  </div>
                </div>
              </div>

              {/* Itemized Charges Table ("Where, Why & Amount") */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Itemized Cost Breakdown (Where, Why & How Much)
                  </h3>
                  <span className="text-[11px] text-slate-400">All prices in BDT (৳)</span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-3 w-8 text-center">#</th>
                        <th className="py-2.5 px-3">Service / Unit & Location</th>
                        <th className="py-2.5 px-3">Clinical Reason / Description</th>
                        <th className="py-2.5 px-3 text-right">Rate (৳)</th>
                        <th className="py-2.5 px-3 text-center">Qty / Days</th>
                        <th className="py-2.5 px-3 text-right">Total (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3 text-center text-slate-400 font-semibold">{idx + 1}</td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{item.service}</div>
                            <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span>{item.location}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">{item.reason}</td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-800">
                            ৳{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">{item.qty}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                            ৳{Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Totals Row */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="text-xs text-slate-500 space-y-1">
                  <div>
                    <span className="font-semibold text-slate-700">Created: </span>
                    {new Date(invoice.created_at).toLocaleDateString()} at{" "}
                    {new Date(invoice.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  {invoice.confirmed_by_name && (
                    <div>
                      <span className="font-semibold text-slate-700">Payment Handled By: </span>
                      {invoice.confirmed_by_name}
                    </div>
                  )}
                </div>

                <div className="w-full sm:w-64 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal / Total:</span>
                    <span className="font-mono font-bold text-slate-900">
                      ৳{Number(invoice.amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Amount Paid:</span>
                    <span className="font-mono">
                      ৳{Number(invoice.paid_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 text-sm font-bold">
                    <span className={invoice.due_amount_bdt > 0 ? "text-rose-600" : "text-emerald-700"}>
                      Outstanding Due:
                    </span>
                    <span
                      className={`font-mono ${
                        invoice.due_amount_bdt > 0 ? "text-rose-600" : "text-emerald-700"
                      }`}
                    >
                      ৳{Number(invoice.due_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* MODE B: PRINT-READY OFFICIAL HOSPITAL RECEIPT (A4)         */
            /* ========================================================== */
            <div id="official-hospital-receipt" className="bg-white p-6 md:p-8 rounded-xl border border-slate-200 text-slate-900 space-y-6">
              {/* Receipt Header */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b-2 border-emerald-600">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl shadow-xs shrink-0">
                    ✚
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">{clinicName}</h1>
                    <p className="text-xs text-slate-500">{clinicAddress}</p>
                    <p className="text-xs text-slate-500">Hotline: {clinicPhone} • Official Medical Receipt</p>
                    <span className="inline-block mt-1 text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
                      Official Invoice & Money Receipt
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="font-mono font-bold text-base text-slate-900">{invoice.invoice_number}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Date: {new Date(invoice.created_at).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-slate-500">
                    Time: {new Date(invoice.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="mt-2.5">
                    {isPaid ? (
                      <span className="inline-block border-2 border-emerald-600 text-emerald-700 font-extrabold text-xs tracking-wider px-3 py-1 rounded uppercase">
                        ✓ PAID IN FULL
                      </span>
                    ) : (
                      <span className="inline-block border-2 border-rose-600 text-rose-600 font-extrabold text-xs tracking-wider px-3 py-1 rounded uppercase">
                        ⚠ PAYMENT DUE
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Patient & Doctor Demographics (2 Columns on tablet+, 1 on mobile) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-bold text-emerald-700 uppercase text-[10px] tracking-wider pb-1 border-b border-slate-200">
                    Patient Demographics
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-semibold text-slate-900">{invoice.patient_name || "Patient"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">MRN:</span>
                    <span className="font-mono font-bold text-slate-900">{invoice.patient_mrn || "MRN-N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Phone:</span>
                    <span className="text-slate-800">{invoice.patient_phone || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Address:</span>
                    <span className="text-slate-800">{invoice.patient_address || "Registered Address"}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                  <div className="font-bold text-emerald-700 uppercase text-[10px] tracking-wider pb-1 border-b border-slate-200">
                    {invoice.bill_type?.includes("Nurse") ? "Nursing Reference" : "Clinical Reference"}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {invoice.bill_type?.includes("Nurse") ? "Staff / Nurse:" : "Physician:"}
                    </span>
                    <span className="font-semibold text-slate-900">
                      {invoice.doctor_name || (invoice.bill_type?.includes("Nurse") ? "Registered Clinical Nurse" : "Medical Specialist")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Specialty / Dept:</span>
                    <span className="text-slate-800">
                      {invoice.doctor_specialty || (invoice.bill_type?.includes("Nurse") ? "Home Care Nursing" : "Clinical OPD")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Ward / Location:</span>
                    <span className="font-semibold text-slate-900">
                      {invoice.chamber_location || (invoice.bill_type?.includes("Nurse") ? (invoice.patient_address || "Home Visit") : "Main OPD 101")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Payment Mode:</span>
                    <span className="font-semibold text-slate-900">{invoice.payment_method || "Pending Settlement"}</span>
                  </div>
                </div>
              </div>

              {/* Itemized Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                      <th className="py-2 px-3 w-8 text-center">#</th>
                      <th className="py-2 px-3">Service / Ward & Location</th>
                      <th className="py-2 px-3">Clinical Reason / Description</th>
                      <th className="py-2 px-3 text-right">Rate (৳)</th>
                      <th className="py-2 px-3 text-center">Days/Qty</th>
                      <th className="py-2 px-3 text-right">Amount (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.service}</div>
                          <div className="text-[10px] text-emerald-700 font-semibold">📍 {item.location}</div>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">{item.reason}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold">
                          ৳{Number(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-semibold">{item.qty}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ৳{Number(item.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals Box */}
              <div className="flex items-start justify-between gap-6 pt-2">
                <div className="text-[11px] text-slate-500 max-w-sm leading-relaxed">
                  <p className="font-bold text-slate-800 mb-0.5">Healthcare Protocol Certification:</p>
                  All charges are audited and documented in Bangladesh Taka (৳ BDT) under the National
                  Healthcare Protocol. For refunds or clarifications, present this original money receipt within 7 days.
                </div>

                <div className="w-64 bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Billed:</span>
                    <span className="font-mono font-bold text-slate-900">
                      ৳{Number(invoice.amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Amount Paid:</span>
                    <span className="font-mono">
                      ৳{Number(invoice.paid_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-bold text-sm">
                    <span className={invoice.due_amount_bdt > 0 ? "text-rose-600" : "text-emerald-700"}>
                      Balance Due:
                    </span>
                    <span className={`font-mono ${invoice.due_amount_bdt > 0 ? "text-rose-600" : "text-emerald-700"}`}>
                      ৳{Number(invoice.due_amount_bdt).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures & Seal */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-dashed border-slate-300 text-center text-xs">
                <div>
                  <div className="w-32 border-b border-slate-400 mx-auto mb-1"></div>
                  <div className="font-bold text-slate-900">Received By</div>
                  <div className="text-[10px] text-slate-500">{invoice.confirmed_by_name || "Reception Desk Officer"}</div>
                </div>

                <div>
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-emerald-600 mx-auto flex items-center justify-center text-[9px] font-extrabold text-emerald-700 uppercase -rotate-12 mb-1">
                    HOSPITAL<br />SEAL
                  </div>
                  <div className="font-bold text-slate-900 text-[11px]">Authorized Hospital Seal</div>
                </div>

                <div>
                  <div className="font-mono text-[10px] border border-slate-200 bg-slate-50 rounded px-2 py-1 inline-block mb-1">
                    ||| |||| ||||| |||<br />
                    {invoice.invoice_number}
                  </div>
                  <div className="font-bold text-slate-900 text-[11px]">Verification Code</div>
                  <div className="text-[10px] text-slate-400">Computer Generated</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar (no-print) */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/80 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 no-print shrink-0">
          <a
            href={`/api/v1/billing/invoices/${invoice.id}/print-html`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center justify-center sm:justify-start gap-1.5 transition min-h-[38px]"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Standalone Tab</span>
          </a>

          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-xl transition min-h-[40px] flex items-center justify-center border border-slate-200 sm:border-transparent"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition min-h-[40px] whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt (A4)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
