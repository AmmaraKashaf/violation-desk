"use client";

import { useEffect, useState } from "react";
import DecisionCard from "./components/DecisionCard";
import Inbox from "./components/Inbox";
import NoticeForm from "./components/NoticeForm";
import Timeline from "./components/Timeline";
import { listVehicles, listViolations, resetDemo, type Vehicle, type Violation } from "./lib/api";

export default function Home() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  function refresh(): Promise<void> {
    return Promise.all([listViolations(), listVehicles()])
      .then(([nextViolations, nextVehicles]) => {
        setViolations(nextViolations);
        setVehicles(nextVehicles);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleReset() {
    if (!confirm("Delete all tickets and reload the demo bookings?")) return;
    setResetting(true);
    try {
      await resetDemo();
      setSelectedId(null);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResetting(false);
    }
  }

  function handleChanged(violation: Violation) {
    setSelectedId(violation.id);
    refresh();
  }

  const selected = violations.find((v) => v.id === selectedId) ?? null;
  const vehicle = vehicles.find((v) => v.id === selected?.vehicle_id) ?? null;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Violation Desk</h1>
          <p className="mt-1 text-slate-500">Find who had the car when the ticket was issued, and answer before the deadline.</p>
        </div>
        <button
          onClick={handleReset}
          disabled={resetting}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {resetting ? "Resetting…" : "Reset demo data"}
        </button>
      </header>

      {error && <p className="mt-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <NoticeForm onSaved={handleChanged} />
          {selected && <DecisionCard key={selected.id} violation={selected} vehicle={vehicle} onResolved={handleChanged} />}
          {selected && vehicle && <Timeline vehicle={vehicle} violations={violations} selectedId={selected.id} />}
          {selected && !vehicle && (
            <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              No vehicle in your fleet has plate {selected.plate}, so there is no timeline to show.
            </p>
          )}
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Inbox violations={violations} selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
      </div>

      <footer className="mt-10 text-center text-xs text-slate-400">
        Times shown in your local time. Payments are mocked.
      </footer>
    </main>
  );
}
