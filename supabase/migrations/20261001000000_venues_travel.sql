-- =============================================================
-- Vow – Phase 6: venues (+ site-visit checklists), hotels (+ room blocks,
-- guest assignments), flights (+ travellers)
-- Run after the phase 5 migration (Supabase → SQL Editor).
-- =============================================================

-- ---------- venues ----------

create type public.venue_kind as enum ('ceremony', 'reception', 'both');
create type public.venue_status as enum ('researching', 'contacted', 'visited', 'shortlisted', 'booked', 'rejected');
create type public.venue_availability as enum ('unknown', 'available', 'tentative', 'unavailable');

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  kind public.venue_kind not null default 'both',
  status public.venue_status not null default 'researching',
  availability public.venue_availability not null default 'unknown',
  address text check (char_length(address) <= 300),
  contact_name text check (char_length(contact_name) <= 120),
  phone text check (char_length(phone) <= 50),
  email text check (char_length(email) <= 320),
  website text check (char_length(website) <= 300),
  capacity integer check (capacity between 0 and 100000),
  price numeric(12, 2) check (price >= 0),
  included text check (char_length(included) <= 2000),
  pros text check (char_length(pros) <= 2000),
  cons text check (char_length(cons) <= 2000),
  notes text check (char_length(notes) <= 4000),
  rating smallint check (rating between 1 and 5),
  visit_date date,
  -- files in the "wedding-files" bucket: <wedding_id>/venues/...
  photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index venues_wedding_idx on public.venues (wedding_id);

create table public.venue_checklist_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  venue_id uuid not null,
  question text not null check (char_length(question) between 1 and 200),
  answer text check (char_length(answer) <= 1000),
  done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (venue_id, wedding_id) references public.venues (id, wedding_id) on delete cascade
);
create index venue_checklist_venue_idx on public.venue_checklist_items (venue_id, sort_order);

-- ---------- hotels & room blocks ----------

create type public.hotel_status as enum ('considering', 'contacted', 'block_confirmed', 'rejected');

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  status public.hotel_status not null default 'considering',
  address text check (char_length(address) <= 300),
  distance text check (char_length(distance) <= 100),
  website text check (char_length(website) <= 300),
  booking_url text check (char_length(booking_url) <= 500),
  price_per_night numeric(12, 2) check (price_per_night >= 0),
  rooms_held integer check (rooms_held between 0 and 10000),
  rooms_booked integer check (rooms_booked between 0 and 10000),
  discount_code text check (char_length(discount_code) <= 100),
  cutoff_date date,
  show_on_website boolean not null default false,
  -- where the couple themselves are staying
  for_couple boolean not null default false,
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index hotels_wedding_idx on public.hotels (wedding_id);

create table public.hotel_guest_assignments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  hotel_id uuid not null,
  guest_id uuid not null,
  room text check (char_length(room) <= 60),
  check_in date,
  check_out date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a guest stays in one hotel
  unique (guest_id),
  check (check_out is null or check_in is null or check_out >= check_in),
  foreign key (hotel_id, wedding_id) references public.hotels (id, wedding_id) on delete cascade,
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade
);
create index hotel_guests_hotel_idx on public.hotel_guest_assignments (hotel_id);

-- ---------- flights ----------

create type public.flight_category as enum ('guest', 'couple', 'honeymoon');
create type public.flight_direction as enum ('arrival', 'departure', 'other');
create type public.flight_status as enum ('considering', 'booked');

create table public.flights (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  category public.flight_category not null default 'guest',
  direction public.flight_direction not null default 'arrival',
  status public.flight_status not null default 'booked',
  airline text check (char_length(airline) <= 80),
  flight_number text check (char_length(flight_number) <= 20),
  from_airport text check (char_length(from_airport) <= 60),
  to_airport text check (char_length(to_airport) <= 60),
  -- local times at each airport (no time zone on purpose: that's how tickets show them)
  depart_at timestamp,
  arrive_at timestamp,
  booking_ref text check (char_length(booking_ref) <= 40),
  price numeric(12, 2) check (price >= 0),
  baggage text check (char_length(baggage) <= 300),
  -- travellers who aren't on the guest list (e.g. the couple)
  other_travellers text check (char_length(other_travellers) <= 300),
  needs_pickup boolean not null default false,
  notes text check (char_length(notes) <= 2000),
  -- reserved for a future flight search/booking integration (e.g. Amadeus, Duffel)
  provider text check (char_length(provider) <= 40),
  provider_ref text check (char_length(provider_ref) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id),
  check (arrive_at is null or depart_at is null or arrive_at >= depart_at - interval '1 day')
);
create index flights_wedding_idx on public.flights (wedding_id, arrive_at);

create table public.flight_travellers (
  flight_id uuid not null,
  guest_id uuid not null,
  wedding_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (flight_id, guest_id),
  foreign key (flight_id, wedding_id) references public.flights (id, wedding_id) on delete cascade,
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade
);
create index flight_travellers_guest_idx on public.flight_travellers (guest_id);

-- Nearest airport for "search flights" shortcuts (e.g. LIS).
alter table public.weddings
  add column destination_airport text check (char_length(destination_airport) <= 10);

-- ---------- updated_at + RLS ----------
do $$
declare
  t text;
begin
  foreach t in array array[
    'venues', 'venue_checklist_items', 'hotels', 'hotel_guest_assignments', 'flights', 'flight_travellers'
  ] loop
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s_select" on public.%1$I for select to authenticated
         using (public.is_wedding_member(wedding_id))', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$I for insert to authenticated
         with check (public.can_edit_wedding(wedding_id))', t);
    execute format(
      'create policy "%1$s_update" on public.%1$I for update to authenticated
         using (public.can_edit_wedding(wedding_id))
         with check (public.can_edit_wedding(wedding_id))', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$I for delete to authenticated
         using (public.can_edit_wedding(wedding_id))', t);
  end loop;
end;
$$;
