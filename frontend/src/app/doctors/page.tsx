"use client";

import React from "react";
import { DoctorDirectory } from "@/components/doctors/doctor-directory";
import { BackButton } from "@/components/ui/back-button";
import { Stethoscope } from "lucide-react";

export default function DoctorsPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BackButton fallbackHref="/" label="Back to Home" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                <Stethoscope className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-sm">Consulting Doctors Directory</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        <DoctorDirectory />
      </main>
    </div>
  );
}
