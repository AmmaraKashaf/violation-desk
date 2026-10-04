"use client";

import type { Violation } from "../lib/api";
import { DECISION_BADGE, DECISION_LABEL, STATUS_LABEL, daysLeftText, deadlineBadge, money } from "../lib/display";

type Props = { violations: Violation[]; selectedId: string | null; onSelect: (id: string) => void };

export default function Inbox({ violations, selectedId, onSelect }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Inbox</h2>
      <p className="text-sm text-slate-500">Soonest deadline first.</p>

      {violations.length === 0 && <p className="mt-6 text-sm text-slate-400">No tickets logged yet. Try a sample.</p>}

      <ul className="mt-4 space-y-2">
        {violations.map((v) => {
          const isOpen = v.status === "open";
          return (
            <li key={v.id}>
              <button
                onClick={() => onSelect(v.id)}
                className={`w-full rounded-xl border p-3 text-left transition hover:bg-slate-50 ${
                  v.id === selectedId ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"
                } ${isOpen ? "" : "opacity-60"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${DECISION_BADGE[v.decision]}`}>
                    {DECISION_LABEL[v.decision]}
                  </span>
                  {isOpen ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${deadlineBadge(v.days_left)}`}>
                      {daysLeftText(v.days_left)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">{STATUS_LABEL[v.status]}</span>
                  )}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{v.violation} · {v.plate}</span>
                  <span className="shrink-0 text-slate-600">{money(v.amount)}</span>
                </div>
                {v.renter_name && <p className="mt-0.5 text-xs text-slate-500">{v.renter_name}</p>}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
