"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { BookingWizard } from "@/components/appointments/booking-wizard";
import { AdminBookingForm } from "@/components/appointments/admin-booking-form";
import { BackButton } from "@/components/ui/back-button";

export default function BookAppointmentPage() {
  const { user, currentRole, isLoading } = useAuth();

  const isStaffOrAdmin =
    user?.system_role === "SUPER_ADMIN" ||
    user?.system_role === "STAFF" ||
    currentRole === "SUPER_ADMIN" ||
    currentRole === "CLINIC_ADMIN" ||
    currentRole === "RECEPTIONIST" ||
    user?.clinic_memberships?.some(
      (m: any) => m.role === "CLINIC_ADMIN" || m.role === "RECEPTIONIST"
    );

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-400">Loading appointment booking desk...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref={isStaffOrAdmin ? "/dashboard/appointments" : "/patient/dashboard"} />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isStaffOrAdmin ? "Admin Appointment Booking Desk" : "Appointment Desk"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isStaffOrAdmin
              ? "Register walk-in or returning patient consultations with real-time schedule conflict validation."
              : "Select doctor availability, reserve conflict-free time slots, and register consultations."}
          </p>
        </div>
      </div>

      {isStaffOrAdmin ? <AdminBookingForm /> : <BookingWizard />}
    </div>
  );
}
