-- Privacy & consent columns for GDPR compliance

-- Dietary consent: guest must explicitly agree to share allergy/dietary free text
alter table public.guests
  add column dietary_consent boolean not null default false,
  add column dietary_consent_at timestamptz;

-- Per-guest email unsubscribe flag (respected by all reminder/bulk sends)
alter table public.guests
  add column email_unsubscribed boolean not null default false;

-- Track when a wedding's guest data was anonymised (data retention)
alter table public.weddings
  add column anonymised_at timestamptz;

-- Index for the data-retention cron query
create index weddings_retention_idx
  on public.weddings (wedding_date)
  where anonymised_at is null and wedding_date is not null;

-- Update get_rsvp to include dietary_consent in guest data
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
        'dietary_consent', g.dietary_consent,
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
        'guest_id', ra.guest_id,
        'room_number', hr.room_number,
        'hotel_name', ht.name,
        'check_in', hr.check_in,
        'check_out', hr.check_out
      ))
      from public.hotel_room_assignments ra
      join public.hotel_rooms hr on hr.id = ra.room_id
      join public.hotels ht on ht.id = hr.hotel_id
      where ra.guest_id in (select g3.id from public.guests g3 where g3.household_id = h.id)
    ), '[]'::jsonb),
    'travel', (
      select jsonb_build_object(
        'arrival_date', t.arrival_date,
        'arrival_time', t.arrival_time,
        'arrival_airport', t.arrival_airport,
        'arrival_flight', t.arrival_flight,
        'departure_date', t.departure_date,
        'departure_time', t.departure_time,
        'departure_airport', t.departure_airport,
        'departure_flight', t.departure_flight,
        'staying_at', t.staying_at,
        'hotel_id', t.hotel_id,
        'needs_transfer', t.needs_transfer,
        'transport_notes', t.transport_notes
      )
      from public.guest_travel t where t.household_id = h.id
    )
  );
end;
$$;

-- Update submit_rsvp to handle dietary_consent per guest.
-- The guest payload now accepts an optional dietary_consent boolean.
-- When dietary_consent is false, dietary free-text is cleared.
create or replace function public.submit_rsvp(
  p_code text,
  p_payload jsonb,
  p_as_couple boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  h  record;
  w  record;
  r  record;
  n_attending int;
  n_declined int;
begin
  select * into h from public.households
    where rsvp_code = upper(trim(p_code));
  if h is null then raise exception 'rsvp_not_found'; end if;

  select * into w from public.weddings where id = h.wedding_id;
  if w is null then raise exception 'rsvp_not_found'; end if;

  if not p_as_couple
     and w.rsvp_deadline is not null
     and w.rsvp_deadline < current_date then
    raise exception 'rsvp_closed';
  end if;

  -- 1. attendance and meal
  for r in
    select * from jsonb_to_recordset(coalesce(p_payload -> 'responses', '[]'::jsonb))
      as x(guest_id uuid, event_id uuid, status text, meal_option_id uuid)
  loop
    if r.status is null or r.status not in ('attending', 'declined') then
      raise exception 'invalid_status';
    end if;

    if not exists (
      select 1 from public.guest_event_invites
        where guest_id = r.guest_id and event_id = r.event_id
          and wedding_id = h.wedding_id
    ) then
      raise exception 'not_invited';
    end if;

    insert into public.rsvp_responses (wedding_id, guest_id, event_id, status, meal_option_id)
    values (
      h.wedding_id, r.guest_id, r.event_id, r.status,
      case when r.status = 'attending' then r.meal_option_id else null end
    )
    on conflict (guest_id, event_id)
    do update set
      status = excluded.status,
      meal_option_id = excluded.meal_option_id,
      updated_at = now();
  end loop;

  -- 2. per-person details: dietary notes + consent; names only for plus-ones
  for r in
    select * from jsonb_to_recordset(coalesce(p_payload -> 'guests', '[]'::jsonb))
      as x(id uuid, dietary text, first_name text, last_name text, dietary_consent boolean)
  loop
    update public.guests g set
      dietary_consent = coalesce(r.dietary_consent, g.dietary_consent),
      dietary_consent_at = case
        when r.dietary_consent = true and g.dietary_consent = false then now()
        when r.dietary_consent = false then null
        else g.dietary_consent_at end,
      dietary = case
        when r.dietary_consent = false then null
        when r.dietary is null then g.dietary
        else nullif(left(trim(r.dietary), 500), '') end,
      first_name = case when g.plus_one_of is not null and r.first_name is not null
                        then left(trim(r.first_name), 80) else g.first_name end,
      last_name = case when g.plus_one_of is not null and r.last_name is not null
                       then left(trim(r.last_name), 80) else g.last_name end
    where g.id = r.id and g.household_id = h.id;
  end loop;

  -- 3. household-level answers
  update public.households set
    rsvp_song_request = nullif(left(trim(coalesce(p_payload ->> 'song_request', '')), 200), ''),
    rsvp_message = nullif(left(trim(coalesce(p_payload ->> 'message', '')), 2000), ''),
    rsvp_responded_at = now()
  where id = h.id;

  -- 4. summary
  select
    count(*) filter (where bool_or_attending),
    count(*) filter (where not bool_or_attending)
  into n_attending, n_declined
  from (
    select bool_or(r2.status = 'attending') as bool_or_attending
    from public.rsvp_responses r2
    where r2.wedding_id = h.wedding_id
      and r2.guest_id in (select g2.id from public.guests g2 where g2.household_id = h.id)
    group by r2.guest_id
  ) sub;

  return jsonb_build_object(
    'wedding_id', h.wedding_id,
    'household_id', h.id,
    'household_name', h.name,
    'attending', coalesce(n_attending, 0),
    'declined', coalesce(n_declined, 0),
    'updated', (h.rsvp_responded_at is not null)
  );
end;
$$;

-- Anonymise function: replaces personal data with placeholders
create or replace function public.anonymise_wedding_guests(p_wedding_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Clear personal fields on guests
  update public.guests set
    first_name = 'Guest',
    last_name = 'removed',
    email = null,
    phone = null,
    dietary = null,
    accessibility = null,
    notes = null,
    dietary_consent = false,
    dietary_consent_at = null,
    room_pref_share = null,
    room_pref_avoid = null
  where wedding_id = p_wedding_id;

  -- Clear household personal fields
  update public.households set
    address_line1 = null,
    address_line2 = null,
    city = null,
    region = null,
    postal_code = null,
    country = null,
    notes = null,
    rsvp_message = null,
    rsvp_song_request = null
  where wedding_id = p_wedding_id;

  -- Clear guest travel details
  update public.guest_travel set
    arrival_airport = null,
    arrival_flight = null,
    departure_airport = null,
    departure_flight = null,
    staying_at = null,
    transport_notes = null
  where wedding_id = p_wedding_id;

  -- Remove seat assignments
  delete from public.seat_assignments where wedding_id = p_wedding_id;

  -- Remove room assignments
  delete from public.hotel_room_assignments where wedding_id = p_wedding_id;

  -- Mark wedding as anonymised
  update public.weddings set anonymised_at = now() where id = p_wedding_id;
end;
$$;

revoke execute on function public.anonymise_wedding_guests(uuid) from public, anon, authenticated;
grant execute on function public.anonymise_wedding_guests(uuid) to service_role;
