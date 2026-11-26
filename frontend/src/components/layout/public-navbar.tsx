"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useBranding } from "@/lib/branding-context";
import { BackButton } from "@/components/ui/back-button";
import {
  Stethoscope,
  Building,
  Menu,
  X,
  ArrowRight,
  Tv,
  Users,
  FileText,
  Activity,
  LogIn,
  FlaskConical,
} from "lucide-react";

interface WebsiteSettings {
  hospital_name: string;
  tagline?: string;
  logo_url?: string | null;
}

interface PublicNavbarProps {
  settings?: WebsiteSettings | null;
  showBack?: boolean;
}

export const PublicNavbar: React.FC<PublicNavbarProps> = ({ settings: propSettings, showBack = false }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { settings: contextSettings, isLoading } = useBranding();

  // Auto-close drawer on pathname change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const settings = propSettings || contextSettings;
  const hospitalName = settings?.hospital_name;
  const tagline = settings?.tagline;

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          {/* Left: Brand + optional Back button */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {showBack && (
              <BackButton fallbackHref="/" label="Home" />
            )}
            <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={hospitalName || "Hospital"}
                  className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl object-contain border border-slate-200 shadow-xs shrink-0"
                />
              ) : (
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/20 group-hover:scale-105 transition-transform shrink-0">
                  <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
              )}
              <div className="min-w-0">
                <span className="font-bold text-sm sm:text-lg text-slate-900 tracking-tight leading-tight block truncate max-w-[170px] sm:max-w-[280px]">
                  {hospitalName || "Mir Health"}
                </span>
                <span className="text-[10px] sm:text-xs text-slate-600 font-medium leading-none block truncate max-w-[170px] sm:max-w-[280px]">
                  {tagline || "Smart EMR & Patient Management"}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-medium text-slate-600">
            <Link
              href="/specialties"
              className={`hover:text-emerald-600 transition ${pathname === "/specialties" ? "text-emerald-600 font-bold" : ""}`}
            >
              Specialties
            </Link>
            <Link
              href="/nurses"
              className={`hover:text-emerald-600 transition ${pathname === "/nurses" ? "text-emerald-600 font-bold" : ""}`}
            >
              Nurses
            </Link>
            <Link
              href="/lab-facilities"
              className={`hover:text-emerald-600 transition ${pathname === "/lab-facilities" ? "text-emerald-600 font-bold" : ""}`}
            >
              Lab Facilities
            </Link>
            <Link
              href="/queue/display"
              className="hover:text-emerald-600 transition flex items-center gap-1.5"
            >
              <span>Live Queue TV</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">
                LIVE
              </span>
            </Link>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop Action CTAs */}
            <Link
              href="/login"
              className="hidden sm:inline-flex px-3.5 py-2 text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="px-3.5 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5 min-h-[40px] whitespace-nowrap"
            >
              <span>Patient Portal</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Link>

            {/* Mobile Hamburger Drawer Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-700 hover:text-slate-900 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200"
              aria-label="Open mobile navigation menu"
            >
              <Menu className="w-5 h-5 text-slate-800" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Out Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Dark Semi-Transparent Backdrop */}
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
            aria-hidden="true"
          />

          {/* Slide-Out Drawer Panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col justify-between p-5 border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  {settings?.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt={hospitalName || "Hospital"}
                      className="w-8 h-8 rounded-xl object-contain border border-slate-200 shadow-xs shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Stethoscope className="w-4 h-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">
                      {hospitalName || "Mir Health"}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">Patient Navigation</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition min-h-[38px] min-w-[38px] flex items-center justify-center"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Navigation Links */}
              <nav className="mt-5 space-y-1.5">
                <Link
                  href="/specialties"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition min-h-[44px] ${pathname === "/specialties"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                  <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Specialties</span>
                </Link>

                <Link
                  href="/nurses"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition min-h-[44px] ${pathname === "/nurses"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                >
                  <Users className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Nurses</span>
                </Link>

                <Link
                  href="/lab-facilities"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition min-h-[44px] ${
                    pathname === "/lab-facilities"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <FlaskConical className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Lab Facilities</span>
                </Link>

                <Link
                  href="/queue/display"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition min-h-[44px]"
                >
                  <div className="flex items-center gap-3">
                    <Tv className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Live Queue TV</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700 font-bold border border-emerald-200">
                    LIVE
                  </span>
                </Link>
              </nav>
            </div>

            {/* Drawer Footer Actions */}
            <div className="pt-5 border-t border-slate-100 space-y-2.5">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs sm:text-sm text-center flex items-center justify-center gap-2 transition min-h-[42px]"
              >
                <LogIn className="w-4 h-4 text-slate-600" />
                <span>Sign In to Portal</span>
              </Link>

              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs sm:text-sm text-center flex items-center justify-center gap-2 shadow-xs transition min-h-[42px]"
              >
                <span>Patient Portal & Appointments</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <div className="text-[10px] text-slate-400 text-center pt-1">
                24/7 Clinical & Emergency Support
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
