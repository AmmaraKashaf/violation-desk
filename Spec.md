# Spec: Violation Desk

A small tool for car rental operators (1Now-style). A parking or camera ticket arrives weeks after the trip, addressed to the car's owner (the operator). The operator must work out **who had the car at that exact moment** and respond **before a deadline**, or pay the fine themselves. Violation Desk reads the notice, finds the renter responsible, shows the evidence on a timeline, counts down the deadline, and tells the operator what to do.

**Stack:** Next.js (latest, App Router, TypeScript, Tailwind) + Python FastAPI + Supabase (Postgres).

**The one idea that makes it smart:** attribution uses the renter's **actual return time**, not the scheduled one. A ticket issued after the scheduled return but before the car actually came back belongs to the renter. A ticket in a gap where nobody had the car belongs to the operator, so the renter must **not** be charged.

---

## 0. Working agreement for Claude Code (read first)

- **Plan first, then build in small steps.** Show me a short plan, then follow the build order in section 10.
- **Commit after each step** with a clear message (e.g. `feat(api): add ticket attribution logic`). Keep the history readable.
- **Readable and easy to change beats clever.** I will walk through this code live and may edit it during a demo.
  - Small functions, one job each. Descriptive names. Type hints everywhere in Python, types everywhere in TypeScript.
  - Short comments explaining *why*, not *what*.
  - No ORMs, no repository or service-layer abstractions, no state-management libraries, no chart libraries, no extra dependencies unless truly needed.
  - Keep each file short (aim for under ~150 lines). Prefer a flat structure.
- **Rules decide, not AI.** Attribution is plain, deterministic Python, because money and legal exposure ride on it and the operator must be able to audit it. Do **not** call any AI or LLM API anywhere (see the stretch section at the end).
- **Don't overthink the logic.** Implement exactly what is written below. If something is ambiguous, pick the simplest option and note it in the README.
- **Ship the feature only.** No auth, no users, no real payments, no emails or SMS, no infra, no Docker. Plain REST APIs plus a simple frontend.
- **Guards where needed** (section 7), but nothing beyond that.
- **Never invent secrets.** When you need an env value, stop and ask me. Never commit `.env`. Provide `.env.example` files.

---

## 1. Repo structure

```
/
├── README.md                  # how to run, demo script, what was left out and why
├── supabase/
│   └── schema.sql             # tables; I paste this into the Supabase SQL editor
├── backend/
│   ├── requirements.txt       # must include tzdata (Windows has no timezone database)
│   ├── .env.example
│   ├── app/
│   │   ├── main.py            # FastAPI app, CORS, router include
│   │   ├── config.py          # env + business constants
│   │   ├── db.py              # Supabase client
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── parsing.py         # parse_notice(): pure function, no DB
│   │   ├── attribution.py     # attribute(): pure function, no DB
│   │   ├── routes.py          # all endpoints
│   │   ├── samples.py         # sample notice texts, built relative to today
│   │   └── seed.py            # reset + seed demo data (also callable from API)
│   └── tests/
│       ├── test_attribution.py
│       └── test_parsing.py
└── frontend/
    ├── .env.example
    └── app/
        ├── page.tsx           # single page
        ├── lib/api.ts         # fetch helpers + types
        └── components/
            ├── NoticeForm.tsx     # paste text, sample chips, editable extracted fields
            ├── DecisionCard.tsx   # result, evidence, deadline, actions
            ├── Timeline.tsx       # per-vehicle timeline with ticket pins
            └── Inbox.tsx          # saved violations sorted by deadline
```

---

## 2. Constants (named constants in `config.py`)

| Constant | Value | Meaning |
|---|---|---|
| `OPERATOR_TIMEZONE` | `"America/New_York"` | Notice times are local to the operator's city. Convert to UTC for storage and comparison |
| `ADMIN_FEE` | `25.00` | Added to the fine when charging a renter |
| `HANDOFF_MARGIN_MINUTES` | `60` | A ticket this close to a booking's start or end is too close to call |
| `URGENT_DAYS` | `5` | Deadline at or below this many days is shown as urgent |
| `MAX_NOTICE_CHARS` | `5000` | Longest notice text accepted |
| `MAX_FINE` | `10000` | Largest fine accepted |

Store all datetimes as UTC (`timestamptz`). Use Python's `zoneinfo`.

---

## 3. Notice parsing (`parsing.py`)

One pure function: `parse_notice(text: str) -> ParsedNotice`. No AI. It reads `Label: value` lines.

Fields to extract:

