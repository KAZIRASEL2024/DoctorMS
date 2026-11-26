"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { DoctorDirectory } from "@/components/doctors/doctor-directory";
import { DoctorProfile } from "@/types";
import { formatDoctorName } from "@/lib/utils";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { useBranding } from "@/lib/branding-context";
import {
  Stethoscope,
  Building,
  PhoneCall,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Heart,
  Activity,
  Award,
  Users,
  FileText,
  MapPin,
  Mail,
  ChevronRight,
  Sparkles,
  FlaskConical,
} from "lucide-react";

export default function HomePage() {
  const { settings, isLoading } = useBranding();
  const [firstDoctor, setFirstDoctor] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const res = await fetch("/api/v1/doctors");
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data?.items || [];
          if (list.length > 0) {
            setFirstDoctor(list[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load doctors", err);
      }
    };

    fetchDoctors();
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Emergency & Info Bar */}
      <div className="bg-slate-950 text-white text-xs py-2 px-6 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-rose-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              24/7 Emergency ICU Hotline:
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

      {/* Main Public Navbar with Slide-Out Mobile Drawer */}
      <PublicNavbar settings={settings} />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-emerald-50/50 via-white to-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-semibold">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>Smart Hospital & Polyclinic SaaS</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
                {settings?.hero_title || "World-Class Healthcare, Close to You"}
              </h1>

              <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
                {settings?.hero_subtitle ||
                  "Experience seamless medical appointments, digital prescriptions, and expert diagnostics from top certified specialists."}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/register"
                  className="px-7 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-2xl text-base shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition"
                >
                  <Calendar className="w-5 h-5" />
                  <span>Book Consultation Now</span>
                </Link>

                <Link
                  href="/login"
                  className="px-7 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-2xl text-base transition flex items-center gap-2"
                >
                  <span>Portal Login</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Value Props */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t border-slate-100">
                <div>
                  <div className="text-2xl font-bold text-slate-900 tabular-nums">24/7</div>
                  <div className="text-xs text-slate-600 font-semibold">Emergency Care</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600 tabular-nums">৳ BDT</div>
                  <div className="text-xs text-slate-600 font-semibold">Transparent Pricing</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">QR-Code</div>
                  <div className="text-xs text-slate-600 font-semibold">Verified E-Prescriptions</div>
                </div>
              </div>
            </div>

            {/* Right Visual Image */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full max-w-lg aspect-[16/10] sm:aspect-[16/9] rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                <img
                  src="/images/medical-team.jpg"
                  alt={settings?.hospital_name ? `Medical & Nursing Team at ${settings.hospital_name}` : "Verified Medical & Nursing Team"}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 text-white">
                  <div className="px-2.5 py-1 bg-emerald-600 rounded-md text-[11px] font-bold uppercase inline-block mb-1">
                    Verified Medical & Nursing Team
                  </div>
                  <div className="text-base sm:text-lg font-bold truncate">
                    {settings?.hospital_name || "Mir Health Specialist Care"}
                  </div>
                  <div className="text-xs text-slate-300 truncate">
                    {settings?.tagline || "Advanced Healthcare & Patient Management"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties & Doctor Directory Section */}
      <section id="specialties" className="py-20 bg-slate-50 border-t border-slate-200">
        <div id="doctors" className="max-w-7xl mx-auto px-6">
          <DoctorDirectory
            title="Specialized Care & Doctor Chambers"
            subtitle="Browse verified senior consultants across all clinical departments, view visiting hours and chambers, and book consultations instantly."
          />
        </div>
      </section>

      {/* Lab Facilities & Diagnostic Tests Section */}
      <section id="features" className="py-20 bg-slate-50/70 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1.5 mb-2">
                <FlaskConical className="w-4 h-4" />
                <span>Hospital Diagnostics & Pathology</span>
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                Lab Facilities & Diagnostic Tests
              </h2>
              <p className="text-sm text-slate-600 mt-2">
                Certified high-precision laboratory testing with automated analyzers, transparent BDT rates, and rapid digital report delivery.
              </p>
            </div>

            <Link
              href="/lab-facilities"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-sm shadow-emerald-600/20 transition self-start md:self-auto shrink-0"
            >
              <span>View All Lab Tests</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Diagnostic Tests Preview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                code: "LAB-01",
                name: "Complete Blood Count (CBC)",
                category: "Pathology",
                sample: "Blood",
                price: 450,
                delivery: "Same Day (4 Hours)",
              },
              {
                code: "LAB-03",
                name: "Lipid Profile Panel",
                category: "Biochemistry",
                sample: "Blood",
                price: 1200,
                delivery: "Same Day (6 Hours)",
              },
              {
                code: "LAB-04",
                name: "HbA1c (Glycated Hb)",
                category: "Biochemistry",
                sample: "Blood",
                price: 1000,
                delivery: "1 Day",
              },
              {
                code: "LAB-06",
                name: "Serum Creatinine & RFT",
                category: "Biochemistry",
                sample: "Blood",
                price: 400,
                delivery: "Same Day (4 Hours)",
              },
              {
                code: "LAB-08",
                name: "Digital Chest X-Ray (PA)",
                category: "Radiology & Imaging",
                sample: "Imaging",
                price: 600,
                delivery: "Same Day (2 Hours)",
              },
              {
                code: "LAB-09",
                name: "12-Lead Resting ECG",
                category: "Cardiology",
                sample: "Non-Invasive",
                price: 500,
                delivery: "Instant (30 Mins)",
              },
              {
                code: "LAB-10",
                name: "Color Doppler Echo",
                category: "Cardiology",
                sample: "Imaging",
                price: 2800,
                delivery: "Same Day (4 Hours)",
              },
              {
                code: "LAB-11",
                name: "Whole Abdomen USG",
                category: "Radiology & Imaging",
                sample: "Imaging",
                price: 1500,
                delivery: "Same Day (3 Hours)",
              },
            ].map((t) => (
              <div
                key={t.code}
                className="bg-white/90 backdrop-blur-sm p-5 rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {t.code}
                    </span>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      {t.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-slate-900 leading-snug line-clamp-2">
                    {t.name}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Sample: <span className="font-medium text-slate-700">{t.sample}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{t.delivery}</span>
                  </div>
                  <div className="font-mono font-bold text-base text-slate-900">
                    ৳{t.price.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-slate-950 text-white pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-slate-800">
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-3">
                {settings?.logo_url ? (
                  <img
                    src={settings.logo_url}
                    alt={settings?.hospital_name || "Hospital Logo"}
                    className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-lg leading-tight">
                    {settings?.hospital_name || "Mir Health"}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {settings?.tagline || "Smart EMR & Patient Management"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                A multi-tenant healthcare SaaS empowering polyclinics, independent practitioners, and medical groups with real-time appointment scheduling, electronic medical records, and digital prescriptions.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-sm uppercase text-slate-200 tracking-wider mb-3">Portal Access</h5>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link href="/login" className="hover:text-white transition">
                    Staff & Doctor Login
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="hover:text-white transition">
                    Patient Self-Registration
                  </Link>
                </li>
                <li>
                  <Link href="/queue/display" className="hover:text-white transition">
                    Waiting Room TV Board
                  </Link>
                </li>
                <li>
                  <Link href="/admin/website-settings" className="hover:text-white transition">
                    Super Admin CMS
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-sm uppercase text-slate-200 tracking-wider mb-3">Emergency Contact</h5>
              <div className="space-y-2 text-slate-300">
                <p className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-rose-500" />
                  <span className="font-bold text-white tabular-nums">
                    {settings?.emergency_hotline || "+880 1711-001122"}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span>{settings?.contact_email || "care@hospital.com"}</span>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{settings?.address || "100 Medical Plaza, Suite 400, Dhaka"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
            <p>© 2026 {settings?.hospital_name || "Hospital Management"}. All rights reserved.</p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>HIPAA & GDPR Standard Architecture • Currency: ৳ (BDT)</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
