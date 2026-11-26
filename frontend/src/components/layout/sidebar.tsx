"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { useBranding } from "@/lib/branding-context";
import {
  Calendar,
  Users,
  UserPlus,
  Clock,
  FileText,
  CreditCard,
  Settings,
  Activity,
  Stethoscope,
  Building2,
  Tv,
  Bed,
  ShieldCheck,
  HeartPulse,
  UserCog,
  Pin,
  X,
  FlaskConical,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { currentRole } = useAuth();
  const { isOpen, close, isPinned, togglePin } = useSidebar();
  const { settings } = useBranding();

  // Desktop hover state for mini-rail expand
  const [isHovered, setIsHovered] = useState(false);

  // Expanded on desktop if hovered or locked/pinned; always full width when mobile drawer is open
  const isExpanded = isHovered || isPinned;

  // Close mobile drawer on route change
  useEffect(() => {
    close();
  }, [pathname]);

  // Role-specific navigation items
  let navItems: NavItem[] = [];

  if (currentRole === "SUPER_ADMIN" || currentRole === "CLINIC_ADMIN") {
    navItems = [
      { label: "Dashboard", href: "/dashboard/admin", icon: Activity },
      { label: "Staff & Doctors", href: "/dashboard/admin/staff", icon: Users },
      { label: "Patients", href: "/dashboard/patients", icon: UserPlus },
      { label: "Appointments", href: "/dashboard/appointments", icon: Calendar },
      { label: "Live Queue", href: "/dashboard/receptionist", icon: Clock },
      { label: "Lab Facilities (Tests)", href: "/dashboard/admin/lab-tests", icon: FlaskConical },
      { label: "Hospital Units (Bed/Cabin/ICU/CCU)", href: "/dashboard/units", icon: Bed },
      { label: "Billing & Invoices", href: "/dashboard/billing", icon: CreditCard },
      { label: "Website & Logo CMS", href: "/admin/website-settings", icon: Settings },
      { label: "Clinic Profile", href: "/dashboard/settings", icon: Building2 },
      { label: "Admin Profile", href: "/dashboard/admin/profile", icon: UserCog },
      { label: "Audit Logs", href: "/dashboard/admin/audit", icon: ShieldCheck },
    ];
  } else if (currentRole === "DOCTOR") {
    navItems = [
      { label: "Clinical Queue", href: "/dashboard/doctor", icon: Stethoscope },
      { label: "Hospital Units (Bed/Cabin/ICU/CCU)", href: "/dashboard/units", icon: Bed },
      { label: "My Schedule", href: "/dashboard/doctor/schedule", icon: Calendar },
      { label: "Patients EMR", href: "/dashboard/patients", icon: Users },
      { label: "E-Prescriptions", href: "/dashboard/prescriptions", icon: FileText },
      { label: "Doctor Profile", href: "/doctor/profile", icon: Users },
    ];
  } else if (currentRole === "PATIENT") {
    navItems = [
      { label: "Patient Portal", href: "/patient/dashboard", icon: Activity },
      { label: "Book Appointment", href: "/dashboard/appointments/book", icon: Calendar },
      { label: "Home Care Nurses", href: "/nurses", icon: Users },
      { label: "My Prescriptions", href: "/dashboard/prescriptions", icon: FileText },
      { label: "My Bills & Receipts", href: "/patient/bills", icon: CreditCard },
      { label: "My Profile", href: "/patient/profile", icon: Users },
    ];
  } else if (currentRole === "NURSE") {
    navItems = [
      { label: "Nurse Dashboard", href: "/dashboard/nurse", icon: Activity },
      { label: "My Patient Bookings", href: "/dashboard/nurse", icon: Calendar },
      { label: "Nurse Profile & DP", href: "/dashboard/nurse/profile", icon: Users },
      { label: "Public Directory", href: "/nurses", icon: HeartPulse },
    ];
  } else {
    // RECEPTIONIST default
    navItems = [
      { label: "Live Waiting Room", href: "/dashboard/receptionist", icon: Clock },
      { label: "Book Appointment", href: "/dashboard/appointments/book", icon: Calendar },
      { label: "Register Patient", href: "/dashboard/patients/new", icon: UserPlus },
      { label: "Hospital Units", href: "/dashboard/units", icon: Bed },
      { label: "Billing Desk", href: "/dashboard/billing", icon: CreditCard },
      { label: "TV Display Board", href: "/queue/display", icon: Tv },
    ];
  }

  return (
    <>
      {/* Mobile Drawer Backdrop Overlay (< lg) */}
      {isOpen && (
        <div
          onClick={close}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Fixed slide-out drawer on mobile (< lg) / Hover-to-expand Mini-Rail on Desktop (lg+) */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-40 bg-slate-900 text-slate-100 flex flex-col min-h-screen border-r border-slate-800 transition-all duration-200 ease-out shrink-0 select-none ${isOpen ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full"
          } lg:translate-x-0 ${isExpanded ? "lg:w-64 lg:shadow-2xl" : "lg:w-[72px]"
          }`}
      >
        {/* Top Branding Header */}
        <div
          className={`h-14 sm:h-16 flex items-center border-b border-slate-800 shrink-0 px-3.5 transition-all duration-200 ${isExpanded ? "justify-between" : "lg:justify-center justify-between"
            }`}
        >
          <Link
            href="/"
            className={`flex items-center gap-3 min-w-0 hover:opacity-90 transition ${isExpanded ? "w-auto" : "lg:justify-center"
              }`}
            title={settings?.hospital_name || "Mir Health"}
          >
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings?.hospital_name || "Logo"}
                className="w-9 h-9 rounded-xl object-contain bg-white/10 p-1 border border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[var(--brand-primary)] text-white flex items-center justify-center shrink-0 shadow-xs">
                <Stethoscope className="w-5 h-5" />
              </div>
            )}

            {/* Hospital Name & Tagline: Hidden on collapsed rail, smoothly visible on expanded */}
            <div
              className={`min-w-0 transition-all duration-200 ${isExpanded
                ? "opacity-100 max-w-[145px]"
                : "opacity-0 w-0 max-w-0 overflow-hidden lg:hidden"
                }`}
            >
              <span className="font-bold text-sm sm:text-base text-white tracking-tight truncate block whitespace-nowrap">
                {settings?.hospital_name || "Mir Health"}
              </span>
              <span className="text-[10px] block text-slate-400 font-sans truncate whitespace-nowrap">
                {settings?.tagline || "Hospital SaaS"}
              </span>
            </div>
          </Link>

          {/* Mobile close button (< lg) */}
          <button
            type="button"
            onClick={close}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop Pin Toggle Button (visible when expanded on lg+) */}
          {isExpanded && (
            <button
              type="button"
              onClick={togglePin}
              title={isPinned ? "Unpin sidebar (collapse to hover-rail)" : "Pin sidebar open"}
              className="hidden lg:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition items-center justify-center"
              aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              <Pin
                className={`w-4 h-4 transition-transform ${isPinned ? "text-emerald-400 rotate-45" : "text-slate-400"
                  }`}
              />
            </button>
          )}
        </div>

        {/* Navigation Items List */}
        <nav className="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" &&
                item.href !== "/dashboard/admin" &&
                pathname.startsWith(item.href + "/"));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                title={!isExpanded ? item.label : undefined}
                className={`group relative flex items-center rounded-xl transition-all duration-200 min-h-[42px] ${isExpanded
                  ? "px-3.5 py-2.5 gap-3 w-full justify-start"
                  : "lg:w-11 lg:h-11 lg:p-0 lg:justify-center lg:mx-auto px-3.5 py-2.5 gap-3 w-full justify-start"
                  } ${isActive
                    ? "bg-[var(--brand-primary)] text-white shadow-sm font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white font-medium"
                  }`}
              >
                {/* Crisp centered 20px Lucide icon */}
                <Icon className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105" />

                {/* Text Label: Hidden on collapsed rail, smoothly visible on expanded */}
                <span
                  className={`text-sm whitespace-nowrap truncate transition-all duration-200 ${isExpanded
                    ? "opacity-100 max-w-[180px]"
                    : "opacity-0 w-0 max-w-0 overflow-hidden lg:hidden"
                    }`}
                >
                  {item.label}
                </span>

                {/* Sleek Tooltip Preview when Rail is Collapsed */}
                {!isExpanded && (
                  <div className="hidden lg:group-hover:flex absolute left-full ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap pointer-events-none z-50 border border-slate-700 animate-in fade-in duration-150">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Platform Tagline */}
        <div
          className={`p-3 border-t border-slate-800 text-[11px] font-medium text-slate-400 text-center shrink-0 transition-all duration-200 ${isExpanded ? "opacity-100" : "lg:opacity-0 lg:h-0 lg:p-0 lg:overflow-hidden opacity-100"
            }`}
        >
          <span className="whitespace-nowrap">Doctor & Clinic Platform</span>
        </div>
      </aside>
    </>
  );
};