| Field | Accepted labels (case-insensitive) | Format |
|---|---|---|
| `plate` | plate, license plate, vehicle plate, tag | text |
| `violation` | violation, offence, offense, infraction | text |
| `occurred_local` | date/time, date and time, offence date, violation date | `YYYY-MM-DD HH:MM` (local time) |
| `location` | location, place | text (optional, default `"Unknown"`) |
| `amount` | fine, amount due, penalty, amount | number; ignore `$` and commas |
| `notice_date` | notice date, date of notice, issued | `YYYY-MM-DD` |
| `respond_by` | respond by, pay by, due date | `YYYY-MM-DD` |

If the notice has `Respond within: N days` instead of `Respond by`, compute `respond_by = notice_date + N days`.

Keep the label aliases in one small dictionary at the top of the file so they are easy to edit live. If a required field is missing, return which ones (do not guess). The frontend then lets the operator fill them in by hand.

---

## 4. Attribution logic (`attribution.py`)

One pure function:

```python
def attribute(occurred_at: datetime, bookings: list[Booking]) -> Attribution: ...
```

`bookings` are all bookings for the matched vehicle. Logic:

1. **Ignore cancelled bookings.**
2. Each remaining booking has a window from `start_at` to `actual_return_at`, or to `end_at` if the car has not been returned yet. Both ends are inclusive.
3. **Exactly one window contains the time** → `renter_liable`.
   - Set `late_return = true` if `occurred_at > end_at` (after the scheduled return, but before the actual return).
4. **More than one window contains it** → `needs_review` (bookings overlap, which is a data problem).
5. **No window contains it:**
   - If the time is within `HANDOFF_MARGIN_MINUTES` of any booking's window start or end → `needs_review` (too close to a handoff to call).
   - Otherwise → `operator_liable`. Nobody had the car on record. The renter must not be charged. Suggest checking staff or personal use first.

Before calling this, the route looks up the vehicle by plate. If no vehicle matches → decision `no_vehicle` (skip `attribute`).

**Plate matching ignores case, spaces and dashes** (`ev 3001` matches `EV-3001`).

Result fields:

```
decision:     "renter_liable" | "operator_liable" | "needs_review" | "no_vehicle"
reason:       str     # plain English, shown in the UI, mentions names and times
booking_id:   str|null
renter_name:  str|null
late_return:  bool
```

Example reasons:
- renter_liable: `"Sara Lindqvist had the car (Sep 24 10:00 → Sep 28 13:20)."`
- renter_liable, late: `"Sara Lindqvist was late: the trip was due back at 10:00 but the car actually came back at 13:20. The ticket (11:47) falls in that gap, so she is responsible."`
- operator_liable: `"No booking covers this time (the car was between rentals). Do not charge a renter. Check staff or personal use before paying."`
- needs_review: `"This is 35 minutes after one trip ended and 20 minutes before the next began. Check the handoff before deciding."`
- no_vehicle: `"This plate is not in your fleet. Check the plate, or whether the car was sold or replaced."`

---

## 5. Database (Supabase / Postgres)

The Supabase project may already contain tables from another project, so **every table here is prefixed `vd_`**. `schema.sql` must only ever touch `vd_` tables (use `drop table if exists vd_...` for those names only). No RLS policies needed; the backend uses the secret key. Enabling RLS with no policies is fine.

**vd_vehicles**
- `id` uuid PK default `gen_random_uuid()`
- `name` text not null
- `plate` text not null

**vd_bookings**
- `id` uuid PK default `gen_random_uuid()`
- `vehicle_id` uuid not null references vd_vehicles(id) on delete cascade
- `renter_name` text not null
- `start_at` timestamptz not null
- `end_at` timestamptz not null (scheduled return)
- `actual_return_at` timestamptz null
- `status` text not null check in ('upcoming','active','completed','cancelled')
- check (`end_at` > `start_at`)

**vd_violations**
- `id` uuid PK default `gen_random_uuid()`
- `vehicle_id` uuid null references vd_vehicles(id) on delete set null
- `plate` text not null
- `violation` text not null
- `occurred_at` timestamptz not null
- `location` text not null default 'Unknown'
- `amount` numeric(10,2) not null
- `notice_date` date not null
- `respond_by` date not null
- `raw_text` text null
- `decision` text not null check in ('renter_liable','operator_liable','needs_review','no_vehicle')
- `reason` text not null
- `booking_id` uuid null references vd_bookings(id) on delete set null
- `late_return` boolean not null default false
- `status` text not null default 'open' check in ('open','charged_renter','paid_by_operator','dismissed')
- `created_at` timestamptz not null default now()
- unique (`plate`, `occurred_at`, `amount`)

