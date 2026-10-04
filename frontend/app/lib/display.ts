// Shared display rules: colours, labels and date formatting. Times show in the operator's timezone,
// not the browser's, so they match the times written in the reason text.

import type { Decision, ViolationStatus } from "./api";

// Same values as URGENT_DAYS and OPERATOR_TIMEZONE in backend/app/config.py.
export const URGENT_DAYS = 5;
export const OPERATOR_TIMEZONE = "America/New_York";
export const TIMEZONE_LABEL = "ET"; // short tag shown next to times
export const TIMEZONE_CITY = OPERATOR_TIMEZONE.split("/").pop()!.replace(/_/g, " "); // "New York"
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

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  timeZone: OPERATOR_TIMEZONE, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});
const timeFormat = new Intl.DateTimeFormat(undefined, { timeZone: OPERATOR_TIMEZONE, hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat(undefined, { timeZone: OPERATOR_TIMEZONE, month: "short", day: "numeric" });
const weekdayFormat = new Intl.DateTimeFormat(undefined, {
  timeZone: OPERATOR_TIMEZONE, weekday: "short", month: "short", day: "numeric",
});
const partsFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: OPERATOR_TIMEZONE, hourCycle: "h23",
  year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
});

// Date and time without the zone tag; render TIMEZONE_LABEL next to it.
export function formatDateTime(iso: string | number): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatTime(time: number): string {
  return timeFormat.format(time);
}

export function formatDay(time: number, withWeekday = false): string {
  return (withWeekday ? weekdayFormat : dayFormat).format(time);
}

// For plain-text spots (tooltips) where a styled label can't go.
export function formatDateTimeTz(iso: string | number): string {
  return `${formatDateTime(iso)} ${TIMEZONE_LABEL}`;
}

function wallClock(time: number): Record<string, number> {
  return Object.fromEntries(partsFormat.formatToParts(time).map((part) => [part.type, Number(part.value)]));
}

// How far the operator's wall clock is ahead of UTC at this moment (negative in the Americas).
function zoneOffsetMs(time: number): number {
  const p = wallClock(time);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(time / 1000) * 1000;
}

// Midnight at the start of the operator's day containing this moment. Handles DST days (23 or 25 hours).
export function startOfOperatorDay(time: number): number {
  const p = wallClock(time);
  const midnightWall = Date.UTC(p.year, p.month - 1, p.day);
  const guess = midnightWall - zoneOffsetMs(time);
  return midnightWall - zoneOffsetMs(guess);
}

// Midnight at the start of the next operator day.
export function startOfNextOperatorDay(time: number): number {
  return startOfOperatorDay(startOfOperatorDay(time) + 36 * 60 * 60 * 1000);
}

// "2026-10-06" is a calendar date, not a moment: build it locally so it never shifts a day.
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}
