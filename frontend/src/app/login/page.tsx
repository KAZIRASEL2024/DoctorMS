"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { BackButton } from "@/components/ui/back-button";
import {
  Stethoscope,
  Lock,
  Mail,
  User as UserIcon,
  Phone,
  Calendar,
  Heart,
  Droplet,
  ArrowRight,
  ShieldCheck,
  Building,
  CheckCircle2,
  Sparkles,
  Award,
  Clock,
  Activity,
  PhoneCall,
} from "lucide-react";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { settings, isLoading } = useBranding();

  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const redirectUrl = searchParams.get("redirect");
  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("admin@metrohealth.com");
  const [loginPassword, setLoginPassword] = useState("AdminPass123!");
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("017");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regAge, setRegAge] = useState(28);
  const [regGender, setRegGender] = useState("MALE");
  const [regBloodGroup, setRegBloodGroup] = useState("O+");
  const [regAddress, setRegAddress] = useState("Dhaka, Bangladesh");
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError(null);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(data.detail || "Authentication failed");
      }

      const data = await response.json();
      login(data.access_token, data.refresh_token, data.user, data.active_clinic_id);

      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (data.user.system_role === "PATIENT") {
        router.push("/patient/dashboard");
      } else if (data.user.system_role === "SUPER_ADMIN") {
        router.push("/dashboard/admin");
      } else if (data.user.system_role === "NURSE" || data.user.clinic_memberships?.[0]?.role === "NURSE") {
        router.push("/dashboard/nurse");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setLoginError(err.message || "Failed to connect to backend server");
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegisterLoading(true);
    setRegisterError(null);

    try {
      const parts = regFullName.trim().split(" ");
      const firstName = parts[0] || "Patient";
      const lastName = parts.slice(1).join(" ") || "User";

      const response = await fetch("/api/v1/auth/patient-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: regEmail,
          phone: regPhone,
          password: regPassword,
          age: Number(regAge),
          gender: regGender,
          blood_group: regBloodGroup,
          address: regAddress,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ detail: "Registration failed" }));
        throw new Error(data.detail || "Failed to create patient account");
      }

      const data = await response.json();
      login(data.access_token, data.refresh_token, data.user, data.active_clinic_id);
      if (redirectUrl) {
        router.push(redirectUrl);
      } else {
        router.push("/patient/dashboard");
      }
    } catch (err: any) {
      setRegisterError(err.message || "Registration failed");
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const setDemoCredentials = (role: "SUPER_ADMIN" | "DOCTOR" | "PATIENT" | "NURSE") => {
    setActiveTab("login");
    if (role === "SUPER_ADMIN") {
      setLoginEmail("admin@metrohealth.com");
      setLoginPassword("AdminPass123!");
    } else if (role === "DOCTOR") {
      setLoginEmail("dr.smith@metrohealth.com");
      setLoginPassword("DoctorPass123!");
    } else if (role === "NURSE") {
      setLoginEmail("farzana.nurse@metrohealth.com");
      setLoginPassword("NursePass123!");
    } else if (role === "PATIENT") {
      setLoginEmail("testpatient@example.com");
      setLoginPassword("Patient123!");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 grid grid-cols-1 lg:grid-cols-2">
      {/* LEFT SIDE: Auth Card & Forms */}
      <div className="w-full flex flex-col justify-between p-6 sm:p-10 lg:p-12 xl:p-16 bg-white z-10 overflow-y-auto min-h-screen">
        <div>
          {/* Top Back Navigation */}
          <div className="mb-6 flex items-center justify-between">
            <BackButton fallbackHref="/" label="Back to Home" />
          </div>

          {/* Brand Header */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="flex items-center gap-3 group min-w-0">
              {settings?.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings?.hospital_name || "Logo"}
                  className="w-10 h-10 rounded-xl object-contain border border-slate-200 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                  <Stethoscope className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-none truncate max-w-[200px] sm:max-w-[320px]">
                  {settings?.hospital_name || "Mir Health"}
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-1 truncate max-w-[200px] sm:max-w-[320px]">
                  {settings?.tagline || "Advanced Care & E-Health Management"}
                </p>
              </div>
            </Link>

            {settings?.emergency_hotline && (
              <a
                href={`tel:${settings.emergency_hotline}`}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition shrink-0"
              >
                <PhoneCall className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
                <span>{settings.emergency_hotline}</span>
              </a>
            )}
          </div>

          {/* Redirect Notice if booking an appointment */}
          {redirectUrl && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3 shadow-xs animate-fadeIn">
              <Sparkles className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Booking an Appointment?</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Please sign in or create a free patient account to complete your appointment reservation.
                </p>
              </div>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setLoginError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setRegisterError(null);
              }}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                activeTab === "register"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Create Patient Account
            </button>
          </div>

          {/* TAB 1: SIGN IN FORM */}
          {activeTab === "login" && (
            <div className="space-y-6 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Sign in with your email and password to access your portal.
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-2 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="name@hospital.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isLoginLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In to Portal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* 1-Click Demo Logins */}
              <div className="pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Quick 1-Click Demo Profiles:
                  </span>
                  <span className="text-[11px] text-emerald-600 font-medium">Instant Test</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setDemoCredentials("SUPER_ADMIN")}
                    className="py-2 px-2 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition text-center"
                  >
                    👑 Super Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCredentials("DOCTOR")}
                    className="py-2 px-2 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition text-center"
                  >
                    🩺 Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCredentials("NURSE")}
                    className="py-2 px-2 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition text-center"
                  >
                    ❤️ Nurse
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCredentials("PATIENT")}
                    className="py-2 px-2 text-xs font-semibold rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 transition text-center"
                  >
                    👤 Patient
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CREATE PATIENT ACCOUNT */}
          {activeTab === "register" && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  New Patient Registration
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Create your personal medical portal profile to book slots and download e-prescriptions.
                </p>
              </div>

              {registerError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-2 shrink-0" />
                  <span>{registerError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="e.g. Tanvir Ahmed"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                  </div>
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Phone Number (01...) *
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        required
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="01712345678"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="patient@gmail.com"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Password & Age */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Password *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Age (Years) *
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="number"
                        min="1"
                        max="120"
                        required
                        value={regAge}
                        onChange={(e) => setRegAge(Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Gender & Blood Group */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Gender *
                    </label>
                    <select
                      value={regGender}
                      onChange={(e) => setRegGender(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Blood Group *
                    </label>
                    <select
                      value={regBloodGroup}
                      onChange={(e) => setRegBloodGroup(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Present Address (City / Area)
                  </label>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="e.g. Mirpur, Dhaka"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isRegisterLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Complete Registration & Enter</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-6 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <span>© 2026 {settings?.hospital_name || "Mir Health"}. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              HIPAA & GDPR Ready
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Rich Healthcare Hero Panel */}
      <div className="hidden lg:flex w-full relative bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-12 xl:p-16 flex-col justify-between overflow-hidden min-h-screen">
        {/* Ambient background glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Badges */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Next-Generation Healthcare Cloud</span>
          </div>

          <div className="flex items-center gap-2 text-white/70 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>System Status: Optimal</span>
          </div>
        </div>

        {/* Doctor Hero Image & Floating Glassmorphism Cards */}
        <div className="relative z-10 my-auto py-8 flex flex-col items-center">
          {/* Main Visual Frame */}
          <div className="relative max-w-md w-full">
            <div className="relative aspect-[4/4.5] rounded-3xl overflow-hidden shadow-2xl border border-white/20">
              {/* Doctor portrait image */}
              <img
                src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop"
                alt="Doctor Specialist"
                className="w-full h-full object-cover object-top"
                onError={(e) => {
                  // Fallback image
                  (e.target as HTMLImageElement).src =
                    "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=1000&auto=format&fit=crop";
                }}
              />
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="inline-block px-2.5 py-1 rounded-md bg-emerald-500/80 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider mb-1.5">
                  Verified Senior Consultant
                </span>
                <h3 className="text-xl font-bold">Dr. John Smith, MD, FACC</h3>
                <p className="text-xs text-slate-300">Head of Clinical Cardiology & Diagnostics</p>
              </div>
            </div>

            {/* Floating Glassmorphism Card 1: Emergency ICU & CCU */}
            <div className="absolute -top-4 -left-6 bg-slate-900/80 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-xl text-white max-w-[210px] animate-bounce-slow">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <Activity className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">24/7 Emergency</div>
                  <div className="text-[11px] text-slate-400">ICU, CCU & Trauma Care</div>
                </div>
              </div>
            </div>

            {/* Floating Glassmorphism Card 2: Instant Digital Prescription */}
            <div className="absolute -bottom-6 -right-6 bg-slate-900/85 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-xl text-white max-w-[240px]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight">Instant Digital Rx</div>
                  <div className="text-[11px] text-slate-400">QR-Verified Prescription PDF</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Highlights */}
        <div className="relative z-10 grid grid-cols-3 gap-4 pt-4 border-t border-white/10 text-white">
          <div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">99.8%</div>
            <div className="text-xs text-slate-400 font-medium">Diagnostic Accuracy</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">150k+</div>
            <div className="text-xs text-slate-400 font-medium">Consultations Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight">৳ 0</div>
            <div className="text-xs text-slate-400 font-medium">Hidden Booking Fees</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">Loading Portal...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}
