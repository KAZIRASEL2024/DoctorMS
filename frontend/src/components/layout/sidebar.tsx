"use client";

import React, { useEffect } from "react";
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
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { currentRole } = useAuth();
  const { isOpen, close } = useSidebar();
  const { settings, isLoading } = useBranding();

  // Close sidebar drawer on route change
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
      { label: "Hospital Units (Bed/Cabin/ICU/CCU)", href: "/dashboard/units", icon: Bed },
      { label: "Billing & Invoices", href: "/dashboard/billing", icon: CreditCard },
      { label: "Website & Logo CMS", href: "/admin/website-settings", icon: Settings },
      { label: "Clinic Profile", href: "/dashboard/settings", icon: Building2 },
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
      {/* Mobile Drawer Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={close}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs lg:hidden transition-opacity duration-200"
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Fixed slide-out drawer on mobile / static sidebar on lg+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-slate-100 flex flex-col min-h-screen border-r border-slate-800 transition-transform duration-200 ease-in-out shrink-0 lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 sm:h-16 flex items-center justify-between px-5 sm:px-6 border-b border-slate-800 shrink-0">
          <Link href="/" className="flex items-center gap-3 min-w-0 hover:opacity-90 transition">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings?.hospital_name || "Logo"}
                className="w-8 h-8 rounded-xl object-contain bg-white/10 p-0.5 border border-slate-700 shrink-0"
              />
            ) : (
              <div className="bg-emerald-600 p-2 rounded-xl text-white shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <span className="font-bold text-base sm:text-lg tracking-tight truncate block max-w-[140px]">
                {settings?.hospital_name || "Mir Health"}
              </span>
              <span className="text-[10px] sm:text-xs block text-slate-400 font-mono truncate max-w-[140px]">
                {settings?.tagline || "Hospital SaaS"}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={close}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 sm:px-4 py-4 sm:py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={close}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[42px] ${
                  isActive
                    ? "bg-emerald-600 text-white shadow-xs font-semibold"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-xs text-slate-400 text-center shrink-0">
          Doctor & Clinic Management Platform
        </div>
      </aside>
    </>
  );
};
