"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { UserPlus, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";

export default function RegisterPatientPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("1995-01-01");
  const [gender, setGender] = useState("FEMALE");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [phone, setPhone] = useState("+880 ");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Dhaka");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [successResult, setSuccessResult] = useState<any | null>(null);

  const registerMutation = useMutation({
    mutationFn: (data: any) =>
      apiClient("/patients", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setSuccessResult(data);
    },
    onError: (err: any) => {
      alert("Failed to register patient: " + (err.message || "Unknown error"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allergiesList = allergies ? allergies.split(",").map((s) => s.trim()) : [];
    const conditionsList = chronicConditions
      ? chronicConditions.split(",").map((s) => s.trim())
      : [];

    registerMutation.mutate({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob,
      gender,
      blood_group: bloodGroup,
      phone,
      email: email || undefined,
      address_line: address || undefined,
      city,
      emergency_contact_name: emergencyName || undefined,
      emergency_contact_phone: emergencyPhone || undefined,
      allergies: allergiesList,
      chronic_conditions: conditionsList,
      notes: notes || undefined,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallbackHref="/dashboard/patients" />
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Walk-In & New Patient Registration</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enrolls patient into clinic tenant database and provisions unique Medical Record Number (MRN).
          </p>
        </div>
      </div>

      {successResult ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Patient Registered Successfully!</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {successResult.first_name} {successResult.last_name} has been enrolled. Generated MRN:
          </p>
          <div className="inline-block p-3 bg-emerald-50 border border-emerald-200 rounded-xl font-mono text-xl font-bold text-emerald-800">
            {successResult.mrn}
          </div>
          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              href="/dashboard/appointments/book"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition"
            >
              Book Appointment Now
            </Link>
            <button
              onClick={() => {
                setSuccessResult(null);
                setFirstName("");
                setLastName("");
              }}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition"
            >
              Register Another Walk-In
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <h3 className="font-bold text-sm text-slate-800 border-b pb-2">1. Demographics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Tanzim"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Ahmed"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth *</label>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gender *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm bg-white"
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <h3 className="font-bold text-sm text-slate-800 border-b pb-2 pt-2">2. Contact Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+880 1711-..."
                className="w-full p-2.5 border rounded-lg text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional@domain.com"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House 12, Road 4, Dhanmondi"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <h3 className="font-bold text-sm text-slate-800 border-b pb-2 pt-2">3. Medical Baseline</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Known Drug Allergies (Comma separated)
              </label>
              <input
                type="text"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="Penicillin, Sulfa drugs"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chronic Conditions
              </label>
              <input
                type="text"
                value={chronicConditions}
                onChange={(e) => setChronicConditions(e.target.value)}
                placeholder="Hypertension, Type 2 Diabetes"
                className="w-full p-2.5 border rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t flex items-center justify-end gap-3">
            <Link
              href="/dashboard/receptionist"
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition"
            >
              {registerMutation.isPending ? "Registering..." : "Register Patient"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
