-- =============================================================
-- Vow – bug fixes found in the full-site test (October 2026)
-- Safe to run more than once: paste the whole file into the
-- Supabase SQL editor and press Run.
-- =============================================================

-- ---------- fix guest RSVPs
-- Two bugs stopped guests from answering:
--   1. get_rsvp() sorts hotels by "sort_order", a column hotels never had,
--      so every RSVP link showed "Invitation not found".
--   2. submit_rsvp() lost a type cast in the privacy update, so sending an
--      answer failed with "column status is of type rsvp_status".

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

-- ---------- helpers can tick off their own to-dos
-- The "Helper" role promises "can edit tasks assigned to them", but the
-- database only let owners, editors and parents change to-dos.

drop policy if exists "tasks_update_assignee" on public.tasks;
create policy "tasks_update_assignee" on public.tasks for update to authenticated
  using (assignee_id = auth.uid() and public.is_wedding_member(wedding_id))
  with check (assignee_id = auth.uid() and public.is_wedding_member(wedding_id));

-- ---------- fix guest photo uploads
-- Guests aren't signed in, and the database hides the weddings table from
-- them, so the storage rules "is photo sharing on for this wedding?" always
-- answered no and every guest upload failed ("Upload failed").
-- A small helper function looks it up with the right permissions instead.

create or replace function public.photo_sharing_open(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.weddings
    where id::text = p_folder and photos_enabled = true
  );
$$;

grant execute on function public.photo_sharing_open(text) to anon, authenticated;

-- Guests (signed in to Vow or not) can view and add photos while sharing is on.
drop policy if exists "photos_storage_anon_select" on storage.objects;
create policy "photos_storage_anon_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'photos' and public.photo_sharing_open((storage.foldername(name))[1]));

drop policy if exists "photos_storage_anon_insert" on storage.objects;
create policy "photos_storage_anon_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'photos' and public.photo_sharing_open((storage.foldername(name))[1]));

drop policy if exists "wedding_photos_anon_select" on public.wedding_photos;
create policy "wedding_photos_anon_select" on public.wedding_photos
  for select to anon, authenticated
  using (public.photo_sharing_open(wedding_id::text));

-- ---------- fix "Find your seat" for guests
-- The page read the weddings table directly, which guests can't see, so
-- it always showed "page not found". get_wedding_public() now also says
-- whether the couple switched the page on.

create or replace function public.get_wedding_public(p_slug text)
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
    'rsvp_deadline', w.rsvp_deadline,
    'rsvp_contact', w.rsvp_contact,
    'languages', w.languages,
    'translations', w.translations,
    'find_seat_enabled', w.find_seat_enabled
  )
  from public.weddings w where w.slug = lower(trim(p_slug));
$$;

