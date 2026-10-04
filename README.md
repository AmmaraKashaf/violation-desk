# Violation Desk

A parking or camera ticket arrives weeks after a trip, addressed to the car's owner: the rental operator. The operator has to work out **who had the car at that exact moment** and respond **before a deadline**, or pay the fine themselves.

Violation Desk reads the notice and finds the renter responsible. It shows the evidence on a timeline, counts down the deadline, and tells the operator what to do.

**The one idea:** attribution uses the renter's **actual return time**, not the scheduled one.

- A ticket issued after the scheduled return but before the car actually came back belongs to the renter.
- A ticket in a gap where nobody had the car belongs to the operator, so no renter is charged.

The decision is made by plain, deterministic Python ([attribution.py](backend/app/attribution.py)), not AI. Money and legal exposure ride on it, so the operator must be able to audit every step.

This is based on 1Now's public pages, which mention toll handling but not parking or camera tickets. Tickets felt like the natural neighbouring problem.

**Stack:** Next.js 16 (App Router, TypeScript, Tailwind) · FastAPI · Supabase (Postgres).

---

## Setup (Windows / PowerShell)

You need Python 3.12+ (tested on 3.14), Node 20+ (tested on 24) and a Supabase project.

### 1. Database

Open the Supabase SQL editor, paste [supabase/schema.sql](supabase/schema.sql) and run it. It only creates or drops the `vd_vehicles`, `vd_bookings` and `vd_violations` tables, so other tables in the project are untouched.

### 2. Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env   # then fill in the values
python -m app.seed            # load the demo vehicles and bookings
uvicorn app.main:app --reload
```

`backend/.env`:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase **secret key** (`sb_secret_...`). Supabase renamed the service-role key; the env name is kept. Backend only. |
| `FRONTEND_ORIGIN` | `http://localhost:3000` (the only origin CORS allows) |

`requirements.txt` includes `tzdata`, because Windows has no built-in timezone database for `zoneinfo`.

### 3. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open <http://localhost:3000>.

### Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

The tests cover parsing (both label styles, a missing field, `Respond within N days`) and attribution (clean match, late return, gap, cancelled booking ignored, handoff margin, overlap, plate normalisation). Both modules are pure functions, so the tests need no database.

---

## Demo script (about 5 minutes)

All seed data and sample dates are relative to **today** (D = today 00:00 in New York), so the demo never goes stale. Start with **Reset demo data**.

| # | Chip | What to say | Expected |
|---|---|---|---|
| 1 | **Parking ticket** | Click **Read notice**. The fields are editable, so the operator can fix anything. Then click **Check who had the car**. | 🟢 **Renter liable**, Sara Lindqvist. Fine $65 + $25 admin fee = **$90**. Deadline in 3 days (red). |
| 2 | **Red light camera** | *The key case.* Sara's trip was due back at 10:00, but she returned the car at 13:20. The ticket is at 11:47. Click **Ticket day** on the timeline: the pin sits inside the orange late extension of Sara's bar. | 🟢 **Renter liable · late return**. Deadline in 10 days (amber). Click **Charge renter** to see the drafted message (payment is mocked). |
| 3 | **Overnight parking** | Leo Fischer's booking covers this time, but it was **cancelled**, so it is ignored. It shows faded and hatched on the timeline. Nobody had the car. | 🔴 **Operator liable**. **Charge renter is disabled**, and the API also refuses it with `409`. |
| 4 | **Speed camera (other wording)** | The notice uses different labels (`Vehicle plate`, `Offence date`, `Penalty`, `Respond within: 30 days`), and the parser still reads it. | ⚪ **Not in fleet** (ZZ-9999). |
| 5 | **Parking at handoff** | Ben returned the Jeep at 10:05 and Mia picked it up at 11:00. The ticket at 10:40 is too close to call. | 🟡 **Needs review**: "35 minutes after Ben Carter's trip ended and 20 minutes before Mia Rossi's trip began." |

Then show:

- **The inbox:** soonest deadline first. Click any item to reopen it.
- **The duplicate guard:** submit sample 1 again and you get "already logged".
- **The parser not guessing:** paste a notice without a plate. It lists the missing fields and highlights them for the operator to fill in.

---

## How attribution works

[attribution.py](backend/app/attribution.py), in order:

1. Ignore cancelled bookings.
2. Each booking's window runs from `start_at` to `actual_return_at`, or to `end_at` if the car isn't back yet. Both ends are inclusive.
3. If exactly one window contains the ticket time, the result is **renter_liable**. `late_return` is set if the time is after the scheduled `end_at`.
4. If more than one window contains it, the result is **needs_review** (overlapping bookings are a data problem).
5. If no window contains it and the time is within `HANDOFF_MARGIN_MINUTES` (60) of a pickup or return, the result is **needs_review**. Otherwise it is **operator_liable**.

