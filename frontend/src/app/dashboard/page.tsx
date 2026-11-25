"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function DashboardIndex() {
  const { currentRole, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (currentRole === "DOCTOR") {
        router.replace("/dashboard/doctor");
      } else if (currentRole === "RECEPTIONIST") {
        router.replace("/dashboard/receptionist");
      } else {
        router.replace("/dashboard/admin");
      }
    }
  }, [currentRole, isLoading, router]);

  return (
    <div className="h-64 flex items-center justify-center text-slate-400 text-sm">
      Routing to your role workspace...
    </div>
  );
}
