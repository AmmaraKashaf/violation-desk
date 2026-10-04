"use client";

import { useState } from "react";
import type { Booking, Vehicle, Violation } from "../lib/api";
import { DECISION_LABEL, DECISION_PIN, formatDateTime } from "../lib/display";

const DAYS_SHOWN = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
const HATCH = "repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 4px, transparent 4px 8px)";

type Props = { vehicle: Vehicle; violations: Violation[]; selectedId: string | null };

// The last 14 days, ending at the end of today (browser local time).
function visibleRange(now: number): { start: number; end: number } {
  const endOfToday = new Date(now);
  endOfToday.setHours(24, 0, 0, 0);
  return { start: endOfToday.getTime() - DAYS_SHOWN * DAY_MS, end: endOfToday.getTime() };
}

function Bar({ from, to, range, className, style, label, title }: {
  from: string; to: string; range: { start: number; end: number };
  className: string; style?: React.CSSProperties; label?: string; title: string;
}) {
  const toPercent = (iso: string) =>
    Math.min(100, Math.max(0, ((new Date(iso).getTime() - range.start) / (range.end - range.start)) * 100));
  const left = toPercent(from);
  const width = toPercent(to) - left;
  if (width <= 0) return null; // entirely outside the visible range
  return (
    <div title={title} className={`absolute inset-y-0 overflow-hidden ${className}`} style={{ left: `${left}%`, width: `${width}%`, ...style }}>
      {label && <span className="block truncate px-2 text-xs font-medium leading-[inherit] text-white">{label}</span>}
    </div>
  );
}

function BookingBars({ booking, range }: { booking: Booking; range: { start: number; end: number } }) {
  const returned = booking.actual_return_at ?? booking.end_at;
  // Early return: the bar stops at the actual return. Late return: scheduled part plus an orange extension.
  const isLate = new Date(returned) > new Date(booking.end_at);
  const onTimeEnd = isLate ? booking.end_at : returned;
  const span = `${formatDateTime(booking.start_at)} → ${formatDateTime(returned)}`;
  return (
    <>
      <Bar from={booking.start_at} to={onTimeEnd} range={range} label={booking.renter_name}
        className="rounded-l-lg bg-sky-600 leading-10" title={`${booking.renter_name}: ${span}`} />
      {isLate && (
        <Bar from={booking.end_at} to={returned} range={range} className="rounded-r-lg bg-orange-500"
          style={{ backgroundImage: HATCH }}
          title={`Late: due ${formatDateTime(booking.end_at)}, returned ${formatDateTime(returned)}`} />
      )}
    </>
  );
}

export default function Timeline({ vehicle, violations, selectedId }: Props) {
  const [now] = useState(() => Date.now()); // one snapshot per mount keeps renders pure
  const range = visibleRange(now);
  const live = vehicle.bookings.filter((b) => b.status !== "cancelled");
  const cancelled = vehicle.bookings.filter((b) => b.status === "cancelled");
  const pins = violations.filter((v) => v.vehicle_id === vehicle.id);
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => new Date(range.start + i * DAY_MS));
  const nowPercent = ((now - range.start) / (range.end - range.start)) * 100;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Who had the {vehicle.name}?</h2>
      <p className="text-sm text-slate-500">{vehicle.plate} · last {DAYS_SHOWN} days</p>

      <div className="relative mt-8">
        {/* Day grid and labels */}
        <div className="absolute inset-x-0 -top-5 bottom-0 flex">
          {days.map((day, i) => (
            <div key={day.getTime()} className="relative flex-1 border-l border-slate-100">
              {i % 2 === 0 && (
                <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10px] text-slate-400">
                  {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="relative space-y-2 pt-2">
          <div className="relative h-10 rounded-lg bg-slate-50">
            {live.map((b) => <BookingBars key={b.id} booking={b} range={range} />)}
          </div>
          <div className="relative h-6">
            {cancelled.map((b) => (
              <Bar key={b.id} from={b.start_at} to={b.end_at} range={range} label={`${b.renter_name} (cancelled)`}
                className="rounded-lg bg-slate-400 leading-6 opacity-40" style={{ backgroundImage: HATCH }}
                title={`Cancelled booking, ignored: ${b.renter_name}`} />
            ))}
          </div>
        </div>

        {/* Now marker and ticket pins, drawn across both tracks */}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-slate-400" style={{ left: `${nowPercent}%` }} />
        {pins.map((pin) => {
          const left = ((new Date(pin.occurred_at).getTime() - range.start) / (range.end - range.start)) * 100;
          if (left < 0 || left > 100) return null;
          const selected = pin.id === selectedId;
          return (
            <div key={pin.id} className="absolute -top-1 bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${left}%` }}>
              <span
                title={`${pin.violation} · ${formatDateTime(pin.occurred_at)} · ${DECISION_LABEL[pin.decision]}`}
                className={`rounded-full ring-2 ring-white ${DECISION_PIN[pin.decision]} ${selected ? "h-4 w-4" : "h-3 w-3"}`}
              />
              <span className={`w-0.5 flex-1 ${DECISION_PIN[pin.decision]} ${selected ? "" : "opacity-50"}`} />
              {selected && (
                <span className="mt-1 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                  {formatDateTime(pin.occurred_at)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-sky-600" />Booking</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-orange-500" style={{ backgroundImage: HATCH }} />Late return</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-slate-400 opacity-40" style={{ backgroundImage: HATCH }} />Cancelled (ignored)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-slate-700" />Ticket</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-slate-400" />Now</span>
      </div>
    </section>
  );
}