Before step 1, the route looks the plate up in the fleet, ignoring case, spaces and dashes. An unknown plate gives **no_vehicle**.

The constants (`ADMIN_FEE`, `HANDOFF_MARGIN_MINUTES`, `URGENT_DAYS`, `OPERATOR_TIMEZONE`, limits) live in [config.py](backend/app/config.py). The parser's label aliases are one dictionary at the top of [parsing.py](backend/app/parsing.py).

## Choices I made where the spec was open

- **Unreadable values count as missing.** For example, `Date/Time: last Tuesday` is reported as missing rather than guessed. If a label appears twice, the first value wins.
- **The handoff margin only looks at bookings that are not cancelled.** A cancelled booking never affects the result in any way.
- **An early return shortens the window.** If the car came back early, a ticket after the actual return is not the renter's.
- **Two timezones on screen.** The reason text is written in the operator's time (New York), because that is what the notice says. Every other time on the page is in the viewer's local time, as the spec asks, and a small hint under the reason says so. `days_left` counts from today in the operator's timezone.
- **"Not in the future" is checked against the current time in the operator's timezone.**
- **`Respond within: N days` counts calendar days from the notice date.**
- **Stored plates.** A matched ticket stores the fleet's spelling of the plate. An unknown plate is stored uppercased as typed. The duplicate check (`409`) is the database's unique constraint on plate + time + amount.
- **Resolving tickets.** `needs_review` and `no_vehicle` tickets can only be paid by the operator or dismissed. Only `renter_liable` can be charged.
- **Timeline zoom.** I added a "Ticket day" zoom to the timeline. Over 14 days, a 3-hour late return is only a few pixels wide, and the late-return case is the point of the demo.
- **The renter message appears after Charge renter is clicked,** along with the charged total (mocked).

## What I left out and why

- **Auth and users.** Not needed to show the feature. The backend uses the Supabase secret key, and RLS is on with no policies, so the browser can never read the tables directly.
- **Real payments.** Charge renter only records the outcome (`charged_renter`). A real charge needs a payment provider and a dispute flow.
- **Real notice formats, photos and OCR.** The parser reads plain `Label: value` text. Real notices vary by city and often arrive as PDFs or photos. Reading those reliably is the stretch goal (an AI reader), and it would feed the same editable form. It would never make the decision.
- **Jurisdiction-specific legal rules and sworn-statement forms.** Transferring liability (for example, a nomination or affidavit) differs by city. The deadline is read from each notice, never hard-coded.
- **Bookings edited after the fact.** A violation stores its decision at the time it was logged. If a booking changes later, the old decision is not recalculated.
- **Daylight-saving edge cases.** Notice times are converted with `zoneinfo`. A local time that is ambiguous or doesn't exist (the DST change hour) isn't flagged, and the timeline's day ticks assume 24-hour days.
- **Operators in several timezones.** There is one `OPERATOR_TIMEZONE` constant. Supporting multiple cities would need a timezone per vehicle or per location.
- **Manual override for `needs_review`.** The operator can pay or dismiss, but cannot reassign the ticket to a renter. That needs an audit trail of who overrode what and why.
- **Notifying the renter.** The message is drafted from a plain template in [routes.py](backend/app/routes.py), not sent. There is no email or SMS.

## Project layout

```
supabase/schema.sql        vd_ tables only
backend/app/
  config.py                env + business constants
  db.py                    Supabase client
  schemas.py               Pydantic models + field guards (422)
  parsing.py               parse_notice(): pure
  attribution.py           attribute(): pure
  routes.py                endpoints
  samples.py / seed.py     date-relative demo data
  main.py                  app, CORS, clean 422/502 errors
backend/tests/             pytest
frontend/app/
  page.tsx                 single page
  lib/api.ts               types + one function per endpoint
  lib/display.ts           colours, labels, date formatting
  components/              NoticeForm, DecisionCard, Timeline, Inbox
```

### API

| Method | Path | |
|---|---|---|
| GET | `/health` | `{ "status": "ok" }` |
| GET | `/samples` | Sample notices, dated relative to today |
| POST | `/notices/parse` | `{ text }` → fields, or `422` with `missing` (and the partial fields) |
| POST | `/violations` | Confirmed fields → attribution → saved violation |
| GET | `/violations` | Soonest deadline first |
| POST | `/violations/{id}/resolve` | `{ action: charge_renter \| operator_pays \| dismiss }` (mocked) |
| GET | `/vehicles` | Vehicles with bookings, for the timeline |
| POST | `/demo/reset` | Wipe the `vd_` tables and re-seed |

Every violation response also includes `days_left`, `charge_total`, `message_draft`, `renter_name` and `vehicle_name`. Database failures return a clean `502` JSON error, never a stack trace.
