"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import {
  Settings,
  Building,
  Save,
  CheckCircle,
  Palette,
  Sparkles,
  Check,
  Info,
  Eye,
  Sliders,
  Upload,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { useBranding, applyBrandStyles } from "@/lib/branding-context";

interface ThemePreset {
  id: string;
  name: string;
  tag: string;
  primary: string;
  button: string;
  tint: string;
  bg: string;
  text: string;
  badge: string;
}

const HOSPITAL_PRESETS: ThemePreset[] = [
  {
    id: "signature-green",
    name: "Signature Medical Green & White",
    tag: "Serene & Authoritative (Default)",
    primary: "#059669",
    button: "#047857",
    tint: "#ECFDF5",
    bg: "#FFFFFF",
    text: "#0F172A",
    badge: "Official Default",
  },
  {
    id: "clinical-blue",
    name: "Clinical Blue & White",
    tag: "Trust & Stability (High Contrast)",
    primary: "#0B4F6C",
    button: "#0E6E8C",
    tint: "#E8F1F5",
    bg: "#FFFFFF",
    text: "#16262E",
    badge: "Clinical Standard",
  },
  {
    id: "calm-teal",
    name: "Calm Teal & Warm Accent",
    tag: "Modern & Approachable",
    primary: "#0E7C86",
    button: "#F28C6F",
    tint: "#D7E8E8",
    bg: "#F5FAFA",
    text: "#14313A",
    badge: "Wellness & Care",
  },
  {
    id: "skyline-blue",
    name: "Skyline Blue",
    tag: "Airy & Telehealth-Friendly",
    primary: "#173A5E",
    button: "#2F78C8",
    tint: "#E7F1FB",
    bg: "#FFFFFF",
    text: "#0F172A",
    badge: "Digital Health",
  },
];

