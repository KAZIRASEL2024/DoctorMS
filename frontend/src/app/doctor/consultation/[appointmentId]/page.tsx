"use client";

import React, { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function DoctorConsultationRedirect() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params?.appointmentId as string;

  useEffect(() => {
    if (appointmentId) {
      router.replace(`/dashboard/consultation/${appointmentId}`);
    } else {
      router.replace("/dashboard/doctor");
    }
  }, [appointmentId, router]);

  return (
    <div className="p-8 text-center text-slate-500 text-sm">
      Loading consultation workspace...
    </div>
  );
}
