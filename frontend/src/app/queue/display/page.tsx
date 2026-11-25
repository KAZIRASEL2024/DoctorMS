"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { LiveQueueItem } from "@/types";
import { Stethoscope, Volume2, Clock, CheckCircle } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useBranding } from "@/lib/branding-context";

export default function TVDisplayPage() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const { settings, isLoading } = useBranding();

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: queue = [] } = useQuery({
    queryKey: ["live-queue-tv"],
    queryFn: () => apiClient<LiveQueueItem[]>("/queue/live"),
    refetchInterval: 3000,
  });

  const calledTokens = queue.filter((q) => q.status === "CALLED" || q.status === "WITH_DOCTOR");
  const waitingTokens = queue.filter((q) => q.status === "WAITING");

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none overflow-hidden">
      {/* Top Bar */}
      <header className="h-24 bg-slate-900 border-b border-slate-800 px-10 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <BackButton
            fallbackHref="/dashboard/receptionist"
            label="Exit Board"
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white"
          />
          <div className="flex items-center gap-4">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.hospital_name || "Logo"}
                className="w-14 h-14 rounded-2xl object-contain bg-white/10 p-1 border border-slate-700 shadow-lg shrink-0"
              />
            ) : (
              <div className="p-3 bg-emerald-600 rounded-2xl text-white shadow-lg shadow-emerald-600/30 shrink-0">
                <Stethoscope className="w-8 h-8" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white uppercase">
                {settings?.hospital_name || "Mir Health"}
              </h1>
              <p className="text-sm font-semibold text-emerald-400 uppercase tracking-widest">
                {settings?.tagline || "Live Patient Calling Board"}
              </p>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-3xl font-mono font-bold tracking-tight text-slate-100">
            {currentTime}
          </div>
          <div className="text-xs font-semibold text-slate-400 uppercase">Live Clinic Feed</div>
        </div>
      </header>

      {/* Main Board Grid */}
      <main className="flex-1 p-10 grid grid-cols-12 gap-8">
        {/* Left 8 Cols: NOW SERVING */}
        <div className="col-span-8 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 flex flex-col shadow-2xl">
          <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
            <Volume2 className="w-7 h-7 text-emerald-400 animate-bounce" />
            <h2 className="text-xl font-bold uppercase tracking-wider text-emerald-400">
              Now Serving / In Consultation
            </h2>
          </div>

          <div className="flex-1 mt-6">
            {calledTokens.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-500 text-lg">
                Please take a seat. Doctor will call the next token shortly.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-6">
                {calledTokens.map((item) => (
                  <div
                    key={item.token_id}
                    className="bg-slate-800/90 border-2 border-emerald-500/60 rounded-2xl p-6 shadow-lg shadow-emerald-500/10 animate-fade-in"
                  >
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                      Token Number
                    </div>
                    <div className="text-5xl font-mono font-black text-emerald-400 tracking-tight">
                      {item.token_code}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-700/60">
                      <div className="text-lg font-bold text-white truncate">
                        {item.patient_name}
                      </div>
                      <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                        {item.doctor_name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Cols: UPCOMING IN LINE */}
        <div className="col-span-4 bg-slate-900/60 border border-slate-800 rounded-3xl p-8 flex flex-col">
          <div className="flex items-center gap-2 pb-6 border-b border-slate-800">
            <Clock className="w-6 h-6 text-emerald-400" />
            <h2 className="text-lg font-bold uppercase tracking-wider text-emerald-400">
              Next in Line ({waitingTokens.length})
            </h2>
          </div>

          <div className="flex-1 mt-6 space-y-3 overflow-y-auto max-h-[600px]">
            {waitingTokens.length === 0 ? (
              <div className="text-center text-slate-500 py-12 text-sm">
                No patients waiting in queue.
              </div>
            ) : (
              waitingTokens.map((item, index) => (
                <div
                  key={item.token_id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-5 py-3.5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-mono font-bold text-slate-500">
                      #{index + 1}
                    </span>
                    <span className="text-2xl font-mono font-black text-slate-100">
                      {item.token_code}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-medium text-slate-400 block truncate max-w-[140px]">
                      {item.doctor_name}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Waiting: {item.wait_time_minutes}m
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer Ticker */}
      <footer className="h-12 bg-slate-900 border-t border-slate-800 px-10 flex items-center justify-between text-xs text-slate-400 font-medium">
        <span>Please have your token slip and ID ready when your number is called.</span>
        <span>DoctorMS Queue Engine • Live Updates</span>
      </footer>
    </div>
  );
}
