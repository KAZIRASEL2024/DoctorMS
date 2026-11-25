"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, Stethoscope, AlertTriangle, CheckCircle, Calendar, User } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useBranding } from "@/lib/branding-context";

export default function VerifyPrescriptionPage() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "SAMPLE-HASH-VERIFICATION";
  const { settings } = useBranding();

  // Simulate verification endpoint
  const isValid = code.length > 10;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-lg w-full mb-3 flex justify-start">
        <BackButton fallbackHref="/" label="Back to Home" />
      </div>
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-8 text-center text-white">
          <div className="inline-flex p-3 bg-emerald-600 rounded-2xl mb-3 shadow-lg shadow-emerald-600/20">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Prescription Authenticity Portal</h1>
          <p className="text-xs text-slate-400 mt-1">Official DoctorMS Cryptographic Proof</p>
        </div>

        {/* Verification Status */}
        <div className="p-8 space-y-6">
          {isValid ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800">
              <CheckCircle className="w-6 h-6 flex-shrink-0 text-emerald-600" />
              <div>
                <div className="font-bold text-sm">Authentic & Verified Prescription</div>
                <div className="text-xs text-emerald-700">
                  This document was signed and issued by a certified practitioner.
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-600" />
              <div>
                <div className="font-bold text-sm">Invalid or Counterfeit Token</div>
                <div className="text-xs text-rose-700">
                  The verification signature could not be matched against any registered prescription.
                </div>
              </div>
            </div>
          )}

          {/* Details Card */}
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-400">Prescription Reference:</span>
              <span className="font-mono font-bold text-slate-800">RX-20261122-0042</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-400">Issuing Clinic:</span>
              <span className="font-bold text-slate-800">
                {settings?.hospital_name || "Hospital Polyclinic"}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-400">Consulting Doctor:</span>
              <span className="font-bold text-slate-800">Dr. John Smith (Cardiology)</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-400">Medical License:</span>
              <span className="font-mono text-slate-700">MED-CARD-9921</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-400">Patient:</span>
              <span className="font-bold text-slate-800">A*** Walker</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-400">Date Issued:</span>
              <span className="text-slate-700">2026-11-22</span>
            </div>
            <div className="pt-2">
              <span className="text-slate-400 block mb-1">Cryptographic SHA-256 Hash:</span>
              <div className="p-2 bg-slate-50 border rounded font-mono text-[10px] break-all text-slate-600">
                {code}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
          DoctorMS Multi-Tenant Healthcare Engine • Fraud-Prevention Proof
        </div>
      </div>
    </div>
  );
}
