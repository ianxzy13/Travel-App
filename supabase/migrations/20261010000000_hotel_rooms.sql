-- =============================================================
-- Vow – Phase 14: Hotel Rooms
-- Adds room types, individual rooms, and room-level guest
-- assignments so couples can manage exactly who sleeps where.
-- =============================================================

-- ---------- bed config enum ----------

create type public.bed_kind as enum ('double', 'single', 'sofa_bed', 'bunk');

-- ---------- room types (templates per hotel) ----------

create table public.hotel_room_types (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  hotel_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  beds jsonb not null default '[]',
  max_guests integer not null default 2 check (max_guests between 1 and 20),
  has_crib boolean not null default false,
  accessible boolean not null default false,
  price_per_night numeric(12, 2) check (price_per_night >= 0),
  count integer not null default 1 check (count between 0 and 500),
  notes text check (char_length(notes) <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id, wedding_id)
    references public.hotels (id, wedding_id) on delete cascade
);
create index hotel_room_types_hotel_idx
  on public.hotel_room_types (hotel_id, sort_order);

-- ---------- individual rooms ----------

create table public.hotel_rooms (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  hotel_id uuid not null,
  room_type_id uuid references public.hotel_room_types (id) on delete set null,
  room_number text not null check (char_length(room_number) between 1 and 30),
  floor text check (char_length(floor) <= 20),
  is_locked boolean not null default false,
  notes text check (char_length(notes) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hotel_id, wedding_id)
    references public.hotels (id, wedding_id) on delete cascade,
  unique (id, wedding_id)
);
create index hotel_rooms_hotel_idx
  on public.hotel_rooms (hotel_id, sort_order);

-- ---------- room-level guest assignments ----------

create table public.hotel_room_assignments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  room_id uuid not null,
  guest_id uuid not null,
  check_in date,
  check_out date,
  needs_crib boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id),
  check (check_out is null or check_in is null or check_out >= check_in),
  foreign key (room_id, wedding_id)
    references public.hotel_rooms (id, wedding_id) on delete cascade,
  foreign key (guest_id, wedding_id)
    references public.guests (id, wedding_id) on delete cascade
);
create index hotel_room_assignments_room_idx
  on public.hotel_room_assignments (room_id);

-- ---------- guest room preferences (self-reported via RSVP or couple-entered) ----------

alter table public.guests
  add column wants_hotel_room text check (wants_hotel_room in ('yes', 'no', 'elsewhere'))
    default null,
  add column needs_crib boolean not null default false,
  add column room_pref_share text check (char_length(room_pref_share) <= 200),
  add column room_pref_avoid text check (char_length(room_pref_avoid) <= 200);

-- ---------- get_rsvp: add room preferences to guests ----------

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
        'dietary', g.dietary,
        'wants_hotel_room', g.wants_hotel_room,
        'needs_crib', g.needs_crib,
        'room_pref_share', g.room_pref_share,
        'room_pref_avoid', g.room_pref_avoid
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
    ),
    'room_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guest_id', ra.guest_id,
        'room_number', rm.room_number,
        'hotel_name', ht.name,
        'check_in', ra.check_in,
        'check_out', ra.check_out
      ))
      from public.hotel_room_assignments ra
      join public.hotel_rooms rm on rm.id = ra.room_id
      join public.hotels ht on ht.id = rm.hotel_id
      join public.guests g on g.id = ra.guest_id
      where g.household_id = h.id
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------- submit_room_preferences ----------

create or replace function public.submit_room_preferences(
  p_code text,
  p_prefs jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h record;
  pref jsonb;
begin
  select ho.id as household_id, ho.wedding_id
    into h
    from public.households ho
    where ho.rsvp_code = upper(trim(p_code));
  if not found then
    raise exception 'rsvp_not_found';
  end if;

  for pref in select * from jsonb_array_elements(p_prefs)
  loop
    update public.guests set
      wants_hotel_room = case
        when pref->>'wants_hotel_room' in ('yes','no','elsewhere')
        then pref->>'wants_hotel_room' else null end,
      needs_crib = coalesce((pref->>'needs_crib')::boolean, false),
      room_pref_share = nullif(trim(pref->>'room_pref_share'), ''),
      room_pref_avoid = nullif(trim(pref->>'room_pref_avoid'), '')
    where id = (pref->>'guest_id')::uuid
      and wedding_id = h.wedding_id
      and household_id = h.household_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------- updated_at + RLS ----------

do $$
declare
  t text;
begin
  foreach t in array array[
    'hotel_room_types', 'hotel_rooms', 'hotel_room_assignments'
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
