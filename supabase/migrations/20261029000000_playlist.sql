-- =============================================================
-- Vow: Playlist (a simple song list by category)
-- Replaces the Music page: its tables stay but are no longer used,
-- and RSVP answers stop adding songs to them.
-- Safe to run more than once.
-- =============================================================

create table if not exists public.playlist_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index if not exists playlist_categories_wedding_idx
  on public.playlist_categories (wedding_id, sort_order);
-- no two categories with the same name (also stops the defaults being made twice)
create unique index if not exists playlist_categories_name_idx
  on public.playlist_categories (wedding_id, lower(name));

create table if not exists public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  category_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  artist text not null default '' check (char_length(artist) <= 200),
  priority text not null default 'nice' check (priority in ('must', 'nice', 'no')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, wedding_id)
    references public.playlist_categories (id, wedding_id) on delete cascade
);
create index if not exists playlist_songs_category_idx on public.playlist_songs (category_id);
create index if not exists playlist_songs_wedding_idx on public.playlist_songs (wedding_id);

drop trigger if exists playlist_songs_updated_at on public.playlist_songs;
create trigger playlist_songs_updated_at before update on public.playlist_songs
  for each row execute function public.set_updated_at();

-- Everyone in the wedding can read; owner, editor and parent can change.
do $$
declare
  t text;
begin
  foreach t in array array['playlist_categories', 'playlist_songs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_select" on public.%1$I', t);
    execute format(
      'create policy "%1$s_select" on public.%1$I for select to authenticated
         using (public.is_wedding_member(wedding_id))', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format(
      'create policy "%1$s_insert" on public.%1$I for insert to authenticated
         with check (public.can_edit_wedding(wedding_id))', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format(
      'create policy "%1$s_update" on public.%1$I for update to authenticated
         using (public.can_edit_wedding(wedding_id))
         with check (public.can_edit_wedding(wedding_id))', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format(
      'create policy "%1$s_delete" on public.%1$I for delete to authenticated
         using (public.can_edit_wedding(wedding_id))', t);
  end loop;
end;
$$;

-- The "song list" to-do opens the Playlist page.
update public.tasks set link = '/app/playlist'
  where suggestion_key = 'song-list' and (link is null or link = '' or link = '/app/music');

-- RSVP answers no longer copy songs into the old Music inbox
-- (same function as in 20261024000000_bug_fixes.sql).
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
