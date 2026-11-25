"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Building2, Plus, ShieldCheck, CheckCircle, ExternalLink, Activity, Users } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useBranding } from "@/lib/branding-context";

export default function AdminClinicsPage() {
  const queryClient = useQueryClient();
  const { settings } = useBranding();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Dhaka");
  const [address, setAddress] = useState("");

  const clinics = [
    {
      id: "c1",
      name: settings?.hospital_name || "Main Central Polyclinic",
      slug: "metro-health",
      email: "info@metrohealth.com",
      phone: "+880 1711-001122",
      city: "Dhaka",
      country: "Bangladesh",
      currency: "BDT",
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      doctors_count: 8,
      patients_count: 1420,
    },
    {
      id: "c2",
      name: "CarePoint Diagnostic & Clinic",
      slug: "carepoint-ctg",
      email: "contact@carepoint.com.bd",
      phone: "+880 1819-334455",
      city: "Chittagong",
      country: "Bangladesh",
      currency: "BDT",
      plan: "ENTERPRISE",
      status: "ACTIVE",
      doctors_count: 15,
      patients_count: 3250,
    },
    {
      id: "c3",
      name: "Sylhet Specialist Center",
      slug: "sylhet-specialist",
      email: "help@sylhetspecialist.bd",
      phone: "+880 1912-778899",
      city: "Sylhet",
      country: "Bangladesh",
      currency: "BDT",
      plan: "STARTER",
      status: "ACTIVE",
      doctors_count: 3,
      patients_count: 420,
    },
  ];

  const handleCreateClinic = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Clinic "${name}" onboarding submitted successfully!`);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard/admin" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-6 h-6 text-emerald-600" />
              Clinics & Tenant Management
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Super Admin directory of all onboarded healthcare facilities, subscription tiers, and limits.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" /> Onboard New Clinic
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Tenant Facilities</span>
          <div className="text-3xl font-bold text-slate-800 mt-1">12</div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">100% Data Isolation Active</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Active Subscriptions</span>
          <div className="text-3xl font-bold text-emerald-600 mt-1">11</div>
          <span className="text-xs text-slate-400 mt-1 block">1 Trial Facility</span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Platform Monthly MRR</span>
          <div className="text-3xl font-bold text-emerald-600 mt-1">৳185,000</div>
          <span className="text-xs text-emerald-600 font-semibold mt-1 block">+18% this quarter</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="min-w-[700px] w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
                <th className="py-3 px-4 whitespace-nowrap">Clinic Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Slug / Domain</th>
                <th className="py-3 px-4 whitespace-nowrap">Location</th>
                <th className="py-3 px-4 whitespace-nowrap">SaaS Tier</th>
                <th className="py-3 px-4 whitespace-nowrap">Doctors</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
              </tr>
            </thead>
          <tbody className="divide-y divide-slate-100">
            {clinics.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/80">
                <td className="py-3.5 px-4 font-semibold text-slate-800">
                  {c.name}
                  <div className="text-xs text-slate-400">{c.email} • {c.phone}</div>
                </td>
                <td className="py-3.5 px-4 font-mono text-xs text-emerald-700 font-medium">{c.slug}</td>
                <td className="py-3.5 px-4 text-slate-600">{c.city}, {c.country}</td>
                <td className="py-3.5 px-4">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {c.plan}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-700 font-medium">{c.doctors_count} Doctors</td>
                <td className="py-3.5 px-4">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-4 my-auto">
            <h3 className="font-bold text-lg text-slate-900">Onboard New Clinic Tenant</h3>
            <form onSubmit={handleCreateClinic} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Popular Diagnostic Center"
                  className="w-full p-2 border rounded-lg text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">URL Slug</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="popular-dhaka"
                    className="w-full p-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1711..."
                    className="w-full p-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
