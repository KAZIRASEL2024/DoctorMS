"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { BackButton } from "@/components/ui/back-button";
import { NurseProfile } from "@/types";
import {
  MapPin,
  GraduationCap,
  Briefcase,
  Phone,
  Mail,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  X,
  ArrowRight,
  Heart,
  Activity,
  AlertCircle,
  Stethoscope,
  Filter,
} from "lucide-react";

function NurseDirectoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useAuth();

  const [nurses, setNurses] = useState<NurseProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchLocation, setSearchLocation] = useState(searchParams.get("location") || "");
  const [selectedArea, setSelectedArea] = useState<string>("All Areas");

  // Booking Modal State
  const [selectedNurse, setSelectedNurse] = useState<NurseProfile | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [contractedHours, setContractedHours] = useState<number>(4);
  const [shiftTime, setShiftTime] = useState("Day Shift (8:00 AM - 12:00 PM)");
  const [patientAddress, setPatientAddress] = useState("House 42, Road 7, Dhanmondi, Dhaka");
  const [careNotes, setCareNotes] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<any | null>(null);

  const durationOptions = [
    { hours: 2, label: "2 Hours", desc: "Short Care / Dressing", defaultShift: "2-Hour Visit (8:00 AM - 10:00 AM)" },
    { hours: 4, label: "4 Hours", desc: "Half-Day Shift", defaultShift: "Day Shift (8:00 AM - 12:00 PM)" },
    { hours: 8, label: "8 Hours", desc: "Full Day Shift", defaultShift: "Day Shift (8:00 AM - 4:00 PM)" },
    { hours: 12, label: "12 Hours", desc: "Day/Night 12h", defaultShift: "Extended Shift (8:00 AM - 8:00 PM)" },
    { hours: 24, label: "24 Hours", desc: "24h Continuous", defaultShift: "24-Hour Continuous Care" },
  ];

  const getHourlyRate = (nurse: NurseProfile | null) => {
    if (!nurse) return 375;
    if (nurse.hourly_rate_bdt) return Number(nurse.hourly_rate_bdt);
    const fee = Number(nurse.service_fee_bdt || 0);
    return fee >= 600 ? Math.round(fee / 4) : (fee > 0 ? fee : 375);
  };

  const predefinedAreas = ["All Areas", "Dhanmondi", "Uttara", "Gulshan", "Mirpur", "Banani", "Mohakhali"];

  // Fetch Nurses
  const fetchNurses = async (loc?: string) => {
    setIsLoading(true);
    try {
      let url = "/api/v1/public/nurses";
      if (loc && loc !== "All Areas" && loc.trim() !== "") {
        url += `?location=${encodeURIComponent(loc.trim())}`;
      }
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setNurses(data);

        // Check if pre-selected nurse query parameter is set
        const preselectNurseId = searchParams.get("nurseId");
        if (preselectNurseId && data.length > 0) {
          const match = data.find((n: NurseProfile) => n.id === preselectNurseId);
          if (match) {
            handleInitiateBooking(match);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch nurses", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNurses(searchLocation);
  }, [searchLocation]);

  const handleAreaFilter = (area: string) => {
    setSelectedArea(area);
    if (area === "All Areas") {
      setSearchLocation("");
      fetchNurses("");
    } else {
      setSearchLocation(area);
      fetchNurses(area);
    }
  };

  const handleInitiateBooking = (nurse: NurseProfile) => {
    if (!user) {
      // Auth-gate: redirect unauthenticated visitor to login
      router.push(`/login?redirect=/nurses?nurseId=${nurse.id}`);
      return;
    }
    setSelectedNurse(nurse);
    setBookingError(null);
    setBookingSuccess(null);
    setIsBookingModalOpen(true);
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNurse) return;

    setIsSubmittingBooking(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/v1/nurse-bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nurse_id: selectedNurse.id,
          service_date: serviceDate,
          shift_time: shiftTime,
          contracted_hours: contractedHours,
          patient_address: patientAddress,
          care_notes: careNotes,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: "Booking failed" }));
        throw new Error(errData.detail || "Failed to confirm nurse booking");
      }

      const bookingData = await res.json();
      setBookingSuccess(bookingData);
    } catch (err: any) {
      setBookingError(err.message || "Failed to submit booking");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <PublicNavbar showBack={true} />

      {/* Hero Banner */}
      <section className="bg-gradient-to-b from-emerald-50/60 via-white to-slate-50 border-b border-slate-200 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified Home Healthcare Services</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight">
              Home Care Nursing Service
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
              Connect with government-registered clinical nurses for dedicated in-home patient monitoring, post-operative surgical wound dressing, catheterization, tracheostomy, and elderly palliative care across Dhaka.
            </p>
          </div>

          {/* Search & Location Filter Bar */}
          <div className="mt-8 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm max-w-3xl space-y-3">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5" />
              <input
                type="text"
                value={searchLocation}
                onChange={(e) => {
                  setSearchLocation(e.target.value);
                  setSelectedArea("Custom");
                }}
                placeholder="Search by area or location (e.g. Dhanmondi, Uttara, Mirpur, Gulshan)..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
              {searchLocation && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchLocation("");
                    handleAreaFilter("All Areas");
                  }}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Location Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
                <MapPin className="w-3 h-3 text-emerald-600" /> Area:
              </span>
              {predefinedAreas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => handleAreaFilter(area)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedArea === area
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Nurse Cards Directory */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex-1 w-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Available Clinical Nurses
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Showing {nurses.length} verified registered nurse{nurses.length === 1 ? "" : "s"} ready for home visits
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Licensed & Police-Verified Staff</span>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 animate-pulse shadow-xs"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-200" />
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-slate-200 rounded w-3/4" />
                    <div className="h-4 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-16 bg-slate-100 rounded-xl" />
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        ) : nurses.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Nurses Found for this Area</h3>
            <p className="text-xs text-slate-500">
              We couldn't find any active nurses in &quot;{searchLocation}&quot;. Try selecting &quot;All Areas&quot; or searching nearby areas like Dhanmondi, Uttara, or Gulshan.
            </p>
            <button
              type="button"
              onClick={() => handleAreaFilter("All Areas")}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-500 transition"
            >
              View All Dhaka Nurses
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {nurses.map((nurse) => (
              <div
                key={nurse.id}
                className="bg-white border border-slate-200 hover:border-emerald-500/50 rounded-2xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top: DP, Name & Location */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative shrink-0">
                      <img
                        src={
                          nurse.avatar_url ||
                          "https://images.unsplash.com/photo-1594824813689-ff371cb76550?q=80&w=400&auto=format&fit=crop"
                        }
                        alt={nurse.full_name}
                        className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
                      />
                      <span
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"
                        title="Available for Home Booking"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Verified Nurse
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-emerald-600" />
                          {nurse.service_location}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-slate-900 mt-1 truncate">
                        {nurse.full_name}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium truncate">
                        {nurse.experience_years}
                      </p>
                    </div>
                  </div>

                  {/* Qualifications & Bio */}
                  <div className="space-y-2.5 text-xs text-slate-600 py-3 border-y border-slate-100 mb-4">
                    <div className="flex items-start gap-2">
                      <GraduationCap className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="font-medium text-slate-800">{nurse.education}</span>
                    </div>

                    <div className="flex items-start gap-2">
                      <Briefcase className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{nurse.experience_years}</span>
                    </div>

                    {nurse.bio && (
                      <p className="text-slate-500 line-clamp-2 italic pt-1 border-t border-slate-50">
                        &quot;{nurse.bio}&quot;
                      </p>
                    )}
                  </div>

                  {/* Contact Info Badges */}
                  <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-500 mb-4">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono">{nurse.phone}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{nurse.email}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Fee & Book Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Hourly / Shift Fee
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-slate-900 font-mono">
                        ৳{getHourlyRate(nurse).toLocaleString()}
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">/hr</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 font-semibold block">
                      ৳{Number(nurse.service_fee_bdt).toLocaleString()} / 4h standard
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleInitiateBooking(nurse)}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-emerald-600/20 flex items-center gap-1.5 transition"
                  >
                    <span>Book Nurse</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* BOOKING MODAL */}
      {isBookingModalOpen && selectedNurse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Book Home Care Nurse</h3>
                  <p className="text-xs text-slate-500">Official Hospital In-Home Clinical Dispatch</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bookingSuccess ? (
              <div className="p-6 space-y-4 text-center">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100 shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-slate-900">Nurse Care Booked Successfully!</h4>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking Reference:</span>
                    <span className="font-mono font-bold text-slate-900">{bookingSuccess.booking_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned Nurse:</span>
                    <span className="font-bold text-slate-900">{bookingSuccess.nurse_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contracted Hours:</span>
                    <span className="font-bold text-emerald-700">{bookingSuccess.contracted_hours || contractedHours} Hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hourly Rate:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      ৳{Number(bookingSuccess.hourly_rate_bdt || getHourlyRate(selectedNurse)).toLocaleString()}/hr
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service Date & Shift:</span>
                    <span className="font-medium text-slate-800">
                      {bookingSuccess.service_date} ({bookingSuccess.shift_time})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service Location:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[220px]">
                      {bookingSuccess.patient_address}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                    <span className="text-slate-900">Initial Total Billed:</span>
                    <span className="text-emerald-700 font-mono">
                      ৳{Number(bookingSuccess.fee_bdt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">Payment & Duty Status:</span>
                    <span className="px-2 py-0.5 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      Awaiting Reception Payment (Invoice: {bookingSuccess.invoice_number})
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-left text-[11px] text-emerald-900 space-y-1">
                  <div className="font-bold flex items-center gap-1 text-emerald-800">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Receptionist Payment-Gate Protocol:</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Once the hospital receptionist confirms settlement of this invoice at the billing desk, the nurse&apos;s <strong>Live Running Duty Clock</strong> will be automatically unlocked to start service. Overtime beyond {contractedHours} hours will auto-calculate at ৳{getHourlyRate(selectedNurse)}/hr.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Link
                    href="/patient/bills"
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs text-center transition"
                  >
                    View in My Bills
                  </Link>
                  <Link
                    href="/patient/dashboard"
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs text-center shadow-xs transition"
                  >
                    Patient Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitBooking} className="p-6 space-y-4">
                {/* Selected Nurse Summary */}
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <img
                    src={selectedNurse.avatar_url || "https://images.unsplash.com/photo-1594824813689-ff371cb76550?q=80&w=400&auto=format&fit=crop"}
                    alt={selectedNurse.full_name}
                    className="w-12 h-12 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 text-sm truncate">{selectedNurse.full_name}</div>
                    <div className="text-xs text-emerald-800 flex items-center gap-1 font-medium">
                      <MapPin className="w-3 h-3" /> {selectedNurse.service_location} • ৳{getHourlyRate(selectedNurse)}/hr (৳{Number(selectedNurse.service_fee_bdt).toLocaleString()}/4h)
                    </div>
                  </div>
                </div>

                {bookingError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bookingError}</span>
                  </div>
                )}

                {/* Contracted Duration Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Contracted Duty Duration *
                    </label>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      Rate: ৳{getHourlyRate(selectedNurse)}/hr
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {durationOptions.map((opt) => {
                      const isSelected = contractedHours === opt.hours;
                      return (
                        <button
                          key={opt.hours}
                          type="button"
                          onClick={() => {
                            setContractedHours(opt.hours);
                            setShiftTime(opt.defaultShift);
                          }}
                          className={`p-2 rounded-xl text-center border transition flex flex-col items-center justify-center ${
                            isSelected
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          <span className="font-bold text-xs">{opt.label}</span>
                          <span
                            className={`text-[10px] mt-0.5 truncate max-w-[80px] ${
                              isSelected ? "text-emerald-100" : "text-slate-400"
                            }`}
                          >
                            {opt.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Cost Calculation Banner */}
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Live Duty Billing Calculation
                    </span>
                    <div className="font-mono text-slate-800 font-medium text-xs">
                      {contractedHours} Hours × ৳{getHourlyRate(selectedNurse).toLocaleString()}/hr
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total BDT</span>
                    <span className="text-base font-black text-emerald-700 font-mono">
                      ৳{(contractedHours * getHourlyRate(selectedNurse)).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Date & Shift */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Service Date *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split("T")[0]}
                      value={serviceDate}
                      onChange={(e) => setServiceDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Shift / Schedule Details *
                    </label>
                    <input
                      type="text"
                      required
                      value={shiftTime}
                      onChange={(e) => setShiftTime(e.target.value)}
                      placeholder="e.g. Day Shift (8:00 AM - 12:00 PM)"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                  </div>
                </div>

                {/* Home / Hospital Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Home / Hospital Service Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={patientAddress}
                    onChange={(e) => setPatientAddress(e.target.value)}
                    placeholder="e.g. House 42, Road 7, Sector 3, Uttara, Dhaka"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Patient Care Requirements */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Care Requirements & Medical Notes
                  </label>
                  <textarea
                    rows={2}
                    value={careNotes}
                    onChange={(e) => setCareNotes(e.target.value)}
                    placeholder="e.g. Post-op wound dressing, catheter change, IV antibiotic infusion, elderly stroke support..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Financial Summary */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-slate-500">Due at Reception:</span>
                    <span className="font-bold text-slate-800 ml-1">
                      ৳{(contractedHours * getHourlyRate(selectedNurse)).toLocaleString()} BDT
                    </span>
                  </div>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Billed to Patient Invoice
                  </span>
                </div>

                {/* Submit button */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingBooking}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                  >
                    {isSubmittingBooking ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <span>Confirm Reservation</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 text-white pt-12 pb-8 border-t border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Home Care Nursing Service. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition">Home</Link>
            <Link href="/specialties" className="hover:text-white transition">Specialties</Link>
            <Link href="/login" className="hover:text-white transition">Portal Access</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function NursesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading Home Care Nurses...</div>}>
      <NurseDirectoryContent />
    </Suspense>
  );
}
