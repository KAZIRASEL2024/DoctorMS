"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function NurseBookRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nurseId = searchParams.get("nurseId");

  useEffect(() => {
    if (nurseId) {
      router.replace(`/nurses?nurseId=${encodeURIComponent(nurseId)}`);
    } else {
      router.replace("/nurses");
    }
  }, [nurseId, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-500 text-sm">
      <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-3" />
      <span>Redirecting to Nurse Reservation...</span>
    </div>
  );
}

export default function NurseBookPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading...</div>}>
      <NurseBookRedirect />
    </Suspense>
  );
}
