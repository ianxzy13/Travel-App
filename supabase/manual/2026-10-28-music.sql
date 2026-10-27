-- =============================================================
-- Vow: music (songs by moment + guest suggestions)
-- Moments ("First dance"), the songs in them, and songs guests
-- suggest on the RSVP page. Safe to run more than once.
-- =============================================================

-- ---------- tables ----------

create table if not exists public.music_moments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  -- ceremony_in, first_dance, party, do_not_play, custom, ... (for translations)
  kind text not null default 'custom' check (char_length(kind) <= 40),
  schedule_item_id uuid references public.schedule_items (id) on delete set null,
  sort_order integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index if not exists music_moments_wedding_idx
  on public.music_moments (wedding_id, sort_order);
-- each standard moment once per wedding (the app creates them on first visit)
create unique index if not exists music_moments_kind_idx
  on public.music_moments (wedding_id, kind) where kind <> 'custom';

create table if not exists public.music_suggestions (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  household_id uuid,
  guest_name text check (char_length(guest_name) <= 120),
  title text not null check (char_length(title) between 1 and 200),
  artist text not null default '' check (char_length(artist) <= 200),
  status text not null default 'new' check (status in ('new', 'accepted', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (id, wedding_id),
  foreign key (household_id, wedding_id)
    references public.households (id, wedding_id) on delete set null (household_id)
);
create index if not exists music_suggestions_wedding_idx
  on public.music_suggestions (wedding_id, status);
-- one row per song per household, so sending the RSVP again adds no copies
create unique index if not exists music_suggestions_once_idx
  on public.music_suggestions (household_id, lower(title), lower(artist))
  where household_id is not null;

create table if not exists public.music_songs (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  moment_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  artist text not null default '' check (char_length(artist) <= 200),
  url text check (url is null or (char_length(url) <= 500 and url like 'https://%')),
  note text check (char_length(note) <= 500),
  priority text not null default 'nice' check (priority in ('must', 'nice', 'no')),
  language text check (char_length(language) <= 10),
  sort_order integer not null default 0,
  suggestion_id uuid references public.music_suggestions (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (moment_id, wedding_id)
    references public.music_moments (id, wedding_id) on delete cascade
);
create index if not exists music_songs_moment_idx on public.music_songs (moment_id, sort_order);
create index if not exists music_songs_wedding_idx on public.music_songs (wedding_id);

-- ---------- updated_at + RLS ----------

do $$
declare
  t text;
begin
  foreach t in array array['music_moments', 'music_songs', 'music_suggestions'] loop
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
  foreach t in array array['music_moments', 'music_songs'] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------- songs from the RSVP land in the inbox ----------

-- "Artist – Title" (en dash or " - ") becomes artist + title; anything else is the title.
create or replace function public.split_song(p_text text, out title text, out artist text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text := regexp_replace(trim(coalesce(p_text, '')), '\s+', ' ', 'g');
  parts text[];
begin
  parts := regexp_match(s, '^(.+?)\s+[–—-]\s+(.+)$');
  if parts is null then
    title := left(s, 200);
    artist := '';
  else
    artist := left(trim(parts[1]), 200);
    title := left(trim(parts[2]), 200);
  end if;
end;
$$;

-- Adds a household's songs to the inbox, skipping ones already there.
create or replace function public.add_music_suggestions(
  p_wedding uuid,
  p_household uuid,
  p_guest_name text,
  p_songs jsonb,
  p_text text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
begin
  if p_songs is not null and jsonb_typeof(p_songs) = 'array' and jsonb_array_length(p_songs) > 0 then
    for r in
      select left(trim(coalesce(x.title, '')), 200) as title,
             left(trim(coalesce(x.artist, '')), 200) as artist
      from jsonb_to_recordset(p_songs) as x(title text, artist text)
      limit 3
    loop
      if r.title <> '' then
        insert into public.music_suggestions (wedding_id, household_id, guest_name, title, artist)
        values (p_wedding, p_household, left(p_guest_name, 120), r.title, r.artist)
        on conflict (household_id, lower(title), lower(artist)) where household_id is not null
        do nothing;
      end if;
    end loop;
  elsif nullif(trim(coalesce(p_text, '')), '') is not null then
    -- older RSVP pages send one text box, maybe several songs on separate lines
    for r in
      select (public.split_song(line)).*
      from unnest(string_to_array(p_text, E'\n')) as line
      where trim(line) <> ''
      limit 3
    loop
      insert into public.music_suggestions (wedding_id, household_id, guest_name, title, artist)
      values (p_wedding, p_household, left(p_guest_name, 120), r.title, r.artist)
      on conflict (household_id, lower(title), lower(artist)) where household_id is not null
      do nothing;
    end loop;
  end if;
end;
$$;

revoke all on function public.add_music_suggestions(uuid, uuid, text, jsonb, text) from public, anon, authenticated;

-- Same as the newest submit_rsvp (20261024000000_bug_fixes.sql), plus step 3b.
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

  -- 3b. songs go to the couple's music inbox (new ones only)
  if w.rsvp_ask_song then
    perform public.add_music_suggestions(
      h.wedding_id, h.id, h.name, p_payload -> 'songs', p_payload ->> 'song_request');
  end if;

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

-- ---------- songs guests already sent ----------
-- (the unique index skips any that were copied before)

do $$
declare
  hh record;
begin
  for hh in
    select id, wedding_id, name, rsvp_song_request from public.households
    where nullif(trim(coalesce(rsvp_song_request, '')), '') is not null
  loop
    perform public.add_music_suggestions(hh.wedding_id, hh.id, hh.name, null, hh.rsvp_song_request);
  end loop;
end;
$$;

-- ---------- the "song list" to-do opens the Music page ----------

update public.tasks set link = '/app/music'
  where suggestion_key = 'song-list' and (link is null or link = '');
