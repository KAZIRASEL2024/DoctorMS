"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { useBranding } from "@/lib/branding-context";
import { LogOut, Building, ShieldCheck, User as UserIcon, PhoneCall, Menu } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, activeMembership, currentRole, switchClinic, logout } = useAuth();
  const { toggle } = useSidebar();
  const { settings, isLoading } = useBranding();

  const profileHref =
    currentRole === "PATIENT"
      ? "/patient/profile"
      : currentRole === "DOCTOR"
      ? "/doctor/profile"
      : currentRole === "SUPER_ADMIN"
      ? "/admin/website-settings"
      : "/dashboard/settings";

  return (
    <header className="h-14 sm:h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shrink-0">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        {/* Mobile Hamburger Drawer Toggle */}
        <button
          type="button"
          onClick={toggle}
          className="lg:hidden p-2 text-slate-700 hover:text-slate-900 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition shrink-0 min-h-[40px] min-w-[40px] flex items-center justify-center border border-slate-200"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Dynamic Hospital / Clinic Branding */}
        <Link href="/" className="flex items-center gap-2 min-w-0 hover:opacity-90 transition">
          {settings?.logo_url ? (
            <img
              src={settings.logo_url}
              alt={settings?.hospital_name || "Hospital Logo"}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain border border-slate-100 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
              <Building className="w-4 h-4" />
            </div>
          )}
          <span className="font-bold text-slate-800 text-xs sm:text-sm truncate max-w-[130px] sm:max-w-[200px]">
            {settings?.hospital_name || activeMembership?.clinic_name || "Mir Health"}
          </span>
        </Link>

        {/* Multi-Clinic Switcher if multiple memberships */}
        {user && user.clinic_memberships && user.clinic_memberships.length > 1 && (
          <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs shrink-0">
            <span className="text-slate-400">Branch:</span>
            <select
              value={activeMembership?.clinic_id || ""}
              onChange={(e) => switchClinic(e.target.value)}
              className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
            >
              {user.clinic_memberships.map((m) => (
                <option key={m.clinic_id} value={m.clinic_id}>
                  {m.clinic_name} ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Emergency Hotline Pill */}
        {settings?.emergency_hotline && (
          <a
            href={`tel:${settings.emergency_hotline}`}
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition shrink-0"
          >
            <PhoneCall className="w-3 h-3 text-rose-600 animate-pulse" />
            <span>24/7 Hotline: {settings.emergency_hotline}</span>
          </a>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Role Badge */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
          <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>{currentRole || "STAFF"}</span>
        </span>

        {/* User Info & Profile Link */}
        <Link
          href={profileHref}
          className="flex items-center gap-2 p-1 sm:p-1.5 rounded-lg hover:bg-slate-50 transition shrink-0"
          title="View & Edit Profile"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs overflow-hidden shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : user?.first_name ? (
              user.first_name[0]
            ) : (
              <UserIcon className="w-3.5 h-3.5" />
            )}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-semibold text-slate-800 leading-tight">
              {user ? `${user.first_name} ${user.last_name}` : "User"}
            </div>
            <div className="text-[11px] text-slate-500 leading-tight truncate max-w-[140px]">
              {user?.email}
            </div>
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={logout}
          title="Sign out"
          className="p-1.5 sm:p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
