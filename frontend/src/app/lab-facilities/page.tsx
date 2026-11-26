"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { BackButton } from "@/components/ui/back-button";
import { useBranding } from "@/lib/branding-context";
import {
  FlaskConical,
  Search,
  Clock,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  PhoneCall,
  Sparkles,
  ArrowRight,
  Droplet,
  Activity,
  X,
  Building,
  Info,
} from "lucide-react";

interface LabTestItem {
  id: string;
  test_code: string;
  test_name: string;
  category: string;
  sample_type: string;
  price_bdt: number;
  report_delivery_time: string;
  is_active: boolean;
  description?: string;
}

const CATEGORIES = [
  "All Tests",
  "Pathology",
  "Biochemistry",
  "Radiology & Imaging",
  "Cardiology",
];

export default function LabFacilitiesPage() {
  const { settings } = useBranding();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Tests");

  // Query active lab tests
  const { data: tests = [], isLoading } = useQuery<LabTestItem[]>({
    queryKey: ["public-lab-tests"],
    queryFn: () => apiClient<LabTestItem[]>("/public/lab-tests"),
  });

  // Client-side filtering for instantaneous reactivity
  const filteredTests = useMemo(() => {
    return tests.filter((test) => {
      // Category filter
      if (
        selectedCategory !== "All Tests" &&
        test.category?.toLowerCase() !== selectedCategory.toLowerCase()
      ) {
        return false;
      }

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = test.test_name?.toLowerCase().includes(q);
        const matchesCode = test.test_code?.toLowerCase().includes(q);
        const matchesSample = test.sample_type?.toLowerCase().includes(q);
        const matchesCat = test.category?.toLowerCase().includes(q);
        const matchesDesc = test.description?.toLowerCase().includes(q);
        return matchesName || matchesCode || matchesSample || matchesCat || matchesDesc;
      }

      return true;
    });
  }, [tests, selectedCategory, searchTerm]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { "All Tests": tests.length };
    tests.forEach((t) => {
      counts[t.category] = (counts[t.category] || 0) + 1;
    });
    return counts;
  }, [tests]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <PublicNavbar settings={settings} />

      {/* Hero / Header Section with Glassy styling */}
      <section className="relative pt-12 pb-14 bg-gradient-to-b from-emerald-900 via-slate-900 to-slate-900 text-white overflow-hidden">
        {/* Subtle decorative background circles */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-72 h-72 bg-emerald-600/15 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <BackButton fallbackHref="/" className="bg-white/10 hover:bg-white/20 text-white border-white/15" />
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Diagnostic & Pathology Directory
            </span>
          </div>

          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Hospital Lab Facilities & Diagnostic Tests
            </h1>
            <p className="text-base sm:text-lg text-slate-300 mt-4 leading-relaxed">
              Explore our comprehensive catalog of laboratory investigations, certified automated pathology profiles, and digital imaging services with transparent BDT pricing (৳) and guaranteed turnaround times.
            </p>
          </div>

          {/* Quick Highlights Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4">
              <div className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Available Tests</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1 tabular-nums">
                {tests.length || 15}+
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Automated Diagnostics</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4">
              <div className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Turnaround Time</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Same Day</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Urgent Results in 2-4h</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4">
              <div className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Pricing Standard</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">৳ BDT</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Transparent & Regulated</div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4">
              <div className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Digital Delivery</div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mt-1">Online EMR</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Instant PDF Access</div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 -mt-6 pb-20 w-full relative z-20 space-y-6">
        {/* Search & Filter Glassy Container */}
        <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-slate-200/90 shadow-lg space-y-4">
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by Test Name (e.g., CBC, HbA1c, X-Ray, ECG, Lipid), Code (LAB-01), or Sample Type (Blood, Urine)..."
              className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat] ?? 0;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition border flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{cat}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? "bg-emerald-700/60 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Diagnostic Tests Directory */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 px-1">
            <span>
              Showing <strong className="text-slate-900">{filteredTests.length}</strong> of{" "}
              {tests.length} diagnostic investigations
            </span>
            <span>Fee in Bangladeshi Taka (৳ BDT)</span>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
              Loading hospital laboratory facilities...
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="py-16 text-center px-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <FlaskConical className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800">No diagnostic tests found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No investigations match &ldquo;{searchTerm}&rdquo; in the {selectedCategory} department.
              </p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("All Tests");
                }}
                className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 transition"
              >
                Clear Search & Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTests.map((test) => {
                const isPathology = test.category === "Pathology";
                const isBiochem = test.category === "Biochemistry";
                const isRadiology = test.category === "Radiology & Imaging";
                const isCardiology = test.category === "Cardiology";

                const categoryBadgeClass = isPathology
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : isBiochem
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : isRadiology
                  ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                  : isCardiology
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-slate-100 text-slate-700 border-slate-200";

                return (
                  <div
                    key={test.id}
                    className="bg-white/85 backdrop-blur-md rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md hover:border-emerald-400/80 transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/60">
                          {test.test_code}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${categoryBadgeClass}`}>
                            {test.category}
                          </span>
                        </div>
                      </div>

                      {/* Test Title */}
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-600 transition-colors leading-snug">
                        {test.test_name}
                      </h3>

                      {/* Sample Type */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1.5">
                        <Droplet className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>Sample: </span>
                        <span className="font-semibold text-slate-700">{test.sample_type}</span>
                      </div>

                      {/* Clinical Description */}
                      {test.description && (
                        <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                          {test.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Metadata & Pricing Row */}
                    <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                      {/* Delivery Time Badge */}
                      <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{test.report_delivery_time}</span>
                      </div>

                      {/* Fee in BDT */}
                      <div className="text-right">
                        <div className="font-mono font-extrabold text-lg text-slate-900 tabular-nums">
                          ৳{Number(test.price_bdt).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </div>
                        <span className="text-[10px] text-slate-600 font-sans">Official Rate</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Hospital Pathology & Diagnostic Commitment Card */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h4 className="font-bold text-base text-slate-900">Need a Specific Pathology or Radiology Workup?</h4>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 max-w-2xl">
              Our central clinical laboratory accepts walk-in samples and scheduled investigations 24 hours a day, 7 days a week. For home sample collection or special instructions, contact our diagnostic helpdesk.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {settings?.emergency_hotline && (
              <a
                href={`tel:${settings.emergency_hotline}`}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs flex items-center gap-2 shadow-2xs transition"
              >
                <PhoneCall className="w-4 h-4 text-emerald-600" />
                <span>Hotline: {settings.emergency_hotline}</span>
              </a>
            )}
            <Link
              href="/dashboard/appointments/book"
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition"
            >
              <Calendar className="w-4 h-4" />
              <span>Book Doctor Consultation</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto bg-slate-950 text-white py-10 border-t border-slate-800 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            © {new Date().getFullYear()} {settings?.hospital_name || "Metro Health Hospital"}. All diagnostic fees subject to hospital billing regulations.
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <Link href="/" className="hover:text-emerald-400 transition">Home</Link>
            <Link href="/specialties" className="hover:text-emerald-400 transition">Specialties</Link>
            <Link href="/nurses" className="hover:text-emerald-400 transition">Home Care Nurses</Link>
            <Link href="/login" className="hover:text-emerald-400 transition">Staff Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
