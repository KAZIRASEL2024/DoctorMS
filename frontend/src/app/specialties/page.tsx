"use client";

import React from "react";
import Link from "next/link";
import { DoctorDirectory } from "@/components/doctors/doctor-directory";
import { BackButton } from "@/components/ui/back-button";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { useBranding } from "@/lib/branding-context";
import {
  Stethoscope,
  PhoneCall,
  Calendar,
  ShieldCheck,
  ArrowRight,
  MapPin,
  Mail,
  ChevronLeft,
} from "lucide-react";

export default function SpecialtiesPage() {
  const { settings, isLoading } = useBranding();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Emergency Bar */}
      <div className="bg-slate-950 text-white text-xs py-2 px-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              24/7 Emergency Hotline:
            </span>
            <a
              href={`tel:${settings?.emergency_hotline || "+880 1711-001122"}`}
              className="font-mono font-bold hover:text-rose-300 transition"
            >
              {settings?.emergency_hotline || "+880 1711-001122"}
            </a>
          </div>

          <div className="flex items-center gap-6 text-slate-400">
            <span className="flex items-center gap-1.5 hidden md:flex">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              {settings?.address || "100 Medical Plaza, Suite 400, Dhaka"}
            </span>
            <span className="flex items-center gap-1.5 hidden lg:flex">
              <Mail className="w-3.5 h-3.5 text-emerald-400" />
              {settings?.contact_email || "care@hospital.com"}
            </span>
          </div>
        </div>
      </div>

      {/* Public Navbar with Slide-Out Mobile Drawer */}
      <PublicNavbar settings={settings} showBack={true} />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-12 flex-1 w-full">
        <DoctorDirectory
          title="Medical Specialties & Consultant Chambers"
          subtitle="Explore all available clinical departments, view consultation fees in BDT (৳), check chamber schedules, and book appointments directly."
        />
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-white pt-12 pb-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4 border-b border-slate-800 pb-8">
            <div className="flex items-center gap-3">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings?.hospital_name || "Hospital Logo"}
                  className="w-8 h-8 rounded-lg object-contain bg-white/10 p-0.5"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <Stethoscope className="w-4 h-4" />
                </div>
              )}
              <div>
                <span className="font-bold text-white block text-sm">
                  {settings?.hospital_name || "Mir Health"}
                </span>
                <span className="text-[11px] text-slate-400">
                  {settings?.address || "Medical Complex"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <Link href="/login" className="hover:text-white transition">
                Doctor / Staff Login
              </Link>
              <Link href="/register" className="hover:text-white transition">
                Patient Registration
              </Link>
              <Link href="/queue/display" className="hover:text-white transition">
                Live Queue Display
              </Link>
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© 2026 {settings?.hospital_name || "Hospital Management"}. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Currency: ৳ (BDT) • Instant E-Prescription with QR Verification</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
