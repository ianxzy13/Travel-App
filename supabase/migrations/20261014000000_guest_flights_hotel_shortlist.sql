-- =============================================================
-- Vow – guest flight form + hotel shortlist (October 2026)
--
-- 1. Guests share their flights on the wedding website. Each arrival and
--    departure they share appears on the couple's flight board by itself
--    (flights rows linked to guest_travel). The couple decides who gets an
--    airport shuttle (flights.needs_pickup); the guest's own wish is kept
--    separately (flights.pickup_requested).
-- 2. Hotels the couple is comparing: a "shortlisted" heart, a photo, stars
--    and a review score, so they can be compared side by side.
--
-- Run after the earlier migrations (Supabase → SQL Editor). Safe to run
-- more than once.
-- =============================================================

-- ---------- guest_travel: where guests fly from / to ----------

alter table public.guest_travel
  add column if not exists arrival_from text check (char_length(arrival_from) <= 60),
  add column if not exists departure_to text check (char_length(departure_to) <= 60);

-- ---------- flights: link to what a guest shared ----------

alter table public.flights
  add column if not exists guest_travel_id uuid references public.guest_travel (id) on delete cascade,
  add column if not exists pickup_requested boolean not null default false;

create unique index if not exists flights_guest_travel_dir_idx
  on public.flights (guest_travel_id, direction)
  where guest_travel_id is not null;

-- ---------- keep the flight board in step with guest_travel ----------

