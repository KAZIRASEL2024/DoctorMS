import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a doctor's display name, safely avoiding double prefixes (e.g. "Dr. Dr.Hook Hasan" -> "Dr. Hook Hasan").
 * Accepts both separate (firstName, lastName) strings and doctor objects.
 */
export function formatDoctorName(doctorOrFirstName?: any, maybeLastName?: string): string {
  let first = "";
  let last = "";

  if (typeof doctorOrFirstName === "object" && doctorOrFirstName !== null) {
    first = doctorOrFirstName.first_name || doctorOrFirstName.name || "";
    last = doctorOrFirstName.last_name || "";
  } else {
    first = doctorOrFirstName || "";
    last = maybeLastName || "";
  }

  let full = `${first} ${last}`.trim();
  if (!full) return "Doctor";

  // Cleanly strip any existing prefixes (with/without space, with/without dot, repetitive)
  while (/^(dr|prof|doctor|md)(\.|\s|$)/i.test(full) || /^(dr\.?|prof\.?|doctor\.?|md\.?)/i.test(full)) {
    const stripped = full.replace(/^(dr\.?|prof\.?|doctor\.?|md\.?)\s*/i, "").trim();
    if (stripped === full || !stripped) break;
    full = stripped;
  }

  return `Dr. ${full}`;
}

/**
 * Formats a currency value in Bangladeshi Taka (৳ BDT).
 */
export function formatCurrency(amount: number): string {
  return `৳${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
