"use client";

import { useState } from "react";
import type { Booking, Vehicle, Violation } from "../lib/api";
import {
  DECISION_LABEL, DECISION_PIN, formatDateTime, formatDateTimeTz, formatDay, formatTime, startOfNextOperatorDay, startOfOperatorDay,
} from "../lib/display";
import TzLabel from "./TzLabel";

const DAYS_SHOWN = 14;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HATCH = "repeating-linear-gradient(45deg, rgba(255,255,255,0.45) 0 4px, transparent 4px 8px)";

type Range = { start: number; end: number };
type Props = { vehicle: Vehicle; violations: Violation[]; selectedId: string | null };

// "14 days": the last 14 days up to the end of today. "Ticket day": the selected ticket's day,
// zoomed in so a few hours of late return are easy to see. Days are the operator's days.
function visibleRange(now: number, ticketAt: string | null, zoomed: boolean): Range {
  if (zoomed && ticketAt) {
    const ticketTime = new Date(ticketAt).getTime();
    return { start: startOfOperatorDay(ticketTime), end: startOfNextOperatorDay(ticketTime) };
  }
  const end = startOfNextOperatorDay(now);
  return { start: startOfOperatorDay(end - DAYS_SHOWN * DAY_MS + 12 * HOUR_MS), end };
}

// One tick per operator midnight (14-day view) or every 3 hours from midnight (ticket day).
function tickTimes(range: Range, zoomed: boolean): number[] {
  const ticks: number[] = [];
  for (let t = range.start; t < range.end; t = zoomed ? t + 3 * HOUR_MS : startOfNextOperatorDay(t)) ticks.push(t);
  return ticks;
}

function toPercent(iso: string | number, range: Range): number {
  const time = typeof iso === "number" ? iso : new Date(iso).getTime();
  return ((time - range.start) / (range.end - range.start)) * 100;
}

function Bar({ from, to, range, className, style, label, title }: {
  from: string; to: string; range: Range; className: string; style?: React.CSSProperties; label?: string; title: string;
}) {
  const left = Math.max(0, toPercent(from, range));
  const width = Math.min(100, toPercent(to, range)) - left;
  if (width <= 0) return null; // entirely outside the visible range
  return (
    <div title={title} className={`absolute inset-y-0 overflow-hidden ${className}`} style={{ left: `${left}%`, width: `${width}%`, ...style }}>
      {label && <span className="block truncate px-2 text-xs font-medium leading-[inherit] text-white">{label}</span>}
    </div>
  );
}

function BookingBars({ booking, range }: { booking: Booking; range: Range }) {
  const returned = booking.actual_return_at ?? booking.end_at;
  // Early return: the bar stops at the actual return. Late return: scheduled part plus an orange extension.
  const isLate = new Date(returned) > new Date(booking.end_at);
  const onTimeEnd = isLate ? booking.end_at : returned;
  const span = `${formatDateTime(booking.start_at)} → ${formatDateTimeTz(returned)}`;
  return (
    <>
      <Bar from={booking.start_at} to={onTimeEnd} range={range} label={booking.renter_name}
        className="rounded-l-lg bg-sky-600 leading-10" title={`${booking.renter_name}: ${span}`} />
      {isLate && (
        <Bar from={booking.end_at} to={returned} range={range} className="rounded-r-lg bg-orange-500"
          style={{ backgroundImage: HATCH }}
          title={`Late: due ${formatDateTimeTz(booking.end_at)}, returned ${formatDateTimeTz(returned)}`} />
      )}
    </>
  );
}

export default function Timeline({ vehicle, violations, selectedId }: Props) {
  const [now] = useState(() => Date.now()); // one snapshot per mount keeps renders pure
  const [zoomed, setZoomed] = useState(false);
  const pins = violations.filter((v) => v.vehicle_id === vehicle.id);
  const selected = pins.find((v) => v.id === selectedId) ?? null;
  const range = visibleRange(now, selected?.occurred_at ?? null, zoomed);

  const live = vehicle.bookings.filter((b) => b.status !== "cancelled");
  const cancelled = vehicle.bookings.filter((b) => b.status === "cancelled");
  const ticks = tickTimes(range, zoomed);
  const tickLabel = (t: number) => zoomed ? formatTime(t) : formatDay(t);
  const nowPercent = toPercent(now, range);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Who had the {vehicle.name}?</h2>
          <p className="text-sm text-slate-500">
            {vehicle.plate} · {zoomed && selected ? <>{formatDay(range.start, true)}<TzLabel /></> : <>last {DAYS_SHOWN} days<TzLabel /></>}
          </p>
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {[false, true].map((zoom) => (
            <button key={String(zoom)} onClick={() => setZoomed(zoom)} disabled={zoom && !selected}
              className={`rounded-md px-3 py-1 disabled:opacity-40 ${zoomed === zoom ? "bg-white font-medium shadow-sm" : "text-slate-500"}`}>
              {zoom ? "Ticket day" : `${DAYS_SHOWN} days`}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-8">
        {/* Grid and labels */}
        <div className="absolute inset-x-0 -top-5 bottom-0 flex">
          {ticks.map((tick, i) => (
            <div key={tick} className="relative flex-1 border-l border-slate-100">
              {(zoomed || i % 2 === 0) && (
                <span className="absolute -top-0.5 left-1 whitespace-nowrap text-[10px] text-slate-400">{tickLabel(tick)}</span>
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
          <div className="h-5" />{/* room for the selected pin's label */}
        </div>

        {/* Now marker and ticket pins, drawn across both tracks */}
        {nowPercent >= 0 && nowPercent <= 100 && (
          <div className="pointer-events-none absolute inset-y-0 w-px bg-slate-400" style={{ left: `${nowPercent}%` }} />
        )}
        {pins.map((pin) => {
          const left = toPercent(pin.occurred_at, range);
          if (left < 0 || left > 100) return null;
          const isSelected = pin.id === selectedId;
          return (
            <div key={pin.id} className="absolute -top-1 bottom-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${left}%` }}>
              <span
                title={`${pin.violation} · ${formatDateTimeTz(pin.occurred_at)} · ${DECISION_LABEL[pin.decision]}`}
                className={`rounded-full ring-2 ring-white ${DECISION_PIN[pin.decision]} ${isSelected ? "h-4 w-4" : "h-3 w-3"}`}
              />
              <span className={`w-0.5 flex-1 ${DECISION_PIN[pin.decision]} ${isSelected ? "" : "opacity-50"}`} />
              {isSelected && (
                <span className="mt-1 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white">
                  {formatDateTime(pin.occurred_at)}<TzLabel className="text-slate-300" />
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-sky-600" />Booking</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-orange-500" style={{ backgroundImage: HATCH }} />Late return</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded bg-slate-400 opacity-40" style={{ backgroundImage: HATCH }} />Cancelled (ignored)</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-slate-700" />Ticket</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-px bg-slate-400" />Now</span>
      </div>
    </section>
  );
}
