"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackButtonProps {
  fallbackHref?: string;
  label?: string;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({
  fallbackHref = "/dashboard",
  label = "Back",
  className = "",
}) => {
  const router = useRouter();

  const handleBack = () => {
    // If browser has history, use back(); otherwise navigate safely to fallbackHref
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 hover:text-slate-900 border border-slate-200 rounded-xl shadow-2xs transition-colors cursor-pointer group shrink-0 ${className}`}
      title="Go Back"
    >
      <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
