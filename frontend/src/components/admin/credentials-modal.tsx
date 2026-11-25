"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  X,
  ShieldAlert,
} from "lucide-react";

export interface UserCredentialsTarget {
  userId?: string | null;
  patientId?: string | null;
  name: string;
  email: string;
  role: string;
  identifier?: string; // e.g. Staff ID or MRN
}

interface CredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: UserCredentialsTarget | null;
  onSuccess?: () => void;
}

export function CredentialsModal({
  isOpen,
  onClose,
  target,
  onSuccess,
}: CredentialsModalProps) {
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state whenever target changes or modal opens
  useEffect(() => {
    if (target) {
      setEmail(target.email || "");
      setPassword("");
      setShowPassword(false);
      setCopied(false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [target, isOpen]);

  const updateCredentialsMutation = useMutation({
    mutationFn: async (payload: { email?: string; new_password?: string }) => {
      // Use userId or patientId
      const targetId = target?.userId || target?.patientId;
      if (!targetId) throw new Error("No target user or patient identifier found.");

      return apiClient<{ success: boolean; message: string; email: string }>(
        `/admin/users/${targetId}/credentials`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: (data) => {
      setSuccessMsg(data.message || "User credentials updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["clinic-staff"] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      queryClient.invalidateQueries({ queryKey: ["patient-clinical-summary"] });

      if (onSuccess) onSuccess();

      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1200);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update user credentials. Please try again.");
    },
  });

  if (!isOpen || !target) return null;

  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*";
    let generated = "";
    for (let i = 0; i < 10; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(generated);
    setShowPassword(true);
    setCopied(false);
  };

  const handleCopyPassword = () => {
    if (!password) return;
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailTrimmed = email.trim();
    const passwordTrimmed = password.trim();

    if (!emailTrimmed && !passwordTrimmed) {
      setErrorMsg("Please enter an updated email or a new password.");
      return;
    }

    if (passwordTrimmed && passwordTrimmed.length < 6) {
      setErrorMsg("New password must be at least 6 characters long.");
      return;
    }

    updateCredentialsMutation.mutate({
      email: emailTrimmed !== target.email ? emailTrimmed : undefined,
      new_password: passwordTrimmed || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl w-[95vw] max-w-md max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 space-y-5 my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">
                User Credentials
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold text-slate-800">
                  {target.name}
                </span>
                <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {target.role}
                </span>
                {target.identifier && (
                  <span className="text-[10px] font-mono text-slate-400">
                    ({target.identifier})
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error / Success Feedback Banners */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-bold">{successMsg}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Login Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Primary email used for portal authentication and verification.
            </p>
          </div>

          {/* New Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Set New Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 transition"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>Generate Random</span>
              </button>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep existing password"
                minLength={6}
                className="w-full pl-9 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                {password && (
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/80 transition"
                    title="Copy Password"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/80 transition"
                  title={showPassword ? "Hide Password" : "Show Password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Leave blank to keep current password. Minimum 6 characters if updating.
            </p>
          </div>

          {/* Audit Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-[11px] text-slate-500">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              All credential modifications are encrypted, logged into the tamper-evident
              System Audit Trail, and take effect instantly.
            </span>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={updateCredentialsMutation.isPending}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateCredentialsMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
            >
              {updateCredentialsMutation.isPending ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Credentials</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
