-- =============================================================
-- Vow – fix guest RSVPs
-- Two bugs stopped guests from answering:
--   1. get_rsvp() sorts hotels by "sort_order", a column hotels never had,
--      so every RSVP link showed "Invitation not found".
--   2. submit_rsvp() lost a type cast in the privacy update, so sending an
--      answer failed with "column status is of type rsvp_status".
-- Safe to run more than once.
-- =============================================================

-- 1. Give hotels the column get_rsvp() orders by (couple's order of entry).
alter table public.hotels add column if not exists sort_order integer not null default 0;

-- 2. Same function as in 20261012000000_privacy.sql, with the cast restored.
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
      h.wedding_id, r.guest_id, r.event_id, r.status::public.rsvp_status,
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
