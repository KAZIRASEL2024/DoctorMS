"use client";

import React, { useState } from "react";
import { Star, X, HeartPulse, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface NurseRatingModalProps {
  bookingId: string;
  bookingCode?: string;
  nurseName?: string;
  nurseAvatar?: string;
  onClose: () => void;
  onSuccess: (data: { rating: number; comment?: string }) => void;
}

export function NurseRatingModal({
  bookingId,
  bookingCode,
  nurseName,
  nurseAvatar,
  onClose,
  onSuccess,
}: NurseRatingModalProps) {
  const { token } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const starLabels: Record<number, string> = {
    1: "1 Star — Poor Experience",
    2: "2 Stars — Fair Care",
    3: "3 Stars — Good Service",
    4: "4 Stars — Very Good & Professional",
    5: "5 Stars — Outstanding & Compassionate Care",
  };

  const activeStarCount = hoverRating !== null ? hoverRating : rating;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setErrorMsg("Please select a rating between 1 and 5 stars");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/v1/nurse-bookings/${bookingId}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit nurse review");
      }

      const data = await res.json();
      onSuccess({ rating, comment: comment.trim() || undefined });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while saving your review");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-start justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-xs shrink-0">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Rate & Review Nurse</h2>
              <p className="text-xs text-slate-500">Verified Patient Feedback</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Nurse Info Card */}
          <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            {nurseAvatar ? (
              <img
                src={nurseAvatar}
                alt={nurseName || "Nurse"}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
                {nurseName ? nurseName.charAt(0) : "N"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 truncate">
                {nurseName || "Assigned Nurse"}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  Home Care Service
                </span>
                {bookingCode && (
                  <span className="text-[11px] font-mono font-medium text-slate-500">
                    {bookingCode}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Star Rating */}
          <div className="text-center py-2 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Select Your Rating
            </label>
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="p-1 rounded-xl transition transform hover:scale-110 active:scale-95 focus:outline-hidden"
                  aria-label={`${star} star`}
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      star <= activeStarCount
                        ? "text-amber-400 fill-amber-400 drop-shadow-xs"
                        : "text-slate-200 fill-transparent hover:text-amber-200"
                    }`}
                  />
                </button>
              ))}
            </div>
            <div className="text-xs font-semibold text-amber-700 bg-amber-50/70 border border-amber-200/60 rounded-xl py-1 px-3 inline-block">
              {starLabels[activeStarCount] || "Tap a star to rate"}
            </div>
          </div>

          {/* Comment / Feedback */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Care Feedback & Review <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Share how the nurse cared for you or your family (e.g., bedside manner, punctuality, clinical skills)..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/50 resize-none transition"
            />
            <div className="text-[11px] text-slate-400 text-right">
              {comment.length}/1000 characters
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                backgroundColor: "var(--brand-button, #059669)",
              }}
              className="flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-semibold shadow-xs hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Star className="w-3.5 h-3.5 fill-white" />
                  <span>Submit Rating</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
