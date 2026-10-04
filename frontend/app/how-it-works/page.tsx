import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works · Violation Desk",
  description: "The plain rules Violation Desk uses to decide who had the car.",
};

// Plain-words summary of backend/app/attribution.py and config.py. Keep the numbers in sync with config.py.
const RULES: { title: string; body: string }[] = [
  {
    title: "Match the ticket time to a booking",
    body: "Each booking covers the time from pickup until the car actually came back. If exactly one booking covers the moment of the ticket, that renter had the car.",
  },
  {
    title: "The actual return time counts, not the scheduled one",
    body: "If a trip was due back at 10:00 but the car came back at 13:20, a ticket at 11:47 belongs to the renter. They still had the car, so the ticket is theirs.",
  },
  {
    title: "Cancelled bookings are ignored",
    body: "A cancelled booking never counts as someone having the car, even if its dates cover the ticket.",
  },
  {
    title: "A gap is the operator's",
    body: "If no booking covers the ticket time, nobody had the car on record. The ticket is the operator's and the renter must not be charged. Check staff or personal use before paying.",
  },
  {
    title: "Close to a handoff means review",
    body: "A ticket within 60 minutes of a pickup or return is too close to call, so it is flagged for review instead of being decided automatically. Overlapping bookings are flagged the same way.",
  },
  {
    title: "Unknown plates are reported",
    body: "If the plate is not in the fleet, the ticket is marked as not in the fleet. Check the plate, or whether the car was sold or replaced.",
  },
  {
    title: "Plates match loosely",
    body: "Case, spaces and dashes are ignored, so “ev 3001” matches “EV-3001”.",
  },
];

const NOTES: string[] = [
  "When a renter is charged, a $25 admin fee is added to the fine.",
  "Payments are mocked: charging a renter only records the outcome, and the message to the renter is a draft.",
  "The deadline is read from each notice and never hard-coded, because the rules and response times vary by city.",
];

export default function HowItWorks() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
      <p className="mt-3 text-lg leading-relaxed text-slate-600">
        A parking or camera ticket is sent to the car&apos;s owner: the rental operator. Weeks after the trip, the
        operator has to find out who had the car at that exact moment and respond before the deadline, or pay the
        fine themselves.
      </p>
      <p className="mt-3 leading-relaxed text-slate-600">
        Violation Desk decides with a few plain rules, not AI, so every decision can be checked by hand.
      </p>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">The rules</h2>
        <ol className="mt-4 space-y-5">
          {RULES.map((rule, i) => (
            <li key={rule.title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-600">
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{rule.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{rule.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Money and deadlines</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-600">
          {NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
