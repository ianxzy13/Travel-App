-- =============================================================
-- Vow – Phase 12: guest self-reported travel details
-- Guests share arrival/departure info after RSVPing "yes".
-- =============================================================

-- ---------- rsvp_ask_travel on weddings ----------

alter table public.weddings
  add column rsvp_ask_travel boolean not null default false;

-- ---------- guest_travel ----------

create table public.guest_travel (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  arrival_date date,
  arrival_time time,
  arrival_airport text check (char_length(arrival_airport) <= 10),
  arrival_flight text check (char_length(arrival_flight) <= 20),
  departure_date date,
  departure_time time,
  departure_airport text check (char_length(departure_airport) <= 10),
  departure_flight text check (char_length(departure_flight) <= 20),
  staying_at text check (char_length(staying_at) <= 200),
  hotel_id uuid references public.hotels (id) on delete set null,
  needs_transfer boolean not null default false,
  transport_notes text check (char_length(transport_notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, household_id)
);
create index guest_travel_wedding_idx on public.guest_travel (wedding_id);

-- ---------- updated_at + RLS ----------

do $$
declare
  t text;
begin
  foreach t in array array['guest_travel'] loop
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

-- ---------- get_rsvp: add rsvp_ask_travel + hotels ----------

-- Replace get_rsvp to include the travel flag and hotels for the RSVP page.
create or replace function public.get_rsvp(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h public.households%rowtype;
begin
  select * into h from public.households where rsvp_code = upper(trim(p_code));
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'wedding', (
      select jsonb_build_object(
        'id', w.id,
        'slug', w.slug,
        'partner_a_name', w.partner_a_name,
        'partner_b_name', w.partner_b_name,
        'wedding_date', w.wedding_date,
        'location', w.location,
        'accent', w.accent,
        'rsvp_deadline', w.rsvp_deadline,
        'rsvp_contact', w.rsvp_contact,
        'rsvp_ask_song', w.rsvp_ask_song,
        'rsvp_ask_travel', w.rsvp_ask_travel,
        'deadline_passed', w.rsvp_deadline is not null and current_date > w.rsvp_deadline,
        'destination_airport', w.destination_airport
      )
      from public.weddings w where w.id = h.wedding_id
    ),
    'household', jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'code', h.rsvp_code,
      'song_request', h.rsvp_song_request,
      'message', h.rsvp_message,
      'responded_at', h.rsvp_responded_at
    ),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'first_name', g.first_name,
        'last_name', g.last_name,
        'plus_one_of', g.plus_one_of,
        'age_group', g.age_group,
        'dietary', g.dietary
      ) order by g.plus_one_of is not null, g.created_at)
      from public.guests g where g.household_id = h.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'event_date', e.event_date,
        'start_time', e.start_time,
        'end_time', e.end_time,
        'venue_name', e.venue_name,
        'address', e.address,
        'dress_code', e.dress_code,
        'description', e.description,
        'meal_choice', e.meal_choice
      ) order by e.sort_order)
      from public.events e
      where exists (
        select 1 from public.guest_event_invites i
        join public.guests g on g.id = i.guest_id
        where i.event_id = e.id and g.household_id = h.id
      )
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('guest_id', i.guest_id, 'event_id', i.event_id))
      from public.guest_event_invites i
      join public.guests g on g.id = i.guest_id
      where g.household_id = h.id
    ), '[]'::jsonb),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guest_id', r.guest_id,
        'event_id', r.event_id,
        'status', r.status,
        'meal_option_id', r.meal_option_id
      ))
      from public.rsvp_responses r
      join public.guests g on g.id = r.guest_id
      where g.household_id = h.id
    ), '[]'::jsonb),
    'meal_options', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description)
        order by m.sort_order, m.created_at)
      from public.meal_options m where m.wedding_id = h.wedding_id
    ), '[]'::jsonb),
    'hotels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ht.id,
        'name', ht.name,
        'address', ht.address,
        'distance', ht.distance
      ) order by ht.created_at)
      from public.hotels ht
      where ht.wedding_id = h.wedding_id and ht.show_on_website = true
    ), '[]'::jsonb),
    'travel', (
      select jsonb_build_object(
        'arrival_date', gt.arrival_date,
        'arrival_time', gt.arrival_time,
        'arrival_airport', gt.arrival_airport,
        'arrival_flight', gt.arrival_flight,
        'departure_date', gt.departure_date,
        'departure_time', gt.departure_time,
        'departure_airport', gt.departure_airport,
        'departure_flight', gt.departure_flight,
        'staying_at', gt.staying_at,
        'hotel_id', gt.hotel_id,
        'needs_transfer', gt.needs_transfer,
        'transport_notes', gt.transport_notes
      )
      from public.guest_travel gt
      where gt.household_id = h.id
    )
  );
end;
$$;

-- ---------- submit_guest_travel ----------

create or replace function public.submit_guest_travel(
  p_code text,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.households%rowtype;
  w public.weddings%rowtype;
begin
  select * into h from public.households where rsvp_code = upper(trim(p_code));
  if not found then
    raise exception 'rsvp_not_found';
  end if;
  select * into w from public.weddings where id = h.wedding_id;

  if not w.rsvp_ask_travel then
    raise exception 'travel_not_enabled';
  end if;

  insert into public.guest_travel (
    wedding_id, household_id,
    arrival_date, arrival_time, arrival_airport, arrival_flight,
    departure_date, departure_time, departure_airport, departure_flight,
    staying_at, hotel_id, needs_transfer, transport_notes
  ) values (
    w.id, h.id,
    (p_payload ->> 'arrival_date')::date,
    (p_payload ->> 'arrival_time')::time,
    nullif(left(trim(coalesce(p_payload ->> 'arrival_airport', '')), 10), ''),
    nullif(left(trim(coalesce(p_payload ->> 'arrival_flight', '')), 20), ''),
    (p_payload ->> 'departure_date')::date,
    (p_payload ->> 'departure_time')::time,
    nullif(left(trim(coalesce(p_payload ->> 'departure_airport', '')), 10), ''),
    nullif(left(trim(coalesce(p_payload ->> 'departure_flight', '')), 20), ''),
    nullif(left(trim(coalesce(p_payload ->> 'staying_at', '')), 200), ''),
    case when (p_payload ->> 'hotel_id')::text is not null
         and exists (select 1 from public.hotels ht where ht.id = (p_payload ->> 'hotel_id')::uuid and ht.wedding_id = w.id)
         then (p_payload ->> 'hotel_id')::uuid end,
    coalesce((p_payload ->> 'needs_transfer')::boolean, false),
    nullif(left(trim(coalesce(p_payload ->> 'transport_notes', '')), 500), '')
  )
  on conflict (wedding_id, household_id) do update set
    arrival_date = excluded.arrival_date,
    arrival_time = excluded.arrival_time,
    arrival_airport = excluded.arrival_airport,
    arrival_flight = excluded.arrival_flight,
    departure_date = excluded.departure_date,
    departure_time = excluded.departure_time,
    departure_airport = excluded.departure_airport,
    departure_flight = excluded.departure_flight,
    staying_at = excluded.staying_at,
    hotel_id = excluded.hotel_id,
    needs_transfer = excluded.needs_transfer,
    transport_notes = excluded.transport_notes;

  return jsonb_build_object('ok', true, 'household_id', h.id);
end;
$$;

revoke all on function public.submit_guest_travel from public, anon;
grant execute on function public.submit_guest_travel to authenticated, anon;
