"use client";

import { useEffect, useState } from "react";
import { createViolation, getSamples, parseNotice, type ParsedNotice, type Sample, type Violation } from "../lib/api";

type FieldKey = "plate" | "violation" | "occurred_local" | "location" | "amount" | "notice_date" | "respond_by";
type Fields = Record<FieldKey, string>;

// One entry per editable field; reorder or relabel here.
const FIELDS: { key: FieldKey; label: string; type: string }[] = [
  { key: "plate", label: "Plate", type: "text" },
  { key: "violation", label: "Violation", type: "text" },
  { key: "occurred_local", label: "Date & time (as on notice)", type: "datetime-local" },
  { key: "location", label: "Location", type: "text" },
  { key: "amount", label: "Fine ($)", type: "number" },
  { key: "notice_date", label: "Notice date", type: "date" },
  { key: "respond_by", label: "Respond by", type: "date" },
];

function toFields(parsed: ParsedNotice): Fields {
  return {
    plate: parsed.plate ?? "",
    violation: parsed.violation ?? "",
    occurred_local: parsed.occurred_local?.slice(0, 16) ?? "", // datetime-local wants YYYY-MM-DDTHH:MM
    location: parsed.location,
    amount: parsed.amount?.toString() ?? "",
    notice_date: parsed.notice_date ?? "",
    respond_by: parsed.respond_by ?? "",
  };
}

type Props = { onSaved: (violation: Violation) => void };

export default function NoticeForm({ onSaved }: Props) {
  const [text, setText] = useState("");
  const [samples, setSamples] = useState<Sample[]>([]);
  const [fields, setFields] = useState<Fields | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSamples().then(setSamples).catch((e: Error) => setError(e.message));
  }, []);

  function pickSample(sample: Sample) {
    setText(sample.text);
    setFields(null);
    setError(null);
    setNote(null);
  }

  async function readNotice() {
    setBusy(true);
    setError(null);
    try {
      const { parsed, message } = await parseNotice(text);
      setFields(toFields(parsed));
      setMissing(parsed.missing);
      setNote(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function checkWhoHadTheCar() {
    if (!fields) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await createViolation({ ...fields, amount: Number(fields.amount), raw_text: text || null });
      onSaved(saved);
      setText("");
      setFields(null);
      setNote(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">New notice</h2>
      <p className="mt-1 text-sm text-slate-500">Paste the ticket text, or try a sample.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {samples.map((sample) => (
          <button
            key={sample.label}
            onClick={() => pickSample(sample)}
            disabled={busy}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            {sample.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"Plate: EV-3001\nViolation: Parking\nDate/Time: 2026-09-24 14:12\n..."}
        className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-sm focus:border-slate-400 focus:outline-none"
      />
      <button
        onClick={readNotice}
        disabled={busy || !text.trim()}
        className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
      >
        {busy && !fields ? "Reading…" : "Read notice"}
      </button>

      {fields && (
        <div className="mt-6 border-t border-slate-100 pt-6">
          <h3 className="font-medium">Check the details</h3>
          <p className="mt-1 text-sm text-slate-500">Fix anything the reader got wrong. Times are as printed on the notice (operator&apos;s city).</p>
          {note && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, type }) => (
              <label key={key} className="text-sm">
                <span className="text-slate-600">{label}</span>
                <input
                  type={type}
                  step={type === "number" ? "0.01" : undefined}
                  value={fields[key]}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none ${
                    missing.includes(key) && !fields[key] ? "border-amber-400 bg-amber-50" : "border-slate-200"
                  }`}
                />
              </label>
            ))}
          </div>
          <button
            onClick={checkWhoHadTheCar}
            disabled={busy}
            className="mt-5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
          >
            {busy ? "Checking…" : "Check who had the car"}
          </button>
        </div>
      )}

      {error && <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
    </section>
  );
}