Add an index on `vd_bookings(vehicle_id, start_at)`.

---

## 6. API (FastAPI)

All JSON. CORS allows the frontend origin only.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/samples` | Sample notice texts with labels, dates built relative to today |
| POST | `/notices/parse` | Body `{ "text": str }`. Read-only. Returns the extracted fields, or `422` listing the missing ones |
| POST | `/violations` | Body: the confirmed fields. Converts the local time to UTC, finds the vehicle, runs attribution, saves, returns the violation |
| GET | `/violations` | All violations, soonest deadline first |
| POST | `/violations/{id}/resolve` | Body `{ "action": "charge_renter" \| "operator_pays" \| "dismiss" }`. Updates status. **Payments are mocked** |
| GET | `/vehicles` | Each vehicle with its bookings (ordered by `start_at`), for the timeline |
| POST | `/demo/reset` | Wipes violations, bookings and vehicles, then re-seeds |

Every violation response also includes these computed fields:
- `days_left`: `respond_by` minus today (negative if overdue)
- `charge_total`: `amount + ADMIN_FEE` when `renter_liable`, otherwise `null`
- `message_draft`: a short, polite text to the renter when `renter_liable`, otherwise `null` (a plain template string in `routes.py`, no AI)
- `renter_name`, `vehicle_name`

---

## 7. Guards (only these)

- Notice text empty or longer than `MAX_NOTICE_CHARS` → `422`.
- Parse is missing required fields → `422` listing them.
- `amount` must be above 0 and at most `MAX_FINE` → `422`.
- `occurred_at` must not be in the future → `422`.
- `notice_date` must not be before the violation date, and `respond_by` must not be before `notice_date` → `422`.
- Same plate, time and amount already saved → `409` ("already logged").
- Resolve: violation not found → `404`; already resolved → `409`; `charge_renter` is only allowed when the decision is `renter_liable` → `409` with a clear message (the renter must never be charged for an operator-liable or unclear ticket).
- Supabase or DB errors → a clean `502` JSON error, not a stack trace.
- Frontend: disable buttons while a request is in flight; show API errors in plain text.

---

## 8. Seed data and samples

Seed relative to "today" so the demo never goes stale. Let **D = today at 00:00 in `OPERATOR_TIMEZONE`**. All times below are local; store as UTC. `reset` deletes violations, then bookings, then vehicles, then inserts.

**Vehicles:** Tesla Model 3 (`EV-3001`), Jeep Wrangler (`JP-4410`), Toyota RAV4 (`RV-7520`).

**Bookings**

| Vehicle | Renter | Scheduled | Actual return | Status |
|---|---|---|---|---|
| Tesla | Sara Lindqvist | D-12 10:00 → D-8 10:00 | D-8 13:20 | completed |
| Tesla | Leo Fischer | D-7 00:00 → D-6 09:00 | none | **cancelled** |
| Tesla | Omar Haddad | D-6 10:00 → D-3 10:00 | D-3 09:40 | completed |
| Tesla | Priya Shah | D-2 10:00 → D+2 10:00 | none | active |
| Jeep | Ben Carter | D-9 10:00 → D-5 10:00 | D-5 10:05 | completed |
| Jeep | Mia Rossi | D-5 11:00 → D-1 11:00 | D-1 10:50 | completed |
| RAV4 | Chloe Nguyen | D-3 10:00 → D+1 10:00 | none | active |

**Sample notices** (`GET /samples`), one chip each in the UI. Use the plain `Label: value` layout. Sample 4 uses different label wording (`Vehicle plate`, `Offence date`, `Penalty`) to show the alias handling. Choose `Notice date` and `Respond by` values so the deadline countdown shows one urgent (red), one soon (amber) and the rest ok.

| # | Plate | Violation | Local time | Fine | Expected result |
|---|---|---|---|---|---|
| 1 | EV-3001 | Parking | D-10 14:12 | $65 | **renter_liable**, Sara |
| 2 | EV-3001 | Red light camera | D-8 11:47 | $150 | **renter_liable**, Sara, `late_return` (due 10:00, back 13:20) |
| 3 | EV-3001 | Parking | D-7 02:15 | $45 | **operator_liable** (the cancelled Leo Fischer booking must be ignored) |
| 4 | ZZ-9999 | Speed camera | D-4 16:30 | $95 | **no_vehicle** |
| 5 | JP-4410 | Parking | D-5 10:40 | $55 | **needs_review** (35 min after Ben, 20 min before Mia) |

---

## 9. Frontend (Next.js, single page)

Keep it plain: one page, Tailwind, `"use client"` components, `fetch` only. No UI library, no chart library. Make it look polished and calm: card layout, generous spacing, clear colour meaning.

**Colours:** renter_liable = green, operator_liable = red, needs_review = amber, no_vehicle = grey. Deadline: red when overdue or at or below `URGENT_DAYS`, amber at 14 days or fewer, otherwise green.

**Page (`/`)**
- Title "Violation Desk", a one-line subtitle, and a "Reset demo data" button.
- **NoticeForm:** a textarea to paste a notice, "Try a sample" chips (from `/samples`), and a **Read notice** button. After parsing, show the extracted fields in an **editable** form (so the operator can fix anything), then a **Check who had the car** button, which saves the violation.
- **DecisionCard** (shown after saving): decision badge, the reason, the evidence line (renter, scheduled vs actual window), the deadline countdown, and the charge breakdown (fine + admin fee = total) when the renter is liable. Actions: **Charge renter** (only enabled when renter_liable; shows the drafted message), **I'll pay it**, **Dismiss**.
- **Timeline** (the hero visual): for the matched vehicle, a horizontal bar over the last 14 days. Each booking is a bar. Show cancelled bookings as faded and hatched. Show late time (actual return after scheduled return) as a differently coloured extension of the bar. Show ticket pins at the violation time. Pure CSS or SVG.
- **Inbox:** saved violations sorted by deadline (soonest first), each with its decision badge, fine and days-left. Clicking one shows it in the DecisionCard and Timeline.

`lib/api.ts` holds the base URL (`NEXT_PUBLIC_API_URL`), TypeScript types matching the API, and one small function per endpoint. Display times in the browser's local time and say so in a small footnote ("times shown in your local time").

---

## 10. Build order

1. Scaffold `backend/` and `frontend/`, add `.env.example` files, and **ask me for the env values** (section 11).
2. Write `supabase/schema.sql` and tell me when to run it.
3. `config.py`, `db.py`, `schemas.py`.
4. `parsing.py` with `tests/test_parsing.py`. Run the tests.
5. `attribution.py` with `tests/test_attribution.py`. Run the tests.
6. `seed.py` and `samples.py`. Run the seed and verify the data in Supabase.
7. `routes.py` + `main.py`. Test each endpoint with curl against the five samples in section 8.
8. Frontend: `api.ts`, then `NoticeForm`, `DecisionCard`, `Timeline`, `Inbox`, then `page.tsx`.
9. Walk through all five samples end to end in the browser.
10. Write `README.md`.

**Unit tests (pytest, short and readable):**
- Parsing: both label styles parse correctly; a missing field is reported; `Respond within N days` computes `respond_by`.
- Attribution: clean match → renter_liable; ticket after scheduled return but before actual return → renter_liable with `late_return`; gap → operator_liable; a cancelled booking covering the time is ignored; near a handoff → needs_review; plate matching ignores case, spaces and dashes.

---

## 11. Environment variables

Ask me for these before using them:

- `backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (holds my `sb_secret_...` key), `FRONTEND_ORIGIN` (default `http://localhost:3000`)
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000`)

The secret key stays on the backend only and is never exposed to the frontend.

---

## 12. Definition of done

- `uvicorn app.main:app --reload` and `npm run dev` start cleanly.
- All five samples behave as listed in section 8, in the browser.
- The late-return case (sample 2) is clearly explained, and the timeline shows the pin inside the late extension of Sara's bar.
- Sample 3 shows operator-liable, and **Charge renter is blocked** (disabled in the UI and `409` from the API).
- Cancelled bookings never count as the person who had the car.
- Unit tests pass.
- README includes setup steps, a demo script, a note that this is based on 1Now's public pages (which mention tolls but not tickets), and a **"What I left out and why"** section: auth, real payments, real notice formats and photo or OCR reading, jurisdiction-specific legal rules and sworn-statement forms (the deadline is read from each notice, never hard-coded), bookings edited after the fact, daylight-saving edge cases, operators in several timezones, manual override for `needs_review`, and notifying the renter.

---

## 13. Stretch (do NOT build unless I ask)

Reading messy notices with an AI model, for layouts the rule-based parser cannot read. Do not add any AI API, key or dependency unless I explicitly ask in a later message.
