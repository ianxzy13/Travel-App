-- =============================================================
-- Vow – Prompt C: Personal guest trip page
-- Adds household country and per-guest checklist item ticks.
-- =============================================================

-- Optional 2-letter ISO country code on households
alter table public.households
  add column if not exists country_code text check (char_length(country_code) = 2);

-- Per-guest entry checklist ticks
create table public.guest_checklist_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 100),
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, item_key)
);

create index guest_checklist_wedding_idx
  on public.guest_checklist_items (wedding_id);

-- updated_at + RLS
do $$
declare t text;
begin
  foreach t in array array['guest_checklist_items'] loop
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

-- RPC for guests to toggle checklist items via RSVP code
create or replace function public.toggle_checklist_item(
  p_code text,
  p_item_key text,
  p_done boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.households%rowtype;
begin
  select * into h from public.households where rsvp_code = upper(trim(p_code));
  if not found then
    raise exception 'rsvp_not_found';
  end if;

  insert into public.guest_checklist_items (wedding_id, household_id, item_key, done, done_at)
  values (
    h.wedding_id, h.id, p_item_key, p_done,
    case when p_done then now() else null end
  )
  on conflict (household_id, item_key) do update set
    done = excluded.done,
    done_at = case when excluded.done then now() else null end;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.toggle_checklist_item from public, anon;
grant execute on function public.toggle_checklist_item to authenticated, anon;

-- Extend get_rsvp to include checklist items and household country
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
  if not found then return null; end if;

  return jsonb_build_object(
    'wedding', (
      select jsonb_build_object(
        'id', w.id, 'slug', w.slug,
        'partner_a_name', w.partner_a_name, 'partner_b_name', w.partner_b_name,
        'wedding_date', w.wedding_date, 'location', w.location,
        'accent', w.accent, 'rsvp_deadline', w.rsvp_deadline,
        'rsvp_contact', w.rsvp_contact, 'rsvp_ask_song', w.rsvp_ask_song,
        'rsvp_ask_travel', w.rsvp_ask_travel,
        'deadline_passed', w.rsvp_deadline is not null and current_date > w.rsvp_deadline,
        'destination_airport', w.destination_airport,
        'time_zone', w.time_zone,
        'find_seat_enabled', w.find_seat_enabled
      ) from public.weddings w where w.id = h.wedding_id
    ),
    'household', jsonb_build_object(
      'id', h.id, 'name', h.name, 'code', h.rsvp_code,
      'song_request', h.rsvp_song_request, 'message', h.rsvp_message,
      'responded_at', h.rsvp_responded_at,
      'country_code', h.country_code
    ),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'first_name', g.first_name, 'last_name', g.last_name,
        'plus_one_of', g.plus_one_of, 'age_group', g.age_group,
        'dietary', g.dietary, 'dietary_consent', g.dietary_consent,
        'wants_hotel_room', g.wants_hotel_room, 'needs_crib', g.needs_crib,
        'room_pref_share', g.room_pref_share, 'room_pref_avoid', g.room_pref_avoid
      ) order by g.plus_one_of is not null, g.created_at)
      from public.guests g where g.household_id = h.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'event_date', e.event_date,
        'start_time', e.start_time, 'end_time', e.end_time,
        'venue_name', e.venue_name, 'address', e.address,
        'dress_code', e.dress_code, 'description', e.description,
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
        'guest_id', r.guest_id, 'event_id', r.event_id,
        'status', r.status, 'meal_option_id', r.meal_option_id
      ))
      from public.rsvp_responses r
      where r.guest_id in (select g2.id from public.guests g2 where g2.household_id = h.id)
    ), '[]'::jsonb),
    'meal_options', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'name', m.name, 'description', m.description
      ) order by m.sort_order)
      from public.meal_options m where m.wedding_id = h.wedding_id
    ), '[]'::jsonb),
    'hotels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ht.id, 'name', ht.name, 'address', ht.address, 'distance', ht.distance
      ) order by ht.sort_order)
      from public.hotels ht where ht.wedding_id = h.wedding_id
    ), '[]'::jsonb),
    'room_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guest_id', ra.guest_id, 'room_number', hr.room_number,
        'hotel_name', ht.name, 'check_in', ra.check_in, 'check_out', ra.check_out
      ))
      from public.hotel_room_assignments ra
      join public.hotel_rooms hr on hr.id = ra.room_id
      join public.hotels ht on ht.id = hr.hotel_id
      where ra.guest_id in (select g3.id from public.guests g3 where g3.household_id = h.id)
    ), '[]'::jsonb),
    'travel', (
      select jsonb_build_object(
        'arrival_date', t.arrival_date, 'arrival_time', t.arrival_time,
        'arrival_airport', t.arrival_airport, 'arrival_flight', t.arrival_flight,
        'departure_date', t.departure_date, 'departure_time', t.departure_time,
        'departure_airport', t.departure_airport, 'departure_flight', t.departure_flight,
        'staying_at', t.staying_at, 'hotel_id', t.hotel_id,
        'needs_transfer', t.needs_transfer, 'transport_notes', t.transport_notes
      )
      from public.guest_travel t where t.household_id = h.id
    ),
    'checklist', coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_key', ci.item_key, 'done', ci.done
      ))
      from public.guest_checklist_items ci
      where ci.household_id = h.id
    ), '[]'::jsonb),
    'seat', (
      select jsonb_build_object(
        'guest_name', g.first_name || ' ' || g.last_name,
        'table_label', so.label,
        'table_number', so.number
      )
      from public.guests g
      join public.seat_assignments sa on sa.guest_id = g.id
      join public.seating_objects so on so.id = sa.object_id
      join public.seating_layouts sl on sl.id = sa.layout_id
      where g.household_id = h.id
        and sl.is_active = true
      limit 1
    )
  );
end;
$$;
