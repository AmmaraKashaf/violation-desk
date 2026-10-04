// Shared display rules: colours, labels and date formatting. Times show in the browser's local time.

import type { Decision, ViolationStatus } from "./api";

// Same value as URGENT_DAYS in backend/app/config.py.
export const URGENT_DAYS = 5;
const SOON_DAYS = 14;

export const DECISION_LABEL: Record<Decision, string> = {
  renter_liable: "Renter liable",
  operator_liable: "Operator liable",
  needs_review: "Needs review",
  no_vehicle: "Not in fleet",
};

export const DECISION_BADGE: Record<Decision, string> = {
  renter_liable: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  operator_liable: "bg-rose-100 text-rose-800 ring-rose-200",
  needs_review: "bg-amber-100 text-amber-800 ring-amber-200",
  no_vehicle: "bg-slate-100 text-slate-700 ring-slate-200",
};

// Solid colour for ticket pins on the timeline.
export const DECISION_PIN: Record<Decision, string> = {
  renter_liable: "bg-emerald-600",
  operator_liable: "bg-rose-600",
  needs_review: "bg-amber-500",
  no_vehicle: "bg-slate-500",
};

export const STATUS_LABEL: Record<ViolationStatus, string> = {
  open: "Open",
  charged_renter: "Charged to renter",
  paid_by_operator: "Paid by you",
  dismissed: "Dismissed",
};

export function deadlineBadge(daysLeft: number): string {
  if (daysLeft <= URGENT_DAYS) return "bg-rose-100 text-rose-800 ring-rose-200";
  if (daysLeft <= SOON_DAYS) return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-emerald-100 text-emerald-800 ring-emerald-200";
}

export function daysLeftText(daysLeft: number): string {
  if (daysLeft < 0) return `${-daysLeft} day${daysLeft === -1 ? "" : "s"} overdue`;
  if (daysLeft === 0) return "Due today";
  return `${daysLeft} day${daysLeft === 1 ? "" : "s"} left`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "2026-10-06" is a calendar date, not a moment: build it locally so it never shifts a day.
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
