"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";
import {
  UserCog,
  ShieldCheck,
  Camera,
  Upload,
  Lock,
  Phone,
  Mail,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  Activity,
  Save,
  KeyRound,
  Shield,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

interface ActivityLog {
  id: string;
  timestamp: string;
  action: string;
  resource_type: string;
  details: string;
  ip_address?: string;
}

export default function AdminProfilePage() {
  const { user, token, updateUser } = useAuth();

  // Profile form state
  const [firstName, setFirstName] = useState(user?.first_name || "Sarah");
  const [lastName, setLastName] = useState(user?.last_name || "Connor");
  const [phone, setPhone] = useState(user?.phone || "+880 1711-223344");
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Status / Feedback state
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Recent Activity Log
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);

  useEffect(() => {
    if (user) {
      if (user.first_name) setFirstName(user.first_name);
      if (user.last_name) setLastName(user.last_name);
      if (user.phone) setPhone(user.phone);
      if (user.avatar_url) setAvatarUrl(user.avatar_url);
    }
  }, [user]);

  // Fetch recent activity
  useEffect(() => {
    const fetchRecentActivity = async () => {
      try {
        const data = await apiClient<ActivityLog[]>("/admin/me/activity?limit=8");
        if (Array.isArray(data)) {
          setActivityLogs(data);
        }
      } catch (err) {
        console.error("Failed to load recent activity log", err);
      } finally {
        setIsLoadingActivity(false);
      }
    };

    fetchRecentActivity();
  }, []);

  // Handle avatar file selection
  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatarUrl(result);
        updateUser({ avatar_url: result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Profile Details
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccess(null);
    setProfileError(null);

    let activeAvatar = avatarUrl;

    // Upload avatar if a new file or data URI is selected
    if (avatarFile || (avatarUrl && avatarUrl.startsWith("data:"))) {
      try {
        const formData = new FormData();
        if (avatarFile) {
          formData.append("file", avatarFile);
        } else {
          formData.append("avatar_data_url", avatarUrl);
        }

        const uploadRes = await fetch("/api/v1/users/me/avatar", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (uploadRes.ok) {
          const upData = await uploadRes.json();
          activeAvatar = upData.avatar_url;
        }
      } catch (err) {
        console.error("Avatar upload note:", err);
      }
    }

    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim(),
        avatar_url: activeAvatar || null,
      };

      await apiClient("/users/me", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      // Update React AuthContext & LocalStorage immediately
      updateUser(payload);
      setProfileSuccess("Admin Profile details updated successfully.");
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || "Failed to update profile details.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Submit Password Change
  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters in length.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match. Please verify.");
      return;
    }

    setIsSavingPassword(true);

    try {
      await apiClient("/users/me", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setPasswordSuccess("Account password changed successfully! Your next login will require the new password.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(null), 5000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password. Please check your current password.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb & Page Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/dashboard/admin" />
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Super Admin Account
              </span>
              <span className="text-xs text-slate-500">• Identity & Security</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <UserCog className="w-6 h-6 text-emerald-600" />
              Admin Profile & Security
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Manage your administrator display name, profile avatar, official contact phone, and account authentication password.
            </p>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* ADMIN HERO IDENTITY CARD                                     */}
      {/* ============================================================ */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* DP Avatar with Camera Overlay */}
        <div className="relative group shrink-0">
          <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-emerald-600 shadow-md overflow-hidden flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Admin DP" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-emerald-700 text-white flex items-center justify-center font-bold text-3xl">
                {firstName ? firstName[0] : "A"}
              </div>
            )}
          </div>
          <label className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-md cursor-pointer transition transform hover:scale-105">
            <Camera className="w-4 h-4" />
            <input
              type="file"
              accept="image/png, image/jpeg, image/svg+xml, image/webp"
              onChange={handleAvatarFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Identity Details */}
        <div className="flex-1 text-center sm:text-left space-y-1.5">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              {firstName} {lastName}
            </h2>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              {user?.system_role || "SUPER_ADMIN"}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-600 pt-1">
            <span className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              {user?.email || "admin@metrohealth.com"}
            </span>
            <span className="flex items-center gap-1.5 tabular-nums">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {phone || "Not provided"}
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              Full Governance Access
            </span>
          </div>

          <p className="text-[11px] text-slate-500 pt-1">
            Click the camera icon to update your profile photo anytime. Updates immediately reflect in the top-right header and audit trails.
          </p>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2 PANELS: PERSONAL DETAILS & PASSWORD CHANGE                 */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Panel 1: Personal Profile Form */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-600" />
              Personal Profile Information
            </h3>

            {profileSuccess && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form id="profile-form" onSubmit={handleSaveProfile} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Mobile Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm tabular-nums bg-white"
                  placeholder="+880 1700-000000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Login Email Address</label>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  To change your login email address, use the Super Admin User Credentials module.
                </span>
              </div>
            </form>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              form="profile-form"
              disabled={isSavingProfile}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {isSavingProfile ? "Saving Profile..." : "Save Profile Details"}
            </button>
          </div>
        </div>

        {/* Panel 2: Account Password Change */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 border-b border-slate-100 pb-2.5 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              Change Account Password
            </h3>

            {passwordSuccess && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {passwordError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form id="password-form" onSubmit={handleSavePassword} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full p-2.5 pr-10 border border-slate-200 rounded-lg text-sm bg-white"
                    placeholder="Enter existing password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 pr-10 border border-slate-200 rounded-lg text-sm bg-white"
                    placeholder="Minimum 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                <input
                  type={showNewPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                  placeholder="Re-enter new password"
                />
              </div>
            </form>
          </div>

          <div className="pt-2 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              form="password-form"
              disabled={isSavingPassword || !currentPassword || !newPassword}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              {isSavingPassword ? "Updating Password..." : "Update Password"}
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* RECENT PERSONAL ADMINISTRATIVE ACTIVITY LOG                  */}
      {/* ============================================================ */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              My Recent Administrative Activity Log
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Real-time audit log of institutional actions, theme configurations, and credential changes executed by your account.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Tamper-Proof Audit Trail
          </span>
        </div>

        {isLoadingActivity ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            Loading recent activity records...
          </div>
        ) : activityLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No recent activity recorded for this administrative session.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activityLogs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {log.action}
                    </span>
                    <span className="font-bold text-slate-800">{log.resource_type}</span>
                  </div>
                  <p className="text-slate-600">{log.details}</p>
                </div>
                <div className="text-right sm:self-center shrink-0">
                  <span className="text-[11px] font-mono text-slate-500 tabular-nums">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
