"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { DoctorProfile } from "@/types";
import { formatDoctorName } from "@/lib/utils";
import {
  Stethoscope,
  MapPin,
  Calendar,
  Clock,
  Search,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Users,
  Sparkles,
  PhoneCall,
} from "lucide-react";

interface DoctorDirectoryProps {
  title?: string;
  subtitle?: string;
}

export const DoctorDirectory: React.FC<DoctorDirectoryProps> = ({
  title = "Our Specialist Physicians & Chambers",
  subtitle = "Browse verified senior consultants, see their visiting schedules and chamber rooms, and book your appointment directly.",
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Fetch doctors publicly without requiring auth
  const { data: rawDoctors = [], isLoading, error } = useQuery<DoctorProfile[]>({
    queryKey: ["public-doctors"],
    queryFn: async () => {
      const res = await fetch("/api/v1/doctors");
      if (!res.ok) {
        throw new Error("Failed to load doctor directory");
      }
      return res.json();
    },
  });

  // Extract all unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    rawDoctors.forEach((d) => {
      const cat = d.specialty || d.category || d.specialization;
      if (cat) set.add(cat);
    });
    return ["ALL", ...Array.from(set)];
  }, [rawDoctors]);

  // Filter doctors by category & search query
  const filteredDoctors = useMemo(() => {
    return rawDoctors.filter((doc) => {
      const docCat = (doc.specialty || doc.category || doc.specialization || "").toLowerCase();
      if (selectedCategory !== "ALL" && !docCat.includes(selectedCategory.toLowerCase())) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${doc.first_name || ""} ${doc.last_name || ""}`.toLowerCase();
        const degrees = (doc.degrees || doc.qualifications || "").toLowerCase();
        const chamber = (doc.chamber_location || "").toLowerCase();
        return fullName.includes(q) || docCat.includes(q) || degrees.includes(q) || chamber.includes(q);
      }

      return true;
    });
  }, [rawDoctors, selectedCategory, searchQuery]);

  // Handle Book Appointment Click
  const handleBookClick = (docId: string) => {
    const targetUrl = `/dashboard/appointments/book?doctorId=${docId}`;
    if (user) {
      router.push(targetUrl);
    } else {
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
    }
  };

  return (
    <div className="space-y-10">
      {/* Directory Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100 text-xs font-semibold">
          <Stethoscope className="w-4 h-4 text-emerald-600" />
          <span>Doctor Consultation Directory</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          {title}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Search Bar & Category Filter Pills */}
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Search Input */}
        <div className="relative max-w-xl mx-auto">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor name, specialty, degree, or chamber room..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {categories.map((cat) => {
            const count =
              cat === "ALL"
                ? rawDoctors.length
                : rawDoctors.filter(
                    (d) =>
                      (d.specialty || d.category || d.specialization || "").toLowerCase() ===
                      cat.toLowerCase()
                  ).length;
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                  isSelected
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 ring-2 ring-emerald-600/30"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>{cat === "ALL" ? "All Specialties" : cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Doctor Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading verified doctor schedules & chambers...
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="py-16 text-center bg-slate-50 border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto">
          <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">No doctors found</h3>
          <p className="text-xs text-slate-500 mt-1">
            No specialists match the selected category &ldquo;{selectedCategory}&rdquo; or search query.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory("ALL");
              setSearchQuery("");
            }}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {filteredDoctors.map((doc) => {
            const displayName = formatDoctorName(doc.first_name, doc.last_name);
            const specialtyName = doc.specialty || doc.category || doc.specialization || "General Medicine";
            const degrees = doc.degrees || doc.qualifications || "MBBS, MD";
            const chamber = doc.chamber_location || "Room 101, Main Building";
            const visitingDays = doc.visiting_days || "Sat - Thu";
            const visitingHours = doc.visiting_hours || "5:00 PM - 9:00 PM";
            const consultFee = doc.consultation_fee || 1000;
            const followFee = doc.follow_up_fee || 500;

            const todayStr = new Date().toISOString().split("T")[0];
            const activeLeave = doc.confirmed_leaves?.find(
              (l) => l.start_date <= todayStr && l.end_date >= todayStr
            );
            const upcomingLeave = !activeLeave ? doc.confirmed_leaves?.find(
              (l) => l.start_date > todayStr
            ) : null;

            return (
              <div
                key={doc.id}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Card Header */}
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    {/* Doctor Avatar */}
                    {doc.avatar_url ? (
                      <img
                        src={doc.avatar_url}
                        alt={displayName}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-sm flex-shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-emerald-600/20 flex-shrink-0">
                        {doc.first_name ? doc.first_name.charAt(0) : "D"}
                      </div>
                    )}

                    {/* Name & Badge */}
                    <div className="flex-1 min-w-0">
                      <div className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 mb-1">
                        {specialtyName}
                      </div>
                      <h3 className="font-extrabold text-slate-900 text-lg leading-tight group-hover:text-emerald-600 transition truncate">
                        {displayName}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed mt-0.5 line-clamp-2">
                        {degrees}
                      </p>
                    </div>
                  </div>

                  {/* Real-time Live Clinical Duty & OT Status Badge */}
                  <div className="pt-1">
                    {activeLeave ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                        <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                        <span>On Confirmed Leave ({activeLeave.start_date} → {activeLeave.end_date})</span>
                      </span>
                    ) : doc.current_status === "In OT" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping shrink-0" />
                        <span>In OT • {doc.available_from_time || "Available soon"}</span>
                      </span>
                    ) : doc.current_status === "On Visit" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping shrink-0" />
                        <span>On Ward Visit • {doc.available_from_time || "Available soon"}</span>
                      </span>
                    ) : doc.current_status === "Off Duty" ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300">
                        <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                        <span>Off Duty Today</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                        <span>Available Today</span>
                      </span>
                    )}

                    {upcomingLeave && (
                      <div className="text-[10px] text-amber-700 mt-1 font-medium">
                        Upcoming leave: {upcomingLeave.start_date} to {upcomingLeave.end_date}
                      </div>
                    )}
                  </div>

                  {/* Chamber Room Location Box */}
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-start gap-2.5 text-xs text-slate-700">
                      <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-slate-900 leading-tight">Chamber Room</span>
                        <span className="text-[11px] text-slate-600">{chamber}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 text-xs text-slate-700 pt-1.5 border-t border-slate-200/60">
                      <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-slate-900 leading-tight">Visiting Schedule</span>
                        <span className="text-[11px] text-slate-600">
                          {visitingDays} • {visitingHours}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Pricing & Action */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      Consultation Fee
                    </span>
                    <div className="text-xl font-extrabold text-slate-900 leading-tight">
                      ৳ {consultFee.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-slate-400">Follow-up: ৳ {followFee.toLocaleString()}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBookClick(doc.id)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition group-hover:scale-105"
                  >
                    <span>Book Appointment</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
