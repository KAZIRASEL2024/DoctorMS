"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  User as UserIcon,
  Mail,
  Phone,
  Stethoscope,
  Award,
  FileCheck,
  CreditCard,
  Save,
  CheckCircle2,
  AlertCircle,
  Camera,
  ArrowLeft,
  FileSignature,
} from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";

export default function DoctorProfilePage() {
  const { user, token } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  // Doctor credentials
  const [specialization, setSpecialization] = useState("Cardiology");
  const [qualifications, setQualifications] = useState("MBBS, MD, FACC");
  const [licenseNumber, setLicenseNumber] = useState("MED-CARD-9921");
  const [consultationFee, setConsultationFee] = useState(1200);
  const [bio, setBio] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/v1/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          const d = data.doctor;

          setFirstName(u.first_name || "");
          setLastName(u.last_name || "");
          setPhone(u.phone || "");
          setEmail(u.email || "");
          setAvatarUrl(u.avatar_url || "");

          if (d) {
            setSpecialization(d.specialization || "Cardiology");
            setQualifications(d.qualifications || "MBBS, MD");
            setLicenseNumber(d.license_number || "MED-9921");
            setConsultationFee(d.consultation_fee || 1000);
            setBio(d.bio || "");
            setSignatureUrl(d.signature_image_url || "");
          }
        }
      } catch (err) {
        console.error("Error loading doctor profile", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const localPreview = URL.createObjectURL(file);
    setAvatarUrl(localPreview);

    setIsUploadingAvatar(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/v1/doctors/me/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.avatar_url) {
          setAvatarUrl(data.avatar_url);
          setSuccessMessage("Doctor profile photo updated successfully!");
        }
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAvatarUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error("Avatar upload failed, falling back to base64", err);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          avatar_url: avatarUrl || null,
          specialization: specialization,
          qualifications: qualifications,
          license_number: licenseNumber,
          consultation_fee: Number(consultationFee),
          bio: bio,
          signature_image_url: signatureUrl || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Update failed" }));
        throw new Error(err.detail || "Failed to update doctor profile");
      }

      const updated = await res.json();
      if (typeof window !== "undefined" && updated.user) {
        localStorage.setItem("user_info", JSON.stringify(updated.user));
        localStorage.setItem("user", JSON.stringify(updated.user));
      }
      setSuccessMessage("Doctor profile and clinical credentials updated successfully!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save credentials");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading doctor credentials...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard/doctor" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Physician Profile & Credentials</h1>
            <p className="text-sm text-slate-600 mt-0.5">
              Manage professional certifications, consultation fees (৳), and prescription signatures
            </p>
          </div>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
          <Award className="w-4 h-4 text-emerald-600" />
          <span>Licensed Specialist</span>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Photo Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Doctor Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-slate-400" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full cursor-pointer shadow-md transition">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>

          <div className="text-center sm:text-left space-y-1">
            <h3 className="text-base font-bold text-slate-900">Doctor Portrait</h3>
            <p className="text-xs text-slate-500">
              This photo will be displayed on the patient appointment booking portal and digital consultation queue.
            </p>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                className="text-xs text-rose-600 hover:underline pt-1"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            General Contact Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Official Phone *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Qualifications & Financials */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Clinical Qualifications & Consultation Fee
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Clinical Specialization *
              </label>
              <div className="relative">
                <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Senior Cardiologist"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Medical License Number *
              </label>
              <div className="relative">
                <FileCheck className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="e.g. BMDC-A-9921"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Degrees & Qualifications *
              </label>
              <input
                type="text"
                required
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                placeholder="e.g. MBBS, FCPS (Cardiology), FACC (USA)"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Consultation Fee (৳ BDT) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 font-bold text-slate-500">৳</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  required
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Professional Bio & Clinical Focus
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Brief summary of your clinical expertise and special interests..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Digital Signature */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">E-Prescription Digital Signature</h3>
              <p className="text-xs text-slate-500">
                Rendered automatically at the bottom of digital PDF prescriptions with QR verification.
              </p>
            </div>
            <FileSignature className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-48 h-20 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center p-2 overflow-hidden">
              {signatureUrl ? (
                <img src={signatureUrl} alt="Signature" className="max-h-full object-contain" />
              ) : (
                <span className="text-xs text-slate-400 font-mono italic">Dr. {lastName || "Smith"}</span>
              )}
            </div>

            <div>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl cursor-pointer transition">
                <FileSignature className="w-4 h-4 text-slate-600" />
                <span>Upload Signature Image</span>
                <input type="file" accept="image/*" onChange={handleSignatureChange} className="hidden" />
              </label>
              <p className="text-[11px] text-slate-400 mt-1">Recommended: Transparent PNG, 300x120px</p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Doctor Profile</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
