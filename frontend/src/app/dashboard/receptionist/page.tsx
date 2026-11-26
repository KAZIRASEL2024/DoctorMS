"use client";

import React from "react";
import { LiveQueueBoard } from "@/components/queue/live-queue-board";
import Link from "next/link";
import { UserPlus, Calendar, PlusCircle, CreditCard } from "lucide-react";

export default function ReceptionistDashboard() {
  return (
    <div className="space-y-6">
      {/* Quick Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Reception & Front Desk</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Manage live patient check-ins, waiting room queue callouts, and appointment scheduling.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/dashboard/billing"
            className="flex-1 sm:flex-none justify-center px-3.5 sm:px-4 py-2 min-h-[40px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4 text-emerald-700" /> <span>Billing & Desk</span>
          </Link>
          <Link
            href="/dashboard/appointments/book"
            className="flex-1 sm:flex-none justify-center px-3.5 sm:px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs transition whitespace-nowrap"
          >
            <Calendar className="w-4 h-4" /> <span>Book Appt</span>
          </Link>
          <Link
            href="/dashboard/patients/new"
            className="w-full sm:w-auto justify-center px-3.5 sm:px-4 py-2 min-h-[40px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4 text-slate-500" /> <span>New Patient</span>
          </Link>
        </div>
      </div>

      {/* Embedded Live Queue Component */}
      <LiveQueueBoard />
    </div>
  );
}
