"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Stethoscope,
  Sparkles,
  User as UserIcon,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface RoleOption {
  label: string;
  email: string;
  pass: string;
}

const DEMO_ROLES: RoleOption[] = [
  { label: "Admin", email: "admin@metrohealth.com", pass: "AdminPass123!" },
  { label: "Doctor", email: "dr.smith@metrohealth.com", pass: "DoctorPass123!" },
  { label: "Nurse", email: "farzana.nurse@metrohealth.com", pass: "NursePass123!" },
  { label: "Lab Assistant", email: "lab@metrohealth.com", pass: "LabPass123!" },
  { label: "Patient", email: "testpatient@example.com", pass: "Patient123!" },
  { label: "Reception", email: "reception@metrohealth.com", pass: "Reception123!" },
];

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PHONE_REGEX = /^01[0-9]{9}$/;

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { settings } = useBranding();

  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const redirectUrl = searchParams.get("redirect");
  const [activeTab, setActiveTab] = useState<"login" | "register">(initialTab);

  // Login form state
  const [selectedRole, setSelectedRole] = useState<string | null>("Admin");
  const [loginEmail, setLoginEmail] = useState("admin@metrohealth.com");
  const [loginPassword, setLoginPassword] = useState("AdminPass123!");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Login validation state
  const [loginErrors, setLoginErrors] = useState<{ email?: string; password?: string }>({});
  const [loginTouched, setLoginTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Register form state
  const [regFullName, setRegFullName] = useState("");
  const [regPhone, setRegPhone] = useState("01");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regAge, setRegAge] = useState<string>("28");
  const [regGender, setRegGender] = useState("MALE");
  const [regBloodGroup, setRegBloodGroup] = useState("O+");
  const [regAddress, setRegAddress] = useState("Dhaka, Bangladesh");
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Register validation state
  const [regErrors, setRegErrors] = useState<{
    fullName?: string;
    phone?: string;
    email?: string;
    password?: string;
    age?: string;
    gender?: string;
    bloodGroup?: string;
  }>({});
  const [regTouched, setRegTouched] = useState<{
    fullName?: boolean;
    phone?: boolean;
    email?: boolean;
    password?: boolean;
    age?: boolean;
    gender?: boolean;
    bloodGroup?: boolean;
  }>({});

  useEffect(() => {
    if (searchParams.get("tab") === "register") {
      setActiveTab("register");
    }
  }, [searchParams]);

  // Live password criteria for registration
  const regPwCriteria = {
    length: regPassword.length >= 6 && regPassword.length <= 32,
    letter: /[A-Za-z]/.test(regPassword),
    number: /\d/.test(regPassword),
    special: /[^A-Za-z0-9]/.test(regPassword),
  };
  const isRegPasswordValid =
    regPwCriteria.length && regPwCriteria.letter && regPwCriteria.number && regPwCriteria.special;

  // Validation functions
  const validateLoginField = (field: "email" | "password", value: string): string | undefined => {
    if (field === "email") {
      if (!value.trim()) return "Email address is required";
      if (!EMAIL_REGEX.test(value.trim())) {
        return "Please enter a valid email address (e.g., name@example.com)";
      }
    }
    if (field === "password") {
      if (!value) return "Password is required";
    }
    return undefined;
  };

  const validateRegField = (field: string, value: any): string | undefined => {
    switch (field) {
      case "fullName": {
        const v = typeof value === "string" ? value.trim() : "";
        if (!v) return "Full name is required";
        if (v.length < 2) return "Full name is required";
        return undefined;
      }
      case "phone": {
        const v = typeof value === "string" ? value.trim() : "";
        if (!v) return "Phone number is required";
        if (!PHONE_REGEX.test(v)) {
          return "Phone number must start with 01 and be exactly 11 digits (e.g., 01712345678)";
        }
        return undefined;
      }
      case "email": {
        const v = typeof value === "string" ? value.trim() : "";
        if (!v) return "Email address is required";
        if (!EMAIL_REGEX.test(v)) {
          return "Please enter a valid email address (e.g., name@example.com)";
        }
        return undefined;
      }
      case "password": {
        const v = typeof value === "string" ? value : "";
        if (!v) return "Password is required";
        const hasLength = v.length >= 6 && v.length <= 32;
        const hasLetter = /[A-Za-z]/.test(v);
        const hasNumber = /\d/.test(v);
        const hasSpecial = /[^A-Za-z0-9]/.test(v);
        if (!hasLength || !hasLetter || !hasNumber || !hasSpecial) {
          return "Password must be 6–32 characters and include at least 1 letter, 1 number, and 1 special character";
        }
        return undefined;
      }
      case "age": {
        const n = Number(value);
        if (value === "" || isNaN(n) || n < 1 || n > 120) {
          return "Please enter a valid age (1–120)";
        }
        return undefined;
      }
      case "gender": {
        if (!value) return "Gender is required";
        return undefined;
      }
      case "bloodGroup": {
        if (!value) return "Blood group is required";
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role.label);
    setLoginEmail(role.email);
    setLoginPassword(role.pass);
    setLoginError(null);
    setLoginErrors({});
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const emailErr = validateLoginField("email", loginEmail);
    const passErr = validateLoginField("password", loginPassword);

    setLoginTouched({ email: true, password: true });
    setLoginErrors({ email: emailErr, password: passErr });

    if (emailErr || passErr) {
      return;
    }

    setIsLoginLoading(true);

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
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
      } else if (
        data.user.system_role === "NURSE" ||
        data.user.clinic_memberships?.[0]?.role === "NURSE"
      ) {
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
    setRegisterError(null);

    // Validate all fields
    const fullNameErr = validateRegField("fullName", regFullName);
    const phoneErr = validateRegField("phone", regPhone);
    const emailErr = validateRegField("email", regEmail);
    const passwordErr = validateRegField("password", regPassword);
    const ageErr = validateRegField("age", regAge);
    const genderErr = validateRegField("gender", regGender);
    const bloodGroupErr = validateRegField("bloodGroup", regBloodGroup);

    setRegTouched({
      fullName: true,
      phone: true,
      email: true,
      password: true,
      age: true,
      gender: true,
      bloodGroup: true,
    });

    setRegErrors({
      fullName: fullNameErr,
      phone: phoneErr,
      email: emailErr,
      password: passwordErr,
      age: ageErr,
      gender: genderErr,
      bloodGroup: bloodGroupErr,
    });

    if (
      fullNameErr ||
      phoneErr ||
      emailErr ||
      passwordErr ||
      ageErr ||
      genderErr ||
      bloodGroupErr
    ) {
      return;
    }

    setIsRegisterLoading(true);

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
          full_name: regFullName.trim(),
          email: regEmail.trim(),
          phone: regPhone.trim(),
          password: regPassword,
          age: Number(regAge),
          gender: regGender,
          blood_group: regBloodGroup,
          address: regAddress.trim(),
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

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Centered Split-Card Container */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden grid grid-cols-1 md:grid-cols-2 max-h-[94vh]">
        {/* LEFT VISUAL PANEL */}
        <div className="hidden md:block relative min-h-[540px] h-full">
          <img
            src="/images/medical-team.jpg"
            alt="Medical Team"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/25 to-transparent" />

          {/* Clean Typography */}
          <div className="absolute bottom-8 left-8 right-8 text-white z-10">
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome Back</h2>
            <p className="text-sm text-slate-200 mt-1">Sign in to continue to your account</p>
          </div>
        </div>

        {/* RIGHT FORM PANEL */}
        <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-white relative overflow-y-auto">
          {/* Back to Home link */}
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Dynamic Hospital Branding */}
          <div className="flex items-center gap-3 mb-5">
            {settings?.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings?.hospital_name || "Logo"}
                className="w-10 h-10 rounded-xl object-contain border border-slate-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
                {settings?.hospital_name || "Mir Health"}
              </h1>
              <p className="text-xs text-slate-600 truncate">
                {settings?.tagline || "Advanced Care & Hospital Management"}
              </p>
            </div>
          </div>

          {/* Redirect Notice if coming from appointment booking */}
          {redirectUrl && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-2.5 text-xs">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Booking an Appointment?</span> Please sign in or create a
                patient profile to proceed.
              </div>
            </div>
          )}

          {/* VIEW 1: SIGN IN */}
          {activeTab === "login" && (
            <div className="space-y-4">
              {/* 1-Click Role Selector Pills */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Quick Role Selector
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold">1-Click Auto Fill</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEMO_ROLES.map((role) => {
                    const isSelected = selectedRole === role.label;
                    return (
                      <button
                        key={role.label}
                        type="button"
                        onClick={() => handleRoleSelect(role)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${isSelected
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                          : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                      >
                        {role.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} noValidate className="space-y-3.5">
                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLoginEmail(val);
                        setSelectedRole(null);
                        if (loginTouched.email) {
                          setLoginErrors((prev) => ({
                            ...prev,
                            email: validateLoginField("email", val),
                          }));
                        }
                      }}
                      onBlur={() => {
                        setLoginTouched((prev) => ({ ...prev, email: true }));
                        setLoginErrors((prev) => ({
                          ...prev,
                          email: validateLoginField("email", loginEmail),
                        }));
                      }}
                      placeholder="name@hospital.com"
                      className={`w-full pl-10 pr-4 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition ${loginTouched.email && loginErrors.email
                        ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                        : "border-slate-200 focus:ring-emerald-500"
                        }`}
                    />
                  </div>
                  {loginTouched.email && loginErrors.email && (
                    <p className="text-xs font-medium text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{loginErrors.email}</span>
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLoginPassword(val);
                        setSelectedRole(null);
                        if (loginTouched.password) {
                          setLoginErrors((prev) => ({
                            ...prev,
                            password: validateLoginField("password", val),
                          }));
                        }
                      }}
                      onBlur={() => {
                        setLoginTouched((prev) => ({ ...prev, password: true }));
                        setLoginErrors((prev) => ({
                          ...prev,
                          password: validateLoginField("password", loginPassword),
                        }));
                      }}
                      placeholder="••••••••"
                      className={`w-full pl-10 pr-10 py-2 bg-slate-50 border rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition ${loginTouched.password && loginErrors.password
                        ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                        : "border-slate-200 focus:ring-emerald-500"
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition"
                      tabIndex={-1}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {loginTouched.password && loginErrors.password && (
                    <p className="text-xs font-medium text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{loginErrors.password}</span>
                    </p>
                  )}
                </div>

                {/* Remember Me & Forgot Password */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <label className="flex items-center gap-1.5 text-slate-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      alert("Please contact the hospital administrator or front desk to reset your password.");
                    }}
                    className="text-slate-600 hover:text-emerald-700 transition font-medium"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoginLoading}
                  className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium rounded-lg text-sm shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isLoginLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              {/* Bottom Toggle to Register */}
              <div className="text-center pt-3 border-t border-slate-100 text-xs text-slate-600">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("register");
                    setRegisterError(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2 ml-1"
                >
                  Sign Up
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: CREATE PATIENT ACCOUNT */}
          {activeTab === "register" && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Create Patient Account</h2>
                <p className="text-xs text-slate-600">
                  Register to book slots, consult doctors, and manage care.
                </p>
              </div>

              {registerError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{registerError}</span>
                </div>
              )}

              <form onSubmit={handleRegisterSubmit} noValidate className="space-y-2.5">
                {/* Full Name */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRegFullName(val);
                        if (regTouched.fullName) {
                          setRegErrors((prev) => ({
                            ...prev,
                            fullName: validateRegField("fullName", val),
                          }));
                        }
                      }}
                      onBlur={() => {
                        setRegTouched((prev) => ({ ...prev, fullName: true }));
                        setRegErrors((prev) => ({
                          ...prev,
                          fullName: validateRegField("fullName", regFullName),
                        }));
                      }}
                      placeholder="e.g. Tanvir Ahmed"
                      className={`w-full pl-9 pr-3 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition ${regTouched.fullName && regErrors.fullName
                        ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                        : "border-slate-200 focus:ring-emerald-500"
                        }`}
                    />
                  </div>
                  {regTouched.fullName && regErrors.fullName && (
                    <p className="text-xs font-medium text-rose-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{regErrors.fullName}</span>
                    </p>
                  )}
                </div>

                {/* Phone & Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Phone */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="tel"
                        maxLength={11}
                        value={regPhone}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 11);
                          setRegPhone(digitsOnly);
                          if (regTouched.phone) {
                            setRegErrors((prev) => ({
                              ...prev,
                              phone: validateRegField("phone", digitsOnly),
                            }));
                          }
                        }}
                        onBlur={() => {
                          setRegTouched((prev) => ({ ...prev, phone: true }));
                          setRegErrors((prev) => ({
                            ...prev,
                            phone: validateRegField("phone", regPhone),
                          }));
                        }}
                        placeholder="01712345678"
                        className={`w-full pl-9 pr-3 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white font-mono transition ${regTouched.phone && regErrors.phone
                          ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                          : "border-slate-200 focus:ring-emerald-500"
                          }`}
                      />
                    </div>
                    {regTouched.phone && regErrors.phone && (
                      <p className="text-xs font-medium text-rose-600 mt-1 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{regErrors.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegEmail(val);
                          if (regTouched.email) {
                            setRegErrors((prev) => ({
                              ...prev,
                              email: validateRegField("email", val),
                            }));
                          }
                        }}
                        onBlur={() => {
                          setRegTouched((prev) => ({ ...prev, email: true }));
                          setRegErrors((prev) => ({
                            ...prev,
                            email: validateRegField("email", regEmail),
                          }));
                        }}
                        placeholder="patient@gmail.com"
                        className={`w-full pl-9 pr-3 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition ${regTouched.email && regErrors.email
                          ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                          : "border-slate-200 focus:ring-emerald-500"
                          }`}
                      />
                    </div>
                    {regTouched.email && regErrors.email && (
                      <p className="text-xs font-medium text-rose-600 mt-1 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{regErrors.email}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Password & Age */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Password */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showRegPassword ? "text" : "password"}
                        minLength={6}
                        maxLength={32}
                        value={regPassword}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegPassword(val);
                          if (regTouched.password) {
                            setRegErrors((prev) => ({
                              ...prev,
                              password: validateRegField("password", val),
                            }));
                          }
                        }}
                        onBlur={() => {
                          setRegTouched((prev) => ({ ...prev, password: true }));
                          setRegErrors((prev) => ({
                            ...prev,
                            password: validateRegField("password", regPassword),
                          }));
                        }}
                        placeholder="6–32 chars (A-z, 0-9, @#$)"
                        className={`w-full pl-9 pr-9 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:bg-white transition ${regTouched.password && regErrors.password
                          ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                          : "border-slate-200 focus:ring-emerald-500"
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 transition"
                        tabIndex={-1}
                      >
                        {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {regTouched.password && regErrors.password && (
                      <p className="text-xs font-medium text-rose-600 mt-1 flex items-start gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{regErrors.password}</span>
                      </p>
                    )}
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Age (Years) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={regAge}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRegAge(val);
                          if (regTouched.age) {
                            setRegErrors((prev) => ({
                              ...prev,
                              age: validateRegField("age", val),
                            }));
                          }
                        }}
                        onBlur={() => {
                          setRegTouched((prev) => ({ ...prev, age: true }));
                          setRegErrors((prev) => ({
                            ...prev,
                            age: validateRegField("age", regAge),
                          }));
                        }}
                        placeholder="e.g. 28"
                        className={`w-full pl-9 pr-3 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition font-mono ${regTouched.age && regErrors.age
                          ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                          : "border-slate-200 focus:ring-emerald-500"
                          }`}
                      />
                    </div>
                    {regTouched.age && regErrors.age && (
                      <p className="text-xs font-medium text-rose-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>{regErrors.age}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Password Criteria Checklist */}
                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-2 gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    {regPwCriteria.length ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400 shrink-0">
                        •
                      </span>
                    )}
                    <span
                      className={regPwCriteria.length ? "text-emerald-700 font-medium" : "text-slate-500"}
                    >
                      6–32 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {regPwCriteria.letter ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400 shrink-0">
                        •
                      </span>
                    )}
                    <span
                      className={regPwCriteria.letter ? "text-emerald-700 font-medium" : "text-slate-500"}
                    >
                      At least 1 letter
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {regPwCriteria.number ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400 shrink-0">
                        •
                      </span>
                    )}
                    <span
                      className={regPwCriteria.number ? "text-emerald-700 font-medium" : "text-slate-500"}
                    >
                      At least 1 number
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {regPwCriteria.special ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400 shrink-0">
                        •
                      </span>
                    )}
                    <span
                      className={regPwCriteria.special ? "text-emerald-700 font-medium" : "text-slate-500"}
                    >
                      1 special char (@#$%)
                    </span>
                  </div>
                </div>

                {/* Gender & Blood Group */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Gender <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={regGender}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRegGender(val);
                        if (regTouched.gender) {
                          setRegErrors((prev) => ({
                            ...prev,
                            gender: validateRegField("gender", val),
                          }));
                        }
                      }}
                      onBlur={() => {
                        setRegTouched((prev) => ({ ...prev, gender: true }));
                        setRegErrors((prev) => ({
                          ...prev,
                          gender: validateRegField("gender", regGender),
                        }));
                      }}
                      className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition ${regTouched.gender && regErrors.gender
                        ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                        : "border-slate-200 focus:ring-emerald-500"
                        }`}
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                    {regTouched.gender && regErrors.gender && (
                      <p className="text-xs font-medium text-rose-600 mt-1">{regErrors.gender}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Blood Group <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={regBloodGroup}
                      onChange={(e) => {
                        const val = e.target.value;
                        setRegBloodGroup(val);
                        if (regTouched.bloodGroup) {
                          setRegErrors((prev) => ({
                            ...prev,
                            bloodGroup: validateRegField("bloodGroup", val),
                          }));
                        }
                      }}
                      onBlur={() => {
                        setRegTouched((prev) => ({ ...prev, bloodGroup: true }));
                        setRegErrors((prev) => ({
                          ...prev,
                          bloodGroup: validateRegField("bloodGroup", regBloodGroup),
                        }));
                      }}
                      className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:bg-white transition ${regTouched.bloodGroup && regErrors.bloodGroup
                        ? "border-rose-500 focus:border-rose-600 focus:ring-rose-500/20"
                        : "border-slate-200 focus:ring-emerald-500"
                        }`}
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
                    {regTouched.bloodGroup && regErrors.bloodGroup && (
                      <p className="text-xs font-medium text-rose-600 mt-1">{regErrors.bloodGroup}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Present Address (City / Area)
                  </label>
                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="e.g. Mirpur, Dhaka"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full mt-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium rounded-lg text-xs shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isRegisterLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Complete Registration</span>
                  )}
                </button>
              </form>

              {/* Bottom Toggle to Sign In */}
              <div className="text-center pt-2.5 border-t border-slate-100 text-xs text-slate-600">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("login");
                    setLoginError(null);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2 ml-1"
                >
                  Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm">
          Loading Portal...
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
