"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardAdminWebsiteSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/website-settings");
  }, [router]);

  return (
    <div className="flex items-center justify-center p-12 text-slate-500">
      <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3" />
      <span>Redirecting to Website Settings CMS...</span>
    </div>
  );
}
