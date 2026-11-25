"use client";

import React, { useState, useEffect } from "react";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  MapPin,
  User,
  ShieldAlert,
  Flame,
  PowerOff,
} from "lucide-react";
import { NurseBooking } from "@/types";

interface LiveDutyTimerProps {
  booking: NurseBooking;
  onEndDuty: (bookingId: string) => Promise<void>;
  isEnding?: boolean;
}

export function LiveDutyTimer({ booking, onEndDuty, isEnding }: LiveDutyTimerProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    if (!booking.duty_started_at) return;

    const startTime = new Date(booking.duty_started_at).getTime();

    const calculateElapsed = () => {
      const now = Date.now();
      const elapsed = Math.max(0, Math.floor((now - startTime) / 1000));
      setElapsedSeconds(elapsed);
    };

    calculateElapsed();
    const interval = setInterval(calculateElapsed, 1000);

    return () => clearInterval(interval);
  }, [booking.duty_started_at]);

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  const contractedHours = booking.contracted_hours || 4.0;
  const contractedSeconds = contractedHours * 3600;
  const isOvertime = elapsedSeconds > contractedSeconds;

  const overtimeHours = isOvertime
    ? ((elapsedSeconds - contractedSeconds) / 3600).toFixed(2)
    : "0.00";
  const hourlyRate = booking.hourly_rate_bdt || 300.0;
  const overtimeDueBdt = isOvertime
    ? Math.round(((elapsedSeconds - contractedSeconds) / 3600) * hourlyRate)
    : 0;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 border shadow-md transition-all ${
        isOvertime
          ? "bg-slate-900 border-amber-500/50 text-white"
          : "bg-slate-900 border-emerald-500/40 text-white"
      }`}
    >
      {/* Background ambient glow */}
      <div
        className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20 ${
          isOvertime ? "bg-amber-500" : "bg-emerald-500"
        }`}
      />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Live status and Digital Timer */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                isOvertime
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full animate-ping ${
                  isOvertime ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
              <span>{isOvertime ? "Active Overtime Duty" : "Live Duty In Progress"}</span>
            </span>

            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">
              {booking.booking_code}
            </span>

            <span className="text-xs text-slate-300">
              Contracted: <strong className="text-white font-mono">{contractedHours}h</strong> shift
            </span>
          </div>

          {/* Large Digital Clock Display */}
          <div className="flex items-baseline gap-2">
            <div className="font-mono text-3xl sm:text-5xl font-black tracking-tight text-white flex items-center gap-1">
              <span className="bg-white/10 px-2 py-1 rounded-xl">{formattedHours}h</span>
              <span className="text-emerald-400 animate-pulse">:</span>
              <span className="bg-white/10 px-2 py-1 rounded-xl">{formattedMinutes}m</span>
              <span className="text-emerald-400 animate-pulse">:</span>
              <span
                className={`px-2 py-1 rounded-xl ${
                  isOvertime ? "bg-amber-500/30 text-amber-300" : "bg-emerald-500/30 text-emerald-300"
                }`}
              >
                {formattedSeconds}s
              </span>
            </div>
          </div>

          {/* Patient Details & Location */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-300 pt-1">
            <span className="flex items-center gap-1.5 font-medium text-white">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{booking.patient_name || "Patient Member"}</span>
            </span>

            {booking.patient_phone && (
              <a
                href={`tel:${booking.patient_phone}`}
                className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium underline"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{booking.patient_phone}</span>
              </a>
            )}

            <span className="flex items-center gap-1 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate max-w-xs">{booking.patient_address}</span>
            </span>
          </div>

          {/* Overtime Alert Ribbon */}
          {isOvertime && (
            <div className="mt-2 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs flex items-start gap-2.5 text-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">
                  Duty has exceeded {contractedHours} contracted hours!
                </p>
                <p className="text-[11px] text-amber-200/90 mt-0.5">
                  Current Overtime: <strong className="font-mono text-white">+{overtimeHours} hrs</strong> extra.
                  An automatic overtime invoice of{" "}
                  <strong className="font-mono text-white font-bold">
                    ৳{overtimeDueBdt.toLocaleString()}
                  </strong>{" "}
                  (@ ৳{hourlyRate}/hr) will be billed to the patient upon completion.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
          <div className="text-left lg:text-right bg-white/10 px-4 py-2.5 rounded-2xl border border-white/10">
            <div className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider">
              Hourly Care Rate
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              ৳ {hourlyRate.toLocaleString()}
              <span className="text-xs font-sans text-slate-300 font-normal"> / hr</span>
            </div>
          </div>

          <button
            onClick={() => onEndDuty(booking.id)}
            disabled={isEnding}
            className="w-full sm:w-auto px-5 py-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <PowerOff className="w-4 h-4" />
            <span>{isEnding ? "Calculating & Ending..." : "Off / Complete Duty"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
