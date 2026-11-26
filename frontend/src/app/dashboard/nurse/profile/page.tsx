"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  User,
  Phone,
  Mail,
  MapPin,
  GraduationCap,
  Briefcase,
  Award,
  Upload,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Camera,
  HeartPulse,
  Save,
  Clock,
  Sparkles,
  Star,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { LiveDutyTimer } from "@/components/nurse/live-duty-timer";
import { NurseProfile, NurseBooking } from "@/types";

export default function NurseProfilePage() {
  const { user, token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<NurseProfile | null>(null);
  const [activeBooking, setActiveBooking] = useState<NurseBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form State
  const [phone, setPhone] = useState("");
  const [serviceLocation, setServiceLocation] = useState("");
  const [education, setEducation] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [serviceFeeBdt, setServiceFeeBdt] = useState<number>(1500);
  const [bio, setBio] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const predefinedAreas = [
    "Dhanmondi",
    "Gulshan",
    "Uttara",
    "Mirpur",
    "Banani",
    "Mohammadpur",
    "Bashundhara",
    "Badda",
    "Mohakhali",
  ];

  const fetchProfileAndDuty = async () => {
    if (!token) return;
    try {
      // 1. Fetch Profile
      const profRes = await fetch("/api/v1/nurse/me/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (profRes.ok) {
        const pData: NurseProfile = await profRes.json();
        setProfile(pData);
        setPhone(pData.phone || "");
        setServiceLocation(pData.service_location || "Dhanmondi, Dhaka");
        setEducation(pData.education || "");
        setExperienceYears(pData.experience_years || "");
        setServiceFeeBdt(Number(pData.service_fee_bdt || 1500));
        setBio(pData.bio || "");
        setIsAvailable(pData.is_available);
        setAvatarPreview(pData.avatar_url || null);
      }

      // 2. Fetch Active duty if any
      const bookRes = await fetch("/api/v1/nurse/me/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (bookRes.ok) {
        const bData: NurseBooking[] = await bookRes.json();
        const active = bData.find((b) => b.duty_status === "In Progress");
        setActiveBooking(active || null);
      }
    } catch (err) {
      console.error("Failed to load nurse profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndDuty();
  }, [token]);

  // Handle Photo Selection & Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload directly to /api/v1/nurse/me/avatar
    setIsUploadingPhoto(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/v1/nurse/me/avatar", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to upload photo");
      }

      const data = await res.json();
      setAvatarPreview(data.avatar_url);
      if (profile) {
        setProfile({ ...profile, avatar_url: data.avatar_url });
      }

      setFeedback({
        type: "success",
        text: "Profile picture (DP) updated and published live across the clinic portal!",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to upload photo",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Handle Profile Details Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/v1/nurse/me/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          phone,
          service_location: serviceLocation,
          education,
          experience_years: experienceYears,
          service_fee_bdt: serviceFeeBdt,
          bio,
          is_available: isAvailable,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to save profile");
      }

      const updated = await res.json();
      setProfile(updated);
      setFeedback({
        type: "success",
        text: "Your clinical nurse profile details have been saved successfully!",
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to save profile",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndDuty = async (bookingId: string) => {
    try {
      const res = await fetch(`/api/v1/nurse/bookings/${bookingId}/end-duty`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveBooking(null);
        setFeedback({
          type: "success",
          text: `Duty completed! ${data.overtime_hours > 0 ? `+${data.overtime_hours}h overtime invoiced.` : ""}`,
        });
        setTimeout(() => setFeedback(null), 4000);
        await fetchProfileAndDuty();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard/nurse" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Nurse Account Settings
              </span>
              <span className="text-xs text-slate-500 font-sans">Profile v2.0</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <User className="w-6 h-6 text-emerald-600" />
              <span>My Nurse Profile & DP</span>
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Update your public photo, qualifications, service coverage area, and shift rates.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/nurse"
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl border border-slate-200 transition flex items-center gap-1.5 self-start sm:self-auto"
        >
          <HeartPulse className="w-4 h-4 text-emerald-600" />
          <span>Nurse Dashboard</span>
        </Link>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-3 transition-all ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ACTIVE DUTY TIMER (If currently on duty) */}
      {activeBooking && (
        <LiveDutyTimer
          booking={activeBooking}
          onEndDuty={handleEndDuty}
        />
      )}

      {/* Main Profile Editor Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        {isLoading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading nurse profile...</div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* DP / Profile Picture Upload Section */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt={profile?.full_name || "Nurse"}
                    className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md group-hover:opacity-90 transition"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-emerald-600 text-white font-bold text-3xl flex items-center justify-center border-4 border-white shadow-md">
                    {profile?.full_name ? profile.full_name.charAt(0) : "N"}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingPhoto}
                  className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md transition flex items-center justify-center disabled:opacity-50"
                  title="Upload new profile picture"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                  <h3 className="font-bold text-base text-slate-900">
                    {profile?.full_name || `${user?.first_name} ${user?.last_name}`}
                  </h3>
                  {profile?.total_reviews && profile.total_reviews > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>★ {Number(profile.average_rating || 5.0).toFixed(1)}</span>
                      <span className="font-normal text-amber-700">({profile.total_reviews} reviews)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <Star className="w-3 h-3 text-slate-400" />
                      <span>★ No reviews yet</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 max-w-md">
                  Upload a professional medical photo. This photo is visible to patients booking home nursing care and appears on verified booking cards.
                </p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingPhoto}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isUploadingPhoto ? "Uploading DP..." : "Upload New Picture (DP)"}</span>
                  </button>

                  <span className="text-[11px] text-slate-400">JPG, PNG or WEBP up to 5MB</span>
                </div>
              </div>
            </div>

            {/* Profile Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Full Name (Read-Only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Legal Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    disabled
                    value={profile?.full_name || ""}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Email Address (Read-Only) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Login Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    disabled
                    value={profile?.email || user?.email || ""}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone Number *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+880 1712-000000"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* Standard Session Rate */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Standard Shift Service Fee (৳ BDT) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400">৳</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={serviceFeeBdt}
                    onChange={(e) => setServiceFeeBdt(Number(e.target.value))}
                    className="w-full pl-8 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Hourly rate derived: ৳{Math.round(serviceFeeBdt / 4)}/hr
                </span>
              </div>
            </div>

            {/* Service Location with Quick Area Picker */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Home Care Coverage Area (Dhaka) *
                </label>
                <span className="text-[10px] text-slate-400">Click area to append</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {predefinedAreas.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => {
                      if (!serviceLocation.includes(area)) {
                        setServiceLocation(serviceLocation ? `${serviceLocation}, ${area}` : area);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition border ${
                      serviceLocation.includes(area)
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
              <div className="relative">
                <MapPin className="w-4 h-4 text-rose-500 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={serviceLocation}
                  onChange={(e) => setServiceLocation(e.target.value)}
                  placeholder="e.g. Dhanmondi, Lalmatia, Mohammadpur"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>
            </div>

            {/* Education & Experience */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nursing Education & Institution *
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={education}
                    onChange={(e) => setEducation(e.target.value)}
                    placeholder="e.g. BSc in Nursing, Dhaka Nursing College"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Experience & Specialization *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    placeholder="e.g. 6+ Years (Critical Care & Home Support)"
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Professional Bio */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Clinical Skills & Bio Summary
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your nursing skills: IV cannulation, catheterization, wound dressing, post-stroke recovery, tracheostomy care..."
                className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Availability Status Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Online Patient Booking Status</h4>
                <p className="text-xs text-slate-500">
                  {isAvailable
                    ? "Your profile is listed in the public directory and available for patient home bookings."
                    : "Your profile is paused; patients cannot book new home nursing visits."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAvailable(!isAvailable)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                  isAvailable
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                    : "bg-slate-200 text-slate-700 border-slate-300"
                }`}
              >
                {isAvailable ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                <span>{isAvailable ? "Active" : "Paused"}</span>
              </button>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <Link
                href="/dashboard/nurse"
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Saving..." : "Save Profile Details"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
