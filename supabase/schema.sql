-- Violation Desk schema.
-- Only touches vd_ tables: the Supabase project may hold tables from other projects.
-- Safe to re-run: drops and recreates the vd_ tables (this deletes their data).

drop table if exists vd_violations;
drop table if exists vd_bookings;
drop table if exists vd_vehicles;

create table vd_vehicles (
  id    uuid primary key default gen_random_uuid(),
  name  text not null,
  plate text not null
);

create table vd_bookings (
  id               uuid primary key default gen_random_uuid(),
  vehicle_id       uuid not null references vd_vehicles(id) on delete cascade,
  renter_name      text not null,
  start_at         timestamptz not null,
  end_at           timestamptz not null,  -- scheduled return
  actual_return_at timestamptz null,      -- null until the car comes back
  status           text not null check (status in ('upcoming', 'active', 'completed', 'cancelled')),
  check (end_at > start_at)
);

create index vd_bookings_vehicle_start_idx on vd_bookings (vehicle_id, start_at);

create table vd_violations (
  id          uuid primary key default gen_random_uuid(),
  vehicle_id  uuid null references vd_vehicles(id) on delete set null,
  plate       text not null,
  violation   text not null,
  occurred_at timestamptz not null,
  location    text not null default 'Unknown',
  amount      numeric(10, 2) not null,
  notice_date date not null,
  respond_by  date not null,
  raw_text    text null,
  decision    text not null check (decision in ('renter_liable', 'operator_liable', 'needs_review', 'no_vehicle')),
  reason      text not null,
  booking_id  uuid null references vd_bookings(id) on delete set null,
  late_return boolean not null default false,
  status      text not null default 'open'
              check (status in ('open', 'charged_renter', 'paid_by_operator', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (plate, occurred_at, amount)
);

-- RLS on with no policies: only the backend (secret key) can read or write.
alter table vd_vehicles   enable row level security;
alter table vd_bookings   enable row level security;
alter table vd_violations enable row level security;
