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
                  <div className="text-2xl font-bold text-slate-900">24/7</div>
                  <div className="text-xs text-slate-500 font-medium">Emergency Care</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">৳ BDT</div>
                  <div className="text-xs text-slate-500 font-medium">Transparent Pricing</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-600">QR-Code</div>
                  <div className="text-xs text-slate-500 font-medium">Verified E-Prescriptions</div>
                </div>
              </div>
            </div>

            {/* Right Visual Image */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl border-4 border-white">
                <img
                  src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop"
                  alt={settings?.hospital_name ? `Doctor at ${settings.hospital_name}` : "Hospital Doctor"}
                  className="w-full h-full object-cover object-top"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=1000&auto=format&fit=crop";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 text-white">
                  <div className="px-2.5 py-1 bg-emerald-500 rounded-md text-[11px] font-bold uppercase inline-block mb-1">
                    Verified Senior Consultant
                  </div>
                  <div className="text-lg font-bold">
                    {firstDoctor
                      ? formatDoctorName(firstDoctor) + (firstDoctor.degrees ? `, ${firstDoctor.degrees}` : "")
                      : "Dr. John Smith, MD, FACC"}
                  </div>
                  <div className="text-xs text-slate-300">
                    {firstDoctor
                      ? firstDoctor.specialty || firstDoctor.specialization || firstDoctor.category || "Consultant Physician"
                      : "Head of Clinical Cardiology"}
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

      {/* Hospital Features Section */}
      <section id="features" className="py-20 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Integrated Cloud EMR & Patient Management
            </span>
            <h2 className="text-3xl font-extrabold text-slate-900 mt-2">
              Next-Generation Healthcare Cloud
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Our multidisciplinary healthcare units are equipped with state-of-the-art diagnostic machinery and seamless digital workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "Cardiology & CCU",
                desc: "Advanced ECG, Echocardiogram, and 24/7 cardiac monitoring by board-certified cardiologists.",
                icon: Heart,
                color: "text-rose-600 bg-rose-50 border-rose-100",
              },
              {
                title: "Digital E-Prescriptions",
                desc: "Instant digital prescription with medicine dosage, frequency, and QR verification authenticity.",
                icon: FileText,
                color: "text-emerald-600 bg-emerald-50 border-emerald-100",
              },
              {
                title: "Internal Medicine",
                desc: "Comprehensive diagnostic workups for hypertension, diabetes, and infectious illnesses.",
                icon: Stethoscope,
                color: "text-emerald-600 bg-emerald-50 border-emerald-100",
              },
              {
                title: "Smart Queue & TV Board",
                desc: "Live waiting room display board keeps patients informed and reduces clinic wait times.",
                icon: Clock,
                color: "text-emerald-600 bg-emerald-50 border-emerald-100",
              },
            ].map((spec, i) => {
              const Icon = spec.icon;
              return (
                <div
                  key={i}
                  className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl ${spec.color} flex items-center justify-center border mb-4`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-2">{spec.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{spec.desc}</p>
                </div>
              );
            })}
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
                  <p className="text-xs text-slate-400">
                    {settings?.tagline || "Smart EMR & Patient Management"}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                A multi-tenant healthcare SaaS empowering polyclinics, independent practitioners, and medical groups with real-time appointment scheduling, electronic medical records, and digital prescriptions.
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-sm uppercase text-slate-200 tracking-wider mb-3">Portal Access</h5>
              <ul className="space-y-2 text-slate-400">
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
              <div className="space-y-2 text-slate-400">
                <p className="flex items-center gap-2">
                  <PhoneCall className="w-4 h-4 text-rose-500" />
                  <span className="font-bold text-white font-mono">
                    {settings?.emergency_hotline || "+880 1711-001122"}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span>{settings?.contact_email || "care@hospital.com"}</span>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  <span>{settings?.address || "100 Medical Plaza, Suite 400, Dhaka"}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
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