-- Who is on a household's flights: everyone who said yes to something,
-- or the whole household while nobody has answered yet.
create or replace function public.household_travellers(p_household_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with members as (
    select g.id from public.guests g where g.household_id = p_household_id
  ),
  coming as (
    select distinct r.guest_id as id
    from public.rsvp_responses r
    where r.guest_id in (select id from members) and r.status = 'attending'
  )
  select id from coming
  union all
  select id from members where not exists (select 1 from coming);
$$;

create or replace function public.sync_guest_flights(p_travel_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gt public.guest_travel%rowtype;
  fid uuid;
  dir public.flight_direction;
  has_info boolean;
begin
  select * into gt from public.guest_travel where id = p_travel_id;
  if not found then
    return;
  end if;

  foreach dir in array array['arrival', 'departure']::public.flight_direction[] loop
    if dir = 'arrival' then
      has_info := gt.arrival_date is not null or gt.arrival_flight is not null;
    else
      has_info := gt.departure_date is not null or gt.departure_flight is not null;
    end if;

    if not has_info then
      delete from public.flights where guest_travel_id = gt.id and direction = dir;
      continue;
    end if;

    select id into fid from public.flights where guest_travel_id = gt.id and direction = dir;

    if fid is null then
      insert into public.flights (wedding_id, guest_travel_id, category, direction, status)
      values (gt.wedding_id, gt.id, 'guest', dir, 'booked')
      returning id into fid;
    end if;

    -- needs_pickup is the couple's decision, so it is never touched here
    if dir = 'arrival' then
      update public.flights set
        flight_number = upper(replace(gt.arrival_flight, ' ', '')),
        from_airport = upper(gt.arrival_from),
        to_airport = upper(gt.arrival_airport),
        depart_at = null,
        arrive_at = gt.arrival_date + coalesce(gt.arrival_time, '00:00'::time),
        pickup_requested = gt.needs_transfer,
        notes = gt.transport_notes
      where id = fid;
    else
      update public.flights set
        flight_number = upper(replace(gt.departure_flight, ' ', '')),
        from_airport = upper(gt.departure_airport),
        to_airport = upper(gt.departure_to),
        depart_at = gt.departure_date + coalesce(gt.departure_time, '00:00'::time),
        arrive_at = null,
        pickup_requested = gt.needs_transfer,
        notes = gt.transport_notes
      where id = fid;
    end if;

    delete from public.flight_travellers where flight_id = fid;
    insert into public.flight_travellers (flight_id, guest_id, wedding_id)
    select fid, t.id, gt.wedding_id from public.household_travellers(gt.household_id) as t(id);
  end loop;
end;
$$;

create or replace function public.guest_travel_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_guest_flights(new.id);
  return new;
end;
$$;

drop trigger if exists guest_travel_sync_flights on public.guest_travel;
create trigger guest_travel_sync_flights
  after insert or update on public.guest_travel
  for each row execute function public.guest_travel_sync_trigger();

revoke execute on function public.household_travellers(uuid) from public, anon, authenticated;
revoke execute on function public.sync_guest_flights(uuid) from public, anon, authenticated;
revoke execute on function public.guest_travel_sync_trigger() from public, anon, authenticated;

-- Put what guests already shared on the board.
do $$
declare
  r record;
begin
  for r in select id from public.guest_travel loop
    perform public.sync_guest_flights(r.id);
  end loop;
end;
$$;

-- When guest data is anonymised, forget where guests flew from too.
create or replace function public.weddings_anonymise_flights()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.guest_travel set arrival_from = null, departure_to = null
    where wedding_id = new.id;
  update public.flights set notes = null
    where wedding_id = new.id and guest_travel_id is not null;
  return new;
end;
$$;

drop trigger if exists weddings_anonymise_flights on public.weddings;
create trigger weddings_anonymise_flights
  after update of anonymised_at on public.weddings
  for each row when (old.anonymised_at is null and new.anonymised_at is not null)
  execute function public.weddings_anonymise_flights();

revoke execute on function public.weddings_anonymise_flights() from public, anon, authenticated;

-- ---------- website flight form ----------

-- The basics the flight form page needs (null when the form is switched off).
create or replace function public.get_flight_form(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', w.slug,
    'partner_a_name', w.partner_a_name,
    'partner_b_name', w.partner_b_name,
    'wedding_date', w.wedding_date,
    'location', w.location,
    'accent', w.accent,
    'languages', w.languages,
    'translations', w.translations,
    'destination_airport', w.destination_airport
  )
  from public.weddings w
  where w.slug = lower(trim(p_slug)) and w.rsvp_ask_travel = true;
$$;

-- One household's flights, by RSVP code, for the website form.
create or replace function public.get_guest_flights(p_slug text, p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h public.households%rowtype;
begin
  select ho.* into h
  from public.households ho
  join public.weddings w on w.id = ho.wedding_id
  where ho.rsvp_code = upper(trim(p_code))
    and w.slug = lower(trim(p_slug))
    and w.rsvp_ask_travel = true;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'household', jsonb_build_object('name', h.name, 'code', h.rsvp_code),
    'travel', (
      select jsonb_build_object(
        'arrival_from', t.arrival_from,
        'arrival_airport', t.arrival_airport,
        'arrival_date', t.arrival_date,
        'arrival_time', t.arrival_time,
        'arrival_flight', t.arrival_flight,
        'departure_airport', t.departure_airport,
        'departure_to', t.departure_to,
        'departure_date', t.departure_date,
        'departure_time', t.departure_time,
        'departure_flight', t.departure_flight,
        'needs_transfer', t.needs_transfer,
        'transport_notes', t.transport_notes
      )
      from public.guest_travel t where t.household_id = h.id
    )
  );
end;
$$;

-- Save one household's flights from the website form. Leaves the RSVP-only
-- fields (where they stay) alone.
create or replace function public.submit_guest_flights(p_slug text, p_code text, p_payload jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.households%rowtype;
  clean jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  select ho.* into h
  from public.households ho
  join public.weddings w on w.id = ho.wedding_id
  where ho.rsvp_code = upper(trim(p_code))
    and w.slug = lower(trim(p_slug))
    and w.rsvp_ask_travel = true;
  if not found then
    raise exception 'rsvp_not_found';
  end if;

  insert into public.guest_travel (
    wedding_id, household_id,
    arrival_from, arrival_airport, arrival_date, arrival_time, arrival_flight,
    departure_airport, departure_to, departure_date, departure_time, departure_flight,
    needs_transfer, transport_notes
  ) values (
    h.wedding_id, h.id,
    nullif(left(trim(coalesce(clean ->> 'arrival_from', '')), 60), ''),
    nullif(left(trim(coalesce(clean ->> 'arrival_airport', '')), 10), ''),
    nullif(clean ->> 'arrival_date', '')::date,
    nullif(clean ->> 'arrival_time', '')::time,
    nullif(left(trim(coalesce(clean ->> 'arrival_flight', '')), 20), ''),
    nullif(left(trim(coalesce(clean ->> 'departure_airport', '')), 10), ''),
    nullif(left(trim(coalesce(clean ->> 'departure_to', '')), 60), ''),
    nullif(clean ->> 'departure_date', '')::date,
    nullif(clean ->> 'departure_time', '')::time,
    nullif(left(trim(coalesce(clean ->> 'departure_flight', '')), 20), ''),
    coalesce((clean ->> 'needs_transfer')::boolean, false),
    nullif(left(trim(coalesce(clean ->> 'transport_notes', '')), 500), '')
  )
  on conflict (wedding_id, household_id) do update set
    arrival_from = excluded.arrival_from,
    arrival_airport = excluded.arrival_airport,
    arrival_date = excluded.arrival_date,
    arrival_time = excluded.arrival_time,
    arrival_flight = excluded.arrival_flight,
    departure_airport = excluded.departure_airport,
    departure_to = excluded.departure_to,
    departure_date = excluded.departure_date,
    departure_time = excluded.departure_time,
    departure_flight = excluded.departure_flight,
    needs_transfer = excluded.needs_transfer,
    transport_notes = excluded.transport_notes;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.get_flight_form(text) from public;
revoke execute on function public.get_guest_flights(text, text) from public;
revoke execute on function public.submit_guest_flights(text, text, jsonb) from public;
grant execute on function public.get_flight_form(text) to anon, authenticated;
grant execute on function public.get_guest_flights(text, text) to anon, authenticated;
grant execute on function public.submit_guest_flights(text, text, jsonb) to anon, authenticated;

-- ---------- hotels: shortlist for comparing ----------

alter table public.hotels
  add column if not exists shortlisted boolean not null default false,
  add column if not exists image_url text check (char_length(image_url) <= 1000),
  add column if not exists stars smallint check (stars between 1 and 5),
  add column if not exists review_score numeric(3, 1) check (review_score between 0 and 10);
