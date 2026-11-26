"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import { HospitalUnit, Patient } from "@/types";
import { BackButton } from "@/components/ui/back-button";
import {
  Bed,
  Building,
  Heart,
  Activity,
  Plus,
  Edit2,
  Trash2,
  UserCheck,
  LogOut,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShieldCheck,
  X,
  Sparkles,
} from "lucide-react";

export default function HospitalUnitsPage() {
  const { user, currentRole } = useAuth();
  const queryClient = useQueryClient();

  // Role Checks
  const isSuperAdmin =
    currentRole === "SUPER_ADMIN" ||
    user?.system_role === "SUPER_ADMIN" ||
    (user as any)?.role === "SUPER_ADMIN";

  const isDoctor =
    currentRole === "DOCTOR" ||
    (user as any)?.role === "DOCTOR" ||
    user?.system_role === "DOCTOR" ||
    user?.clinic_memberships?.some((m: any) => m.role === "DOCTOR");

  const isReceptionist =
    currentRole === "RECEPTIONIST" ||
    (user as any)?.role === "RECEPTIONIST" ||
    user?.system_role === "RECEPTIONIST" ||
    user?.clinic_memberships?.some((m: any) => m.role === "RECEPTIONIST");

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "FREE" | "BOOKED">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal States
  const [assignModalUnit, setAssignModalUnit] = useState<HospitalUnit | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [admissionNotes, setAdmissionNotes] = useState<string>("");

  const [detailsModalUnit, setDetailsModalUnit] = useState<HospitalUnit | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editPriceModalUnit, setEditPriceModalUnit] = useState<HospitalUnit | null>(null);

  // Form states for Add / Edit
  const [formUnitCode, setFormUnitCode] = useState<string>("");
  const [formUnitName, setFormUnitName] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("General Bed");
  const [formFloor, setFormFloor] = useState<string>("1st Floor");
  const [formPrice, setFormPrice] = useState<number>(500);

  // Fetch Hospital Units
  const { data: units = [], isLoading } = useQuery<HospitalUnit[]>({
    queryKey: ["hospital-units"],
    queryFn: () => apiClient<HospitalUnit[]>("/units"),
  });

  // Fetch Patients for assignment dropdown
  const { data: patientsData } = useQuery<any>({
    queryKey: ["clinical-patients"],
    queryFn: () => apiClient<any>("/patients?limit=100"),
  });

  const patientsList: Patient[] = useMemo(() => {
    if (!patientsData) return [];
    if (Array.isArray(patientsData)) return patientsData;
    return patientsData.items || [];
  }, [patientsData]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = units.length;
    const booked = units.filter((u) => u.status === "BOOKED").length;
    const free = units.filter((u) => u.status === "FREE").length;
    const occupancyRate = total > 0 ? ((booked / total) * 100).toFixed(1) : "0.0";
    return { total, booked, free, occupancyRate };
  }, [units]);

  // Categories list with counts
  const categories = useMemo(() => {
    return [
      { key: "ALL", label: "All Categories" },
      { key: "General Bed", label: "General Bed" },
      { key: "Cabin", label: "Cabin" },
      { key: "ICU", label: "ICU" },
      { key: "CCU", label: "CCU" },
    ];
  }, []);

  // Filtered units
  const filteredUnits = useMemo(() => {
    return units.filter((u) => {
      if (selectedCategory !== "ALL" && !u.category.toLowerCase().includes(selectedCategory.toLowerCase())) {
        return false;
      }
      if (statusFilter !== "ALL" && u.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const code = u.unit_code.toLowerCase();
        const name = u.unit_name.toLowerCase();
        const patient = (u.patient_name || "").toLowerCase();
        const floor = (u.floor || "").toLowerCase();
        return code.includes(q) || name.includes(q) || patient.includes(q) || floor.includes(q);
      }
      return true;
    });
  }, [units, selectedCategory, statusFilter, searchQuery]);

  // Mutations
  const assignMutation = useMutation({
    mutationFn: async ({ unitId, patientId, notes }: { unitId: string; patientId: string; notes?: string }) => {
      return apiClient(`/units/${unitId}/assign`, {
        method: "POST",
        body: JSON.stringify({ patient_id: patientId, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital-units"] });
      setAssignModalUnit(null);
      setSelectedPatientId("");
      setAdmissionNotes("");
    },
  });

  const dischargeMutation = useMutation({
    mutationFn: async (unitId: string) => {
      return apiClient(`/units/${unitId}/discharge`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital-units"] });
      setDetailsModalUnit(null);
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient("/units", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital-units"] });
      setIsAddModalOpen(false);
      resetForm();
    },
  });

  const updateUnitMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      return apiClient(`/units/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital-units"] });
      setEditPriceModalUnit(null);
      resetForm();
    },
  });

  const deleteUnitMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient(`/units/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hospital-units"] });
    },
  });

  const resetForm = () => {
    setFormUnitCode("");
    setFormUnitName("");
    setFormCategory("General Bed");
    setFormFloor("1st Floor");
    setFormPrice(500);
  };

  const handleOpenEdit = (unit: HospitalUnit) => {
    setEditPriceModalUnit(unit);
    setFormUnitCode(unit.unit_code);
    setFormUnitName(unit.unit_name);
    setFormCategory(unit.category);
    setFormFloor(unit.floor || "1st Floor");
    setFormPrice(unit.daily_price);
  };

  const handleSaveAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createUnitMutation.mutate({
      unit_code: formUnitCode.trim().toUpperCase(),
      unit_name: formUnitName.trim(),
      category: formCategory,
      floor: formFloor,
      daily_price: Number(formPrice),
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPriceModalUnit) return;
    updateUnitMutation.mutate({
      id: editPriceModalUnit.id,
      payload: {
        unit_code: formUnitCode.trim().toUpperCase(),
        unit_name: formUnitName.trim(),
        category: formCategory,
        floor: formFloor,
        daily_price: Number(formPrice),
      },
    });
  };

  // Helper icon for categories (small neutral bed/unit icon w-3.5 h-3.5 text-slate-500)
  const getCategoryIcon = (category: string) => {
    const cat = (category || "").toLowerCase();
    if (cat.includes("icu")) return <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    if (cat.includes("ccu")) return <Heart className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    if (cat.includes("cabin")) return <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
    return <Bed className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                <Bed className="w-5 h-5 text-emerald-600" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Hospital Units & Ward Layout
              </h1>
            </div>
            <p className="text-sm text-slate-600 mt-0.5">
              Real-time occupancy management for General Beds, Private Cabins, ICU, and CCU facilities.
            </p>
          </div>
        </div>

        {/* Action Controls: "+ Add Unit / Room" ONLY visible for SUPER_ADMIN */}
        {isSuperAdmin && (
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Unit / Room</span>
          </button>
        )}
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Capacity */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Capacity</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">{stats.total} Units</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Beds, Cabins & Specialized Care</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Building className="w-5 h-5" />
          </div>
        </div>

        {/* Booked Units */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Booked Units</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">{stats.booked} Occupied</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Currently Admitted Patients</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Free Units */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Free Units</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">{stats.free} Available</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ready for Immediate Admission</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Occupancy Rate</p>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 tabular-nums">{stats.occupancyRate}%</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Live Utilization Metric</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold">
            <Activity className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Tabs, Live Search & Status Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Live Search Input (Unit Code or Patient Name) */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Unit Code (e.g. CCU-01, BED-101) or Patient Name..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Pills (Free / Booked) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "FREE" ? "ALL" : "FREE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                statusFilter === "FREE"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === "FREE" ? "bg-white" : "bg-emerald-500"}`} />
              <span>Free</span>
              <span className={`text-[10px] ${statusFilter === "FREE" ? "text-emerald-100" : "text-emerald-600"}`}>
                ({stats.free})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === "BOOKED" ? "ALL" : "BOOKED")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                statusFilter === "BOOKED"
                  ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                  : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === "BOOKED" ? "bg-white" : "bg-rose-500"}`} />
              <span>Booked</span>
              <span className={`text-[10px] ${statusFilter === "BOOKED" ? "text-rose-100" : "text-rose-600"}`}>
                ({stats.booked})
              </span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-100">
          <span className="text-[11px] font-semibold text-slate-400 mr-1 uppercase tracking-wider">Ward Type:</span>
          {categories.map((c) => {
            const isSelected = selectedCategory === c.key;
            const count =
              c.key === "ALL"
                ? units.length
                : units.filter((u) => u.category.toLowerCase().includes(c.key.toLowerCase())).length;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedCategory(c.key)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{c.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    isSelected ? "bg-white/20 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout Grid */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Loading hospital units and live occupancy...</p>
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
          <Bed className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700">No hospital units found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery
              ? `No units matching "${searchQuery}".`
              : selectedCategory !== "ALL"
              ? `No units registered under "${selectedCategory}".`
              : statusFilter !== "ALL"
              ? `No units currently marked as ${statusFilter}.`
              : "No units have been configured yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {filteredUnits.map((unit) => {
            const isFree = unit.status === "FREE";

            const tileInteractiveClasses = isFree
              ? "cursor-pointer hover:border-[var(--brand-primary)] hover:shadow-md hover:-translate-y-0.5"
              : isDoctor
              ? "cursor-not-allowed opacity-90"
              : "cursor-pointer hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5";

            return (
              <div
                key={unit.id}
                onClick={() => {
                  if (isFree) {
                    setAssignModalUnit(unit);
                  } else if (!isDoctor) {
                    setDetailsModalUnit(unit);
                  }
                }}
                title={
                  isFree
                    ? `${unit.unit_code} - ${unit.unit_name} (${unit.category}) • ৳${Number(unit.daily_price).toLocaleString()}/day • Click to Assign`
                    : isDoctor
                    ? `${unit.unit_code} is occupied by ${unit.patient_name || "Patient"} (Locked for Doctors)`
                    : `${unit.unit_code} is occupied by ${unit.patient_name || "Patient"} • Click for details / discharge`
                }
                className={`bg-white/85 backdrop-blur-md border border-slate-200/90 rounded-xl p-2.5 flex flex-col items-center justify-between text-center min-h-[96px] transition select-none ${tileInteractiveClasses}`}
              >
                {/* 1. Top Row: Small neutral bed/unit icon + compact Unit Code pill */}
                <div className="flex items-center justify-center gap-1.5 w-full">
                  {getCategoryIcon(unit.category)}
                  <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap truncate">
                    {unit.unit_code}
                  </span>
                </div>

                {/* 2. Middle Text: Admitted patient's short name if Booked; subtle "Ready" if Free */}
                <div className="w-full px-1 my-1">
                  {isFree ? (
                    <span className="text-xs font-medium text-slate-500 block truncate">
                      Ready
                    </span>
                  ) : (
                    <span
                      className="text-xs font-semibold text-slate-900 block truncate w-full"
                      title={unit.patient_name || "Admitted Patient"}
                    >
                      {unit.patient_name || "Admitted Patient"}
                    </span>
                  )}
                </div>

                {/* 3. Bottom Status Pill (Strict Green/Red Rule) */}
                <div>
                  {isFree ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      FREE
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                      BOOKED
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Assign Unit to Patient (One-Click Assign Flow) */}
      {assignModalUnit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Assign Unit to Patient</h3>
                  <p className="text-[11px] text-slate-400">Immediate hospital ward admission</p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalUnit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Unit Details Header */}
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between items-center font-bold text-emerald-950">
                <span>{assignModalUnit.unit_code} - {assignModalUnit.unit_name}</span>
                <span className="font-mono">৳ {Number(assignModalUnit.daily_price).toLocaleString()} / day</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-emerald-700">
                <span>Category: <strong>{assignModalUnit.category}</strong> • Floor: {assignModalUnit.floor || "1st Floor"}</span>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const u = assignModalUnit;
                      setAssignModalUnit(null);
                      handleOpenEdit(u);
                    }}
                    className="text-[11px] font-semibold text-emerald-800 hover:underline flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" /> Edit Unit
                  </button>
                )}
              </div>
            </div>

            {/* Patient Selector Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Select Patient to Admit <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose Patient (Name & MRN) --</option>
                {patientsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.first_name} {p.last_name} ({p.mrn}) - {p.phone}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400">
                Select from registered clinic patients. Unit daily price will show on their profile.
              </p>
            </div>

            {/* Admission Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 block">
                Clinical Admission Notes / Indication
              </label>
              <textarea
                rows={2}
                value={admissionNotes}
                onChange={(e) => setAdmissionNotes(e.target.value)}
                placeholder="e.g. Admitted under Dr. for cardiac post-op observation"
                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignModalUnit(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedPatientId || assignMutation.isPending}
                onClick={() => {
                  assignMutation.mutate({
                    unitId: assignModalUnit.id,
                    patientId: selectedPatientId,
                    notes: admissionNotes,
                  });
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {assignMutation.isPending ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Booked Unit Details & One-Click Discharge */}
      {detailsModalUnit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Booked Unit Details</h3>
                  <p className="text-[11px] text-slate-400">{detailsModalUnit.unit_code} • Currently Admitted</p>
                </div>
              </div>
              <button
                onClick={() => setDetailsModalUnit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Admitted Patient Information */}
            <div className="p-4 bg-rose-50/80 border border-rose-200 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-rose-950">{detailsModalUnit.patient_name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">MRN: {detailsModalUnit.patient_mrn}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        const u = detailsModalUnit;
                        setDetailsModalUnit(null);
                        handleOpenEdit(u);
                      }}
                      className="px-2 py-0.5 bg-white text-slate-700 border border-rose-200 hover:bg-slate-50 rounded text-[10px] font-medium flex items-center gap-1 transition"
                    >
                      <Edit2 className="w-2.5 h-2.5" /> Edit
                    </button>
                  )}
                  <span className="px-2 py-0.5 bg-rose-200 text-rose-900 font-bold rounded text-[10px] uppercase">
                    Occupied
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-rose-200/60 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Admitting Physician:</span>
                  <span className="font-semibold text-slate-800">{detailsModalUnit.doctor_name || "Doctor"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Daily Charge:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    ৳ {Number(detailsModalUnit.daily_price).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Admission Time:</span>
                  <span className="font-mono text-slate-700">
                    {detailsModalUnit.assigned_at
                      ? new Date(detailsModalUnit.assigned_at).toLocaleDateString()
                      : "Today"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Floor:</span>
                  <span className="text-slate-700">{detailsModalUnit.floor || "1st Floor"}</span>
                </div>
              </div>

              {detailsModalUnit.notes && (
                <div className="pt-2 border-t border-rose-200/60 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-700">Notes:</span> {detailsModalUnit.notes}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDetailsModalUnit(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                type="button"
                disabled={dischargeMutation.isPending}
                onClick={() => {
                  if (confirm(`Discharge patient from ${detailsModalUnit.unit_code} and make this unit Free?`)) {
                    dischargeMutation.mutate(detailsModalUnit.id);
                  }
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{dischargeMutation.isPending ? "Discharging..." : "Discharge Patient (Make Free)"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Add Unit / Room (Super Admin Only) */}
      {isAddModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Add Hospital Unit / Bed</h3>
                  <p className="text-[11px] text-slate-400">Configure room number and pricing in BDT</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BED-105, CABIN-205, ICU-03"
                  value={formUnitCode}
                  onChange={(e) => setFormUnitCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit / Room Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deluxe Single Cabin 205"
                  value={formUnitName}
                  onChange={(e) => setFormUnitName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="General Bed">General Bed</option>
                    <option value="Cabin">Cabin</option>
                    <option value="ICU">ICU</option>
                    <option value="CCU">CCU</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Floor / Wing</label>
                  <input
                    type="text"
                    placeholder="e.g. 2nd Floor, East Wing"
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Daily Pricing in BDT (৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">৳</span>
                  <input
                    type="number"
                    required
                    min={0}
                    step={50}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createUnitMutation.isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
                >
                  {createUnitMutation.isPending ? "Creating..." : "Save Unit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Price / Details (Super Admin Only) */}
      {editPriceModalUnit && isSuperAdmin && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Unit & Daily Pricing</h3>
                  <p className="text-[11px] text-slate-400">{editPriceModalUnit.unit_code}</p>
                </div>
              </div>
              <button
                onClick={() => setEditPriceModalUnit(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit Code *</label>
                <input
                  type="text"
                  required
                  value={formUnitCode}
                  onChange={(e) => setFormUnitCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit / Room Name *</label>
                <input
                  type="text"
                  required
                  value={formUnitName}
                  onChange={(e) => setFormUnitName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category *</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="General Bed">General Bed</option>
                    <option value="Cabin">Cabin</option>
                    <option value="ICU">ICU</option>
                    <option value="CCU">CCU</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Floor / Wing</label>
                  <input
                    type="text"
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Daily Pricing in BDT (৳) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">৳</span>
                  <input
                    type="number"
                    required
                    min={0}
                    step={50}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditPriceModalUnit(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateUnitMutation.isPending}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
                >
                  {updateUnitMutation.isPending ? "Saving..." : "Update Price & Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
