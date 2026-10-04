"use client";

import { useState } from "react";
import { resolveViolation, type ResolveAction, type Vehicle, type Violation } from "../lib/api";
import {
  DECISION_BADGE, DECISION_LABEL, STATUS_LABEL, daysLeftText, deadlineBadge, formatDate, formatDateTime, money,
} from "../lib/display";

type Props = {
  violation: Violation;
  vehicle: Vehicle | null;
  onResolved: (violation: Violation) => void;
};

export default function DecisionCard({ violation, vehicle, onResolved }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booking = vehicle?.bookings.find((b) => b.id === violation.booking_id) ?? null;
  const isOpen = violation.status === "open";
  const renterLiable = violation.decision === "renter_liable";

  async function resolve(action: ResolveAction) {
    setBusy(true);
    setError(null);
    try {
      onResolved(await resolveViolation(violation.id, action));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ${DECISION_BADGE[violation.decision]}`}>
          {DECISION_LABEL[violation.decision]}
          {violation.late_return && " · late return"}
        </span>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ring-1 ${deadlineBadge(violation.days_left)}`}>
          {daysLeftText(violation.days_left)} · respond by {formatDate(violation.respond_by)}
        </span>
      </div>

      <h2 className="mt-4 text-lg font-semibold">
        {violation.violation} · {violation.plate}
        {violation.vehicle_name && <span className="font-normal text-slate-500"> ({violation.vehicle_name})</span>}
      </h2>
      <p className="text-sm text-slate-500">
        {formatDateTime(violation.occurred_at)} · {violation.location}
      </p>

      <p className="mt-4 text-base leading-relaxed text-slate-800">{violation.reason}</p>

      {booking && (
        <dl className="mt-4 grid gap-x-6 gap-y-1 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-slate-500">Renter</dt>
          <dd className="font-medium">{booking.renter_name}</dd>
          <dt className="text-slate-500">Scheduled</dt>
          <dd>{formatDateTime(booking.start_at)} → {formatDateTime(booking.end_at)}</dd>
          <dt className="text-slate-500">Actually returned</dt>
          <dd className={violation.late_return ? "font-medium text-orange-700" : ""}>
            {booking.actual_return_at ? formatDateTime(booking.actual_return_at) : "Not returned yet"}
          </dd>
        </dl>
      )}

      {renterLiable && violation.charge_total !== null && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Fine</span><span>{money(violation.amount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Admin fee</span><span>{money(violation.charge_total - violation.amount)}</span></div>
          <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold">
            <span>Charge to renter</span><span>{money(violation.charge_total)}</span>
          </div>
        </div>
      )}
      {!renterLiable && (
        <p className="mt-4 text-sm text-slate-500">Fine: {money(violation.amount)}. No renter can be charged for this ticket.</p>
      )}

      {isOpen ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => resolve("charge_renter")}
            disabled={busy || !renterLiable}
            title={renterLiable ? undefined : "Only a renter-liable ticket can be charged to the renter"}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Charge renter
          </button>
          <button onClick={() => resolve("operator_pays")} disabled={busy}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-40">
            I&apos;ll pay it
          </button>
          <button onClick={() => resolve("dismiss")} disabled={busy}
            className="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40">
            Dismiss
          </button>
        </div>
      ) : (
        <p className="mt-6 text-sm font-medium text-slate-700">Resolved: {STATUS_LABEL[violation.status]}</p>
      )}

      {violation.status === "charged_renter" && violation.message_draft && (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-medium">Charged {money(violation.charge_total ?? 0)} (mock payment). Message to send:</p>
          <p className="mt-2 whitespace-pre-line leading-relaxed">{violation.message_draft}</p>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </section>
  );
}
