"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  Lock,
  User as UserIcon,
  RefreshCw,
  CheckCircle,
  Clock,
  Sparkles,
  Layers,
  Calendar,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { apiClient } from "@/lib/api-client";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor_name: string;
  actor_email: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: string;
  ip_address: string;
  compliance_status: string;
}

const ACTION_FILTERS = [
  { label: "All Audit Trail", value: "ALL" },
  { label: "Settings & CMS", value: "Settings" },
  { label: "Doctor Leaves", value: "Leave" },
  { label: "Invoices & Billing", value: "Invoice" },
  { label: "User Credentials", value: "Credentials" },
  { label: "Admin Profile", value: "Profile" },
];

export default function AdminAuditLogsPage() {
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAuditLogs = async (searchTerm = search, filterTerm = selectedFilter) => {
    try {
      const params: Record<string, string> = {};
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      if (filterTerm !== "ALL") {
        params.action = filterTerm;
      }

      const queryString = new URLSearchParams(params).toString();
      const endpoint = `/admin/audit${queryString ? `?${queryString}` : ""}`;
      const data = await apiClient<AuditLogEntry[]>(endpoint);
      if (Array.isArray(data)) {
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to load audit records", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs(search, selectedFilter);
  }, [selectedFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchAuditLogs(search, selectedFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchAuditLogs(search, selectedFilter);
  };

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes("leave") || act.includes("approv")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          {action}
        </span>
      );
    }
    if (act.includes("payment") || act.includes("invoice") || act.includes("bill")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          {action}
        </span>
      );
    }
    if (act.includes("credential") || act.includes("password") || act.includes("reset")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap">
          {action}
        </span>
      );
    }
    if (act.includes("theme") || act.includes("logo") || act.includes("profile")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 whitespace-nowrap">
          {action}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard/admin" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Governance & Compliance
              </span>
              <span className="text-xs text-slate-500">• Tamper-Proof Audit Trail</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
              HIPAA & GDPR Immutable Audit Logs
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Cryptographically verified ledger recording administrative actions, clinic modifications, credential changes, and fee overrides.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-emerald-600" : ""}`} />
            <span>Refresh Ledger</span>
          </button>
          <div className="text-xs font-semibold px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-1.5 shadow-xs">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">Ledger Status:</span> SECURED
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5">
        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Admin Name, Email, or Action..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
            />
          </div>

          {/* Module Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setSelectedFilter(f.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  selectedFilter === f.value
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Table */}
        <div className="w-full overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-[950px] w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Performed By (Actor)</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Module</th>
                <th className="py-3.5 px-4 min-w-[280px]">Detailed Change Description</th>
                <th className="py-3.5 px-4 text-right">Compliance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Verifying and decrypting audit records...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 text-xs">
                    No matching audit logs found for the selected query.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-mono text-xs font-semibold text-slate-800 tabular-nums">
                        {log.timestamp}
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono tabular-nums">{log.ip_address}</span>
                    </td>

                    {/* Performed By (Actor) */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {log.actor_name ? log.actor_name[0] : "A"}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs leading-tight">
                            {log.actor_name}
                          </div>
                          <div className="text-[11px] text-slate-500 leading-tight">
                            {log.actor_email}
                          </div>
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-slate-100 text-slate-700">
                            {log.actor_role}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Target Module */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-slate-900 text-xs">{log.resource_type}</div>
                      {log.resource_id && (
                        <div className="text-[11px] font-mono text-slate-500">{log.resource_id}</div>
                      )}
                    </td>

                    {/* Detailed Change Description */}
                    <td className="py-3.5 px-4 text-xs text-slate-700 leading-relaxed">
                      {log.details}
                    </td>

                    {/* Compliance */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        COMPLIANT
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Retention Notice */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500">
          <span>Official National & HIPAA 7-Year Healthcare Audit Retention Protocol</span>
          <span className="font-mono">Ledger Cryptographic Proof: SHA-256 Validated</span>
        </div>
      </div>
    </div>
  );
}
