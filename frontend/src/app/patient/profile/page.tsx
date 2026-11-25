"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  Droplet,
  MapPin,
  Heart,
  Save,
  CheckCircle2,
  AlertCircle,
  Camera,
  ArrowLeft,
  FlaskConical,
  Printer,
  Plus,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { BackButton } from "@/components/ui/back-button";

export default function PatientProfilePage() {
  const { user, token } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("MALE");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [addressLine, setAddressLine] = useState("");
  const [allergiesText, setAllergiesText] = useState("");
  const [chronicText, setChronicText] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [mrn, setMrn] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [labReports, setLabReports] = useState<any[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTestName, setUploadTestName] = useState("Diagnostic Lab Report");
  const [uploadCategory, setUploadCategory] = useState("Hematology");
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split("T")[0]);
  const [uploadSummary, setUploadSummary] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/v1/auth/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          const p = data.patient;

          setFirstName(u.first_name || "");
          setLastName(u.last_name || "");
          setPhone(u.phone || (p?.phone || ""));
          setEmail(u.email || "");
          setAvatarUrl(u.avatar_url || "");

          if (p) {
            setPatientId(p.id || null);
            setMrn(p.mrn || "");
            setDateOfBirth(p.date_of_birth ? p.date_of_birth.substring(0, 10) : "1995-01-01");
            setGender(p.gender || "MALE");
            setBloodGroup(p.blood_group || "O+");
            setAddressLine(p.address_line || "");
            setAllergiesText(Array.isArray(p.allergies) ? p.allergies.join(", ") : "");
            setChronicText(Array.isArray(p.chronic_conditions) ? p.chronic_conditions.join(", ") : "");
            if (p.id) {
              fetchLabReports(p.id);
            }
          }
        }
      } catch (err) {
        console.error("Error loading profile", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchProfile();
    }
  }, [token]);

  const fetchLabReports = async (pid: string) => {
    try {
      const res = await fetch(`/api/v1/patients/${pid}/lab-reports`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (res.ok) {
        const data = await res.json();
        setLabReports(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("Error fetching lab reports", e);
    }
  };

  const handleUploadLabReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    setIsUploading(true);

    try {
      if (uploadFile) {
        const formData = new FormData();
        formData.append("file", uploadFile);
        formData.append("test_name", uploadTestName);
        formData.append("test_category", uploadCategory);
        formData.append("test_date", uploadDate);
        formData.append("result_summary", uploadSummary || `Uploaded ${uploadFile.name}`);

        const res = await fetch(`/api/v1/patients/${patientId}/lab-reports/upload`, {
          method: "POST",
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: formData,
        });

        if (!res.ok) throw new Error("Failed to upload lab report PDF");
      } else {
        const res = await fetch(`/api/v1/patients/${patientId}/lab-reports`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            test_name: uploadTestName,
            test_category: uploadCategory,
            test_date: uploadDate,
            result_summary: uploadSummary || "Patient self-uploaded diagnostic report.",
            status: "Completed",
          }),
        });

        if (!res.ok) throw new Error("Failed to save lab report");
      }

      setShowUploadModal(false);
      setUploadFile(null);
      setUploadSummary("");
      fetchLabReports(patientId);
    } catch (err: any) {
      alert(err.message || "Failed to upload diagnostic report");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const allergies = allergiesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch(`/api/v1/auth/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone: phone,
          avatar_url: avatarUrl || null,
          gender: gender,
          blood_group: bloodGroup,
          date_of_birth: dateOfBirth,
          address_line: addressLine,
          allergies: allergies,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Update failed" }));
        throw new Error(err.detail || "Failed to update profile");
      }

      const updated = await res.json();
      if (typeof window !== "undefined" && updated.user) {
        localStorage.setItem("user_info", JSON.stringify(updated.user));
      }
      setSuccessMessage("Your profile information has been successfully updated!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span>Loading medical profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton fallbackHref="/patient/dashboard" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Patient Medical Profile</h1>
            <p className="text-xs text-slate-500">Manage your demographics, baseline health records, and contact details</p>
          </div>
        </div>

        {mrn && (
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-bold">
            MRN: {mrn}
          </div>
        )}
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Avatar Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-12 h-12 text-slate-400" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full cursor-pointer shadow-md transition">
              <Camera className="w-4 h-4" />
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>

          <div className="text-center sm:text-left space-y-1">
            <h3 className="text-base font-bold text-slate-900">Profile Photo</h3>
            <p className="text-xs text-slate-500">
              Upload a clear photo to help clinic receptionists and doctors recognize you during check-in.
            </p>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl("")}
                className="text-xs text-rose-600 hover:underline pt-1"
              >
                Remove photo
              </button>
            )}
          </div>
        </div>

        {/* Demographics & Contact */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Personal & Contact Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Phone Number (01...) *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Date of Birth *
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  required
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Gender *
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Blood Group *
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
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
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Residential Address
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Street / Area, City, Bangladesh"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Baseline Medical History */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Baseline Medical & Safety Records
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Known Drug Allergies (comma separated)
            </label>
            <input
              type="text"
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              placeholder="e.g. Penicillin, Sulfa, Peanuts"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Doctors will receive high-priority alerts before issuing prescriptions if allergic medicines are prescribed.
            </p>
          </div>
        </div>

        {/* Diagnostic Lab Reports & Outside Test Documents */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900">Diagnostic Lab Reports & Test Documents</h3>
                <p className="text-xs text-slate-500">Official clinic lab investigations and uploaded outside diagnostic PDFs</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Upload / Add Lab Report</span>
            </button>
          </div>

          {labReports.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
              No diagnostic reports uploaded yet. Click "+ Upload / Add Lab Report" to upload outside PDF test reports for your doctor to review.
            </div>
          ) : (
            <div className="space-y-3">
              {labReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{report.test_name}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {report.test_category || "Diagnostic Report"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ✓ {report.status || "Completed"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Date: {report.test_date} • {report.lab_name || "Diagnostic Laboratory"}
                    </p>
                    <p className="text-xs text-slate-700 mt-1 line-clamp-2">
                      <strong>Summary:</strong> {report.result_summary}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={`/api/v1/patients/${patientId}/lab-reports/${report.id}/print-html?token=${token || ""}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>View / Download PDF</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl p-6 space-y-4 my-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-base text-slate-900">Upload Outside Diagnostic Report</h3>
                </div>
                <button type="button" onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Test / Investigation Name</label>
                  <input
                    type="text"
                    required
                    value={uploadTestName}
                    onChange={(e) => setUploadTestName(e.target.value)}
                    placeholder="e.g. CBC, Serum Creatinine, Chest X-Ray, ECG..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Discipline / Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Hematology">Hematology</option>
                      <option value="Biochemistry">Biochemistry</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="Radiology">Radiology & Imaging</option>
                      <option value="General Pathology">General Pathology</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Test Date</label>
                    <input
                      type="date"
                      required
                      value={uploadDate}
                      onChange={(e) => setUploadDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Summary / Key Findings</label>
                  <textarea
                    rows={2}
                    value={uploadSummary}
                    onChange={(e) => setUploadSummary(e.target.value)}
                    placeholder="Enter diagnostic report summary or key values..."
                    className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attach Report PDF / Scan File</label>
                  <div className="border border-dashed border-slate-300 rounded-xl p-3 bg-slate-50 text-center">
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                    />
                    {uploadFile && (
                      <div className="text-[11px] text-emerald-700 font-medium mt-1">
                        Selected: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={handleUploadLabReport}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
                  >
                    {isUploading ? "Uploading..." : "Upload Lab Report"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl text-sm shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
