"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import {
  Building,
  Upload,
  Image as ImageIcon,
  PhoneCall,
  Mail,
  MapPin,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";

interface SettingsData {
  id: string;
  clinic_id?: string;
  hospital_name: string;
  tagline: string;
  emergency_hotline: string;
  contact_email: string;
  address: string;
  hero_title: string;
  hero_subtitle: string;
  logo_url?: string | null;
  hero_image_url?: string | null;
}

export default function WebsiteSettingsPage() {
  const { user, token } = useAuth();
  const { settings: cachedSettings, updateBrandingCache } = useBranding();

  const [hospitalName, setHospitalName] = useState(cachedSettings?.hospital_name || "");
  const [tagline, setTagline] = useState(cachedSettings?.tagline || "");
  const [hotline, setHotline] = useState(cachedSettings?.emergency_hotline || "");
  const [email, setEmail] = useState(cachedSettings?.contact_email || "");
  const [address, setAddress] = useState(cachedSettings?.address || "");
  const [heroTitle, setHeroTitle] = useState(cachedSettings?.hero_title || "");
  const [heroSubtitle, setHeroSubtitle] = useState(cachedSettings?.hero_subtitle || "");
  const [logoUrl, setLogoUrl] = useState<string>(cachedSettings?.logo_url || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [isLoading, setIsLoading] = useState(!cachedSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/v1/settings/public");
        if (res.ok) {
          const data: SettingsData = await res.json();
          setHospitalName(data.hospital_name || "");
          setTagline(data.tagline || "");
          setHotline(data.emergency_hotline || "");
          setEmail(data.contact_email || "");
          setAddress(data.address || "");
          setHeroTitle(data.hero_title || "");
          setHeroSubtitle(data.hero_subtitle || "");
          setLogoUrl(data.logo_url || "");
        }
      } catch (err) {
        console.error("Error loading website settings", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
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
      // If logo file or data url changed, upload logo first
      let activeLogo = logoUrl;
      if (logoFile || (logoUrl && logoUrl.startsWith("data:"))) {
        const formData = new FormData();
        if (logoFile) {
          formData.append("file", logoFile);
        } else {
          formData.append("logo_data_url", logoUrl);
        }

        const logoRes = await fetch("/api/v1/settings/upload-logo", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        if (logoRes.ok) {
          const lData = await logoRes.json();
          activeLogo = lData.logo_url;
        }
      }

      // Update text settings
      const res = await fetch("/api/v1/settings/website", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hospital_name: hospitalName,
          tagline: tagline,
          emergency_hotline: hotline,
          contact_email: email,
          address: address,
          hero_title: heroTitle,
          hero_subtitle: heroSubtitle,
          logo_url: activeLogo || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Save failed" }));
        throw new Error(err.detail || "Failed to update website settings");
      }

      // Sync instant localStorage cache across application
      updateBrandingCache({
        hospital_name: hospitalName,
        tagline: tagline,
        emergency_hotline: hotline,
        contact_email: email,
        address: address,
        hero_title: heroTitle,
        hero_subtitle: heroSubtitle,
        logo_url: activeLogo || null,
      });

      setSuccessMessage("Website branding and logo CMS settings successfully published live!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading CMS settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/dashboard/admin" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Super Admin Control
              </span>
              <span className="text-xs text-slate-400">• Live Public Portal</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">Website Branding & Logo CMS</h1>
            <p className="text-xs text-slate-500">
              Customize the hospital name, uploaded logo, emergency hotline, and hero showcase. Changes immediately apply to the Landing Page, Login, Navbar, and PDF Prescriptions.
            </p>
          </div>
        </div>

        <Link
          href="/"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition"
        >
          <Eye className="w-4 h-4" />
          <span>View Public Landing Page</span>
        </Link>
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

      {/* Live Preview Card */}
      <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white rounded-2xl p-6 border border-slate-800 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>Live Header & Navbar Simulation</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">Dynamic Frontend Binding</span>
        </div>

        <div className="flex items-center justify-between bg-white/5 backdrop-blur-md rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo Preview"
                className="w-10 h-10 rounded-xl object-contain bg-white/10 p-1 border border-white/20"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold">
                <Building className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="font-bold text-sm tracking-tight">{hospitalName || "Hospital Name"}</div>
              <div className="text-[11px] text-slate-400">{tagline || "Hospital Tagline"}</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 font-medium">
              <PhoneCall className="w-3 h-3 text-rose-400 animate-pulse" />
              <span>{hotline || "Hotline"}</span>
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Card 1: Logo Upload & Management */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Hospital Logo Management</h3>
              <p className="text-xs text-slate-500">
                Upload official vector SVG, transparent PNG, or high-res JPG. Automatically rendered across Navbar, Login screen, and Prescription PDF headers.
              </p>
            </div>
            <ImageIcon className="w-5 h-5 text-emerald-600" />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 pt-2">
            <div className="w-32 h-32 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center p-3 relative group overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Hospital Logo" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="text-center text-slate-400">
                  <Building className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[11px]">No Logo</span>
                </div>
              )}
            </div>

            <div className="space-y-3 flex-1 text-center sm:text-left">
              <div>
                <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-sm transition">
                  <Upload className="w-4 h-4" />
                  <span>Upload New Hospital Logo</span>
                  <input type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
                </label>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogoUrl("");
                      setLogoFile(null);
                    }}
                    className="ml-3 inline-flex items-center gap-1 text-xs text-rose-600 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Recommended size: 512x512px or 400x120px with transparent background.
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                <span className="px-2 py-0.5 rounded bg-slate-100">✓ Navbar Header</span>
                <span className="px-2 py-0.5 rounded bg-slate-100">✓ Login Page</span>
                <span className="px-2 py-0.5 rounded bg-slate-100">✓ Public Landing Page</span>
                <span className="px-2 py-0.5 rounded bg-slate-100">✓ Prescription PDF Header</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: General Hospital Details */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Hospital Identification & Contact Info
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Hospital / Clinic Name *
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  placeholder="e.g. City General Hospital & Medical Center"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Hospital Tagline / Motto *
              </label>
              <input
                type="text"
                required
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Excellence in Compassionate Care & Advanced Medicine"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                24/7 Emergency Hotline *
              </label>
              <div className="relative">
                <PhoneCall className="w-4 h-4 text-rose-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={hotline}
                  onChange={(e) => setHotline(e.target.value)}
                  placeholder="+880 1711-001122"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Official Contact Email *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@metrohealth.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Hospital Physical Address *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="100 Medical Plaza, Suite 400, Dhaka, Bangladesh"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Hero Banner CMS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Landing Page Hero Banner CMS
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Hero Headline (Title) *
              </label>
              <input
                type="text"
                required
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                placeholder="e.g. World-Class Healthcare, Close to You"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Hero Descriptive Subtitle *
              </label>
              <textarea
                rows={3}
                required
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                placeholder="e.g. Experience seamless medical appointments, digital prescriptions, and expert diagnostics..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-end gap-3">
          <Link
            href="/"
            className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
          >
            Preview Site
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Publish Website CMS Live</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
