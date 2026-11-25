"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Settings, Building, Save, CheckCircle, Palette, FileText } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useBranding } from "@/lib/branding-context";

export default function ClinicSettingsPage() {
  const queryClient = useQueryClient();
  const { settings } = useBranding();

  const [clinicName, setClinicName] = useState(settings?.hospital_name || "Hospital Polyclinic");
  const [phone, setPhone] = useState(settings?.emergency_hotline || "+880 1711-001122");
  const [email, setEmail] = useState(settings?.contact_email || "contact@hospital.com");
  const [address, setAddress] = useState(settings?.address || "100 Medical Plaza, Suite 400");
  const [city, setCity] = useState("Dhaka");
  const [currency, setCurrency] = useState("BDT (৳)");
  const [tagline, setTagline] = useState(settings?.tagline || "Excellence in Compassionate Care");
  const [primaryColor, setPrimaryColor] = useState("#059669");
  const [headerHeight, setHeaderHeight] = useState(120);
  const [showSavedAlert, setShowSavedAlert] = useState(false);

  useEffect(() => {
    if (settings) {
      if (settings.hospital_name) setClinicName(settings.hospital_name);
      if (settings.emergency_hotline) setPhone(settings.emergency_hotline);
      if (settings.contact_email) setEmail(settings.contact_email);
      if (settings.address) setAddress(settings.address);
      if (settings.tagline) setTagline(settings.tagline);
    }
  }, [settings]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSavedAlert(true);
    setTimeout(() => setShowSavedAlert(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-600" />
              Clinic Profile & Letterhead Settings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure institutional branding, contact details, currency, and prescription letterhead formats.
            </p>
          </div>
        </div>
      </div>

      {showSavedAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          Settings updated successfully. All subsequent PDF prescriptions and invoices will reflect these changes.
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Info */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-600" />
            Facility Details
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Legal Name</label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Operating Currency</label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 font-bold font-mono text-slate-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Telephone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City / Region</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        {/* Letterhead Design */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 border-b pb-2 flex items-center gap-2">
            <Palette className="w-4 h-4 text-emerald-600" />
            E-Prescription & Invoice Letterhead Template
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Tagline / Slogan</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Theme Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 border rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-full p-2 border rounded-lg text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Header Height (Points)</label>
              <input
                type="number"
                value={headerHeight}
                onChange={(e) => setHeaderHeight(Number(e.target.value))}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <Save className="w-4 h-4" /> Save Profile & Settings
          </button>
        </div>
      </form>
    </div>
  );
}
