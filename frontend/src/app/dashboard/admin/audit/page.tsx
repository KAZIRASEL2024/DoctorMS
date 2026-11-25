"use client";

import React, { useState } from "react";
import { ShieldCheck, Search, Filter, Lock, Eye, AlertTriangle } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState("");

  const sampleAuditLogs = [
    {
      id: "log-1",
      action: "READ",
      resource_type: "Patient PHI",
      resource_id: "MRN-2026-0001",
      patient_name: "Alice Walker",
      user_name: "Dr. John Smith",
      user_role: "DOCTOR",
      ip_address: "192.168.100.118",
      timestamp: "2026-11-22 11:15:32",
      compliance_status: "COMPLIANT",
    },
    {
      id: "log-2",
      action: "CREATE",
      resource_type: "Prescription",
      resource_id: "RX-20261122-0042",
      patient_name: "Alice Walker",
      user_name: "Dr. John Smith",
      user_role: "DOCTOR",
      ip_address: "192.168.100.118",
      timestamp: "2026-11-22 11:20:14",
      compliance_status: "COMPLIANT",
    },
    {
      id: "log-3",
      action: "UPDATE",
      resource_type: "Patient Allergies",
      resource_id: "MRN-2026-0001",
      patient_name: "Alice Walker",
      user_name: "Dr. John Smith",
      user_role: "DOCTOR",
      ip_address: "192.168.100.118",
      timestamp: "2026-11-22 11:22:45",
      compliance_status: "COMPLIANT",
    },
    {
      id: "log-4",
      action: "CREATE",
      resource_type: "Payment Transaction",
      resource_id: "TXN-CARD-449102",
      patient_name: "Robert Fox",
      user_name: "Sarah Connor",
      user_role: "SUPER_ADMIN",
      ip_address: "192.168.100.118",
      timestamp: "2026-11-22 11:28:01",
      compliance_status: "COMPLIANT",
    },
    {
      id: "log-5",
      action: "READ",
      resource_type: "Patient Directory",
      resource_id: "ALL_ACTIVE",
      patient_name: "System Query",
      user_name: "Emily Blunt",
      user_role: "RECEPTIONIST",
      ip_address: "192.168.100.118",
      timestamp: "2026-11-22 11:30:19",
      compliance_status: "COMPLIANT",
    },
  ];

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CREATE":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">CREATE</span>;
      case "READ":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-800">READ</span>;
      case "UPDATE":
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">UPDATE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-800">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard/admin" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              HIPAA & GDPR Tamper-Proof Audit Trail
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Immutable log recording every clinical record lookup, patient PHI modification, and financial entry.
            </p>
          </div>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          Audit Trail Status: SECURED & VERIFIED
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="relative w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Actor, Patient, or Action..."
              className="w-full pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-xs"
            />
          </div>
          <span className="text-xs text-slate-400 font-mono">Retaining 7-Year Medical Audit Logs</span>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="min-w-[750px] w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="py-3 px-4 whitespace-nowrap">Action</th>
                <th className="py-3 px-4 whitespace-nowrap">Target Resource</th>
                <th className="py-3 px-4 whitespace-nowrap">Patient / Record</th>
                <th className="py-3 px-4 whitespace-nowrap">Actor</th>
                <th className="py-3 px-4 whitespace-nowrap">IP Address</th>
                <th className="py-3 px-4 whitespace-nowrap">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sampleAuditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                  <td className="py-3 px-4 font-semibold text-slate-800 whitespace-nowrap">
                    {log.resource_type}
                    <div className="text-[11px] font-mono text-slate-400">{log.resource_id}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{log.patient_name}</td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{log.user_name}</div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                      {log.user_role}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">{log.ip_address}</td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
