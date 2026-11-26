"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading, isHydrated } = useAuth();
  const { isPinned } = useSidebar();
  const router = useRouter();

  useEffect(() => {
    // Only redirect if hydration is complete and no credentials exist in state or storage
    if (!isLoading && isHydrated) {
      const storedToken =
        typeof window !== "undefined"
          ? (localStorage.getItem("access_token") || localStorage.getItem("token"))
          : null;
      if (!user && !token && !storedToken) {
        router.push("/login");
      }
    }
  }, [user, token, isLoading, isHydrated, router]);

  if (isLoading || !isHydrated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm text-slate-500 font-medium">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  if (!user && !token) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ease-out ${
          isPinned ? "lg:pl-64" : "lg:pl-[72px]"
        }`}
      >
        <Navbar />
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full px-0.5 sm:px-4 lg:px-8 space-y-5 sm:space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