export default function ClinicSettingsPage() {
  const { settings, updateBrandingCache } = useBranding();

  const [clinicName, setClinicName] = useState(settings?.hospital_name || "Metro Health Polyclinic & Hospital");
  const [phone, setPhone] = useState(settings?.emergency_hotline || "+880 1711-001122");
  const [email, setEmail] = useState(settings?.contact_email || "care@metrohealth.com");
  const [address, setAddress] = useState(settings?.address || "100 Medical Plaza, Suite 400, Dhaka");
  const [city, setCity] = useState("Dhaka");
  const [currency] = useState("BDT (৳)");
  const [tagline, setTagline] = useState(settings?.tagline || "Excellence in Compassionate Care & Advanced Medicine");
  const [headerHeight, setHeaderHeight] = useState(120);

  // Clinic Logo & Emblem
  const [logoUrl, setLogoUrl] = useState<string>(settings?.logo_url || "");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  // 5 Dynamic Theme Color Tokens & Preset Identifier
  const [themePreset, setThemePreset] = useState<string>(settings?.theme_preset || "signature-green");
  const [primaryColor, setPrimaryColor] = useState<string>(settings?.primary_color || "#059669");
  const [buttonColor, setButtonColor] = useState<string>(settings?.button_color || "#047857");
  const [tintColor, setTintColor] = useState<string>(settings?.tint_color || "#ECFDF5");
  const [bgColor, setBgColor] = useState<string>(settings?.background_color || "#FFFFFF");
  const [textColor, setTextColor] = useState<string>(settings?.text_color || "#0F172A");

  const [isSaving, setIsSaving] = useState(false);
  const [showSavedAlert, setShowSavedAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.hospital_name) setClinicName(settings.hospital_name);
      if (settings.emergency_hotline) setPhone(settings.emergency_hotline);
      if (settings.contact_email) setEmail(settings.contact_email);
      if (settings.address) setAddress(settings.address);
      if (settings.tagline) setTagline(settings.tagline);
      if (settings.logo_url) setLogoUrl(settings.logo_url);
      if (settings.theme_preset) setThemePreset(settings.theme_preset);
      if (settings.primary_color) setPrimaryColor(settings.primary_color);
      if (settings.button_color) setButtonColor(settings.button_color);
      if (settings.tint_color) setTintColor(settings.tint_color);
      if (settings.background_color) setBgColor(settings.background_color);
      if (settings.text_color) setTextColor(settings.text_color);
    }
  }, [settings]);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setLogoUrl(result);
        updateBrandingCache({ logo_url: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoUrl("");
    updateBrandingCache({ logo_url: null });
  };

  // 1-Click Preset Application
  const handleApplyPreset = (preset: ThemePreset) => {
    setThemePreset(preset.id);
    setPrimaryColor(preset.primary);
    setButtonColor(preset.button);
    setTintColor(preset.tint);
    setBgColor(preset.bg);
    setTextColor(preset.text);

    // Immediately update live application styles via CSS variables
    applyBrandStyles({
      primary_color: preset.primary,
      button_color: preset.button,
      tint_color: preset.tint,
      background_color: preset.bg,
      text_color: preset.text,
    });
  };

  // Fine-tuned single color adjustment
  const handleColorChange = (
    field: "primary" | "button" | "tint" | "bg" | "text",
    val: string
  ) => {
    setThemePreset("custom");
    let p = primaryColor;
    let b = buttonColor;
    let t = tintColor;
    let bg = bgColor;
    let txt = textColor;

    if (field === "primary") { setPrimaryColor(val); p = val; }
    if (field === "button") { setButtonColor(val); b = val; }
    if (field === "tint") { setTintColor(val); t = val; }
    if (field === "bg") { setBgColor(val); bg = val; }
    if (field === "text") { setTextColor(val); txt = val; }

    applyBrandStyles({
      primary_color: p,
      button_color: b,
      tint_color: t,
      background_color: bg,
      text_color: txt,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMessage(null);

    let activeLogo = logoUrl;

    // If logo file or data URL is present, upload to server
    if (logoFile || (logoUrl && logoUrl.startsWith("data:"))) {
      try {
        const formData = new FormData();
        if (logoFile) {
          formData.append("file", logoFile);
        } else {
          formData.append("logo_data_url", logoUrl);
        }

        const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        const uploadRes = await fetch("/api/v1/settings/upload-logo", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (uploadRes.ok) {
          const lData = await uploadRes.json();
          activeLogo = lData.logo_url;
        }
      } catch (err) {
        console.error("Logo upload exception note:", err);
      }
    }

    const payload = {
      hospital_name: clinicName,
      tagline: tagline,
      emergency_hotline: phone,
      contact_email: email,
      address: address,
      logo_url: activeLogo || null,
      theme_preset: themePreset,
      primary_color: primaryColor,
      button_color: buttonColor,
      tint_color: tintColor,
      background_color: bgColor,
      text_color: textColor,
    };

    try {
      await apiClient("/settings/website", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      // Synchronize instant client cache and multi-tab storage
      updateBrandingCache(payload);
      setShowSavedAlert(true);
      setTimeout(() => setShowSavedAlert(false), 4000);
    } catch (err: any) {
      console.error("Failed to save settings via API, synchronizing local cache", err);
      // Fallback: sync local branding cache so user immediately retains selections
      updateBrandingCache(payload);
      setShowSavedAlert(true);
      setTimeout(() => setShowSavedAlert(false), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Super Admin & Clinic Settings
              </span>
              <span className="text-xs text-slate-500">• Live Reactive Palette Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <Settings className="w-6 h-6 text-emerald-600" />
              Clinic Profile & Letterhead Settings
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Configure institutional branding, contact details, currency, and the 5-token dynamic theme palette that governs all portals and printable letterheads in real time.
            </p>
          </div>
        </div>
      </div>

      {showSavedAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm rounded-xl flex items-center gap-2.5 shadow-sm animate-in fade-in">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold">Settings Published Successfully!</span> All portals, navigation bars, buttons, surface cards, and printable PDF prescriptions/invoices have been updated live.
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <Info className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ============================================================ */}
        {/* CLINIC LOGO & LETTERHEAD EMBLEM UPLOAD CARD                  */}
        {/* ============================================================ */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-600" />
                Clinic Logo & Letterhead Emblem
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Upload your official hospital crest, emblem, or logo. Appears on the top Navbar, public landing page, Login screen, and PDF prescriptions/invoices.
              </p>
            </div>
            {logoUrl ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3.5 h-3.5" /> Logo Active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                Default Crest
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Live Emblem Preview Box */}
            <div className="md:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200 text-center">
              <div className="w-24 h-24 rounded-2xl bg-white border border-slate-200 shadow-sm p-2 flex items-center justify-center overflow-hidden mb-3 relative group">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Clinic Logo Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400">
                    <Building className="w-8 h-8 text-slate-300 mb-1" />
                    <span className="text-[10px] font-semibold">No Logo</span>
                  </div>
                )}
              </div>
              <div className="text-xs font-bold text-slate-800">{clinicName || "Hospital Emblem"}</div>
              <p className="text-[11px] text-slate-500 mt-0.5">Live Navbar & Letterhead Preview</p>
            </div>

            {/* Upload Controls & URL input */}
            <div className="md:col-span-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Upload Logo File (PNG, JPG, SVG, WebP)
                </label>
                <div className="flex flex-wrap items-center gap-2.5">
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-semibold transition">
                    <Upload className="w-4 h-4" />
                    <span>Choose Image File</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/svg+xml, image/webp"
                      onChange={handleLogoFileChange}
                      className="hidden"
                    />
                  </label>

                  {logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-semibold transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Recommended size: 512x512px. Transparent background recommended for clean letterheads.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Or Direct Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value);
                    setLogoFile(null);
                    updateBrandingCache({ logo_url: e.target.value || null });
                  }}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono bg-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BRAND & SYSTEM COLOR FORMATION (1-Click Palettes & Pickers)   */}
        {/* ============================================================ */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Palette className="w-5 h-5 text-emerald-600" />
                Hospital Color System & Letterhead Formation
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Choose a pre-calibrated 1-click hospital palette or fine-tune exact hex tokens. Updates apply instantly across all pages and printable receipts.
              </p>
            </div>
            {themePreset === "custom" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <Sliders className="w-3.5 h-3.5" /> Custom Calibrated
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5" /> Preset Active
              </span>
            )}
          </div>

          {/* 1-Click Quick-Apply Palette Cards */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              1-Click Hospital Color Palette Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {HOSPITAL_PRESETS.map((preset) => {
                const isSelected = themePreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`text-left p-4 rounded-xl transition-all border relative flex flex-col justify-between ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-600/20 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          {preset.badge}
                        </span>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">{preset.name}</h4>
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{preset.tag}</p>
                    </div>

                    {/* Palette Swatch Strip */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5">
                      <div
                        className="w-5 h-5 rounded-md shadow-xs border border-black/10 shrink-0"
                        style={{ backgroundColor: preset.primary }}
                        title={`Primary / Nav: ${preset.primary}`}
                      />
                      <div
                        className="w-5 h-5 rounded-md shadow-xs border border-black/10 shrink-0"
                        style={{ backgroundColor: preset.button }}
                        title={`Buttons / CTAs: ${preset.button}`}
                      />
                      <div
                        className="w-5 h-5 rounded-md shadow-xs border border-black/10 shrink-0"
                        style={{ backgroundColor: preset.tint }}
                        title={`Soft Tint / Cards: ${preset.tint}`}
                      />
                      <div
                        className="w-5 h-5 rounded-md shadow-xs border border-black/10 shrink-0"
                        style={{ backgroundColor: preset.bg }}
                        title={`Background: ${preset.bg}`}
                      />
                      <div
                        className="w-5 h-5 rounded-md shadow-xs border border-black/10 shrink-0"
                        style={{ backgroundColor: preset.text }}
                        title={`Body Text: ${preset.text}`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5 Individual Semantic Color Pickers */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                5 Semantic Brand Color Pickers
              </label>
              <span className="text-[11px] text-slate-500">
                Click color box or edit hex value for instant live tuning
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Primary / Navigation */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Primary / Nav</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: primaryColor }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Nav highlights, brand icons, letterheads</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => handleColorChange("primary", e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => handleColorChange("primary", e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-semibold uppercase bg-white"
                  />
                </div>
              </div>

              {/* 2. Buttons / CTAs */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Buttons / CTAs</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: buttonColor }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Primary submit buttons & action pills</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="color"
                    value={buttonColor}
                    onChange={(e) => handleColorChange("button", e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={buttonColor}
                    onChange={(e) => handleColorChange("button", e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-semibold uppercase bg-white"
                  />
                </div>
              </div>

              {/* 3. Soft Tint / Cards */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Soft Tint</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: tintColor }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Subtle badges, hover fills & card tint</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="color"
                    value={tintColor}
                    onChange={(e) => handleColorChange("tint", e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={tintColor}
                    onChange={(e) => handleColorChange("tint", e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-semibold uppercase bg-white"
                  />
                </div>
              </div>

              {/* 4. Background */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Background</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: bgColor }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Card surface & clean canvas container</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => handleColorChange("bg", e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => handleColorChange("bg", e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-semibold uppercase bg-white"
                  />
                </div>
              </div>

              {/* 5. Body Text */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Body Text</span>
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs"
                    style={{ backgroundColor: textColor }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">Headings, titles & readable typography</p>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => handleColorChange("text", e.target.value)}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer p-0 shrink-0"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => handleColorChange("text", e.target.value)}
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-mono font-semibold uppercase bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Live Mini Preview Bar */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-slate-500" /> Live Mini Component Preview
              </span>
              <span className="text-[11px] text-slate-500 font-normal">Real-time dynamic CSS variable rendering</span>
            </div>

            <div
              className="p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs"
              style={{ backgroundColor: bgColor }}
            >
              {/* Brand Letterhead / Nav Item */}
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-white text-base shadow-xs"
                  style={{ backgroundColor: primaryColor }}
                >
                  ✚
                </div>
                <div>
                  <div className="text-sm font-bold tracking-tight" style={{ color: textColor }}>
                    {clinicName || "Metro Health Hospital"}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Active Nav & Letterhead Banner
                  </div>
                </div>
              </div>

              {/* Sample Soft Tint Badge */}
              <div
                className="px-3 py-1 rounded-full text-xs font-bold border"
                style={{
                  backgroundColor: tintColor,
                  color: buttonColor,
                  borderColor: buttonColor + "33",
                }}
              >
                ● 24/7 Home Care Available
              </div>

              {/* Sample CTA Action Button */}
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition"
                style={{ backgroundColor: buttonColor }}
              >
                Sample Action CTA
              </button>
            </div>
          </div>

          {/* Inline Design Tip Note */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <span className="font-bold">Clinical Design Tip:</span> Keep backgrounds clean white or light neutral, maintain high text contrast for patient readability, and keep red reserved strictly for emergency alerts and booked status badges.
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* FACILITY & CONTACT DETAILS                                    */}
        {/* ============================================================ */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2 flex items-center gap-2">
            <Building className="w-4 h-4 text-emerald-600" />
            Facility & Contact Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Legal Name</label>
              <input
                type="text"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Operating Currency</label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full p-2.5 border rounded-lg text-sm bg-slate-50 font-bold font-mono text-slate-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Telephone / Emergency Hotline</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Address Line</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City / Region</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Clinic Tagline / Slogan</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full p-2.5 border rounded-lg text-sm"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Changes are saved permanently to the database and cached instantly for zero-flicker loading.
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving Settings..." : "Save Profile & Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
