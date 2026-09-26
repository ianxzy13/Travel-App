-- =============================================================
-- Vow – Phase 2: events, households, guests, tags, relationships
-- Run after 20260926000000_foundation.sql (Supabase → SQL Editor).
-- =============================================================

create type public.guest_side as enum ('partner_a', 'partner_b', 'both');
create type public.age_group as enum ('adult', 'child', 'infant');
create type public.guest_list as enum ('a', 'b');
create type public.relationship_type as enum ('keep_together', 'keep_apart');

-- Tip: tables below use composite foreign keys like (guest_id, wedding_id).
-- That makes the database itself guarantee a guest can only be linked to
-- events/tags/households of the SAME wedding.

-- ---------- events (welcome drinks, ceremony, reception, brunch…) ----------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  event_date date,
  start_time time,
  end_time time,
  venue_name text check (char_length(venue_name) <= 200),
  address text check (char_length(address) <= 300),
  dress_code text check (char_length(dress_code) <= 200),
  description text check (char_length(description) <= 2000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index events_wedding_id_idx on public.events (wedding_id, sort_order);

-- ---------- households (one invitation per household) ----------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text check (char_length(city) <= 100),
  region text check (char_length(region) <= 100),
  postal_code text check (char_length(postal_code) <= 20),
  country text check (char_length(country) <= 100),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index households_wedding_id_idx on public.households (wedding_id);

-- ---------- guests ----------

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  household_id uuid not null,
  first_name text not null default '' check (char_length(first_name) <= 80),
  last_name text not null default '' check (char_length(last_name) <= 80),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 50),
  side public.guest_side not null default 'both',
  age_group public.age_group not null default 'adult',
  plus_one_allowed boolean not null default false,
  -- set on a plus-one's own row, pointing at the guest who brings them
  plus_one_of uuid,
  dietary text check (char_length(dietary) <= 500),
  accessibility text check (char_length(accessibility) <= 500),
  notes text check (char_length(notes) <= 2000),
  list public.guest_list not null default 'a',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id),
  foreign key (household_id, wedding_id)
    references public.households (id, wedding_id) on delete cascade,
  foreign key (plus_one_of, wedding_id)
    references public.guests (id, wedding_id) on delete cascade,
  check (plus_one_of is null or plus_one_of <> id),
  -- a real guest needs a name; an unnamed plus-one ("Ian's guest") may be blank
  check (plus_one_of is not null or char_length(first_name || last_name) > 0)
);
create index guests_wedding_id_idx on public.guests (wedding_id);
create index guests_household_id_idx on public.guests (household_id);
create index guests_plus_one_of_idx on public.guests (plus_one_of);

-- ---------- which guest is invited to which event ----------

create table public.guest_event_invites (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  guest_id uuid not null,
  event_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id, event_id),
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade,
  foreign key (event_id, wedding_id) references public.events (id, wedding_id) on delete cascade
);
create index guest_event_invites_wedding_idx on public.guest_event_invites (wedding_id);
create index guest_event_invites_event_idx on public.guest_event_invites (event_id);

-- ---------- tags (family, friends, work…) ----------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default 'stone'
    check (color in ('stone', 'rose', 'sage', 'sky', 'amber', 'violet')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create unique index tags_wedding_name_idx on public.tags (wedding_id, lower(name));

create table public.guest_tags (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  guest_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id, tag_id),
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade,
  foreign key (tag_id, wedding_id) references public.tags (id, wedding_id) on delete cascade
);
create index guest_tags_wedding_idx on public.guest_tags (wedding_id);

-- ---------- seating rules between two guests ----------

create table public.guest_relationships (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  guest_a uuid not null,
  guest_b uuid not null,
  type public.relationship_type not null,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (guest_a <> guest_b),
  foreign key (guest_a, wedding_id) references public.guests (id, wedding_id) on delete cascade,
  foreign key (guest_b, wedding_id) references public.guests (id, wedding_id) on delete cascade
);
-- only one rule per pair of guests, whichever order they were added in
create unique index guest_relationships_pair_idx on public.guest_relationships
  (wedding_id, least(guest_a, guest_b), greatest(guest_a, guest_b));

-- =============================================================
-- updated_at triggers + Row Level Security for every new table
-- Members can read; owners/editors can change. (Helpers from phase 1.)
-- =============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'events', 'households', 'guests', 'guest_event_invites',
    'tags', 'guest_tags', 'guest_relationships'
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

-- =============================================================
-- Functions
-- =============================================================

-- Removes households that no longer have any guests (after deletes/moves).
-- SECURITY INVOKER: runs with the caller's permissions, so RLS still applies.
create or replace function public.delete_empty_households(wid uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.households h
  where h.wedding_id = wid
    and not exists (select 1 from public.guests g where g.household_id = h.id);
$$;

revoke execute on function public.delete_empty_households(uuid) from public, anon;
grant execute on function public.delete_empty_households(uuid) to authenticated;

-- New weddings now start with a Ceremony and a Reception event.
create or replace function public.create_wedding(
  p_partner_a_name text,
  p_partner_b_name text,
  p_wedding_date date,
  p_location text,
  p_currency text,
  p_estimated_guests integer,
  p_style_tags text[],
  p_accent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.weddings (
    partner_a_name, partner_b_name, wedding_date, location, currency,
    estimated_guests, style_tags, accent, created_by
  )
  values (
    p_partner_a_name, p_partner_b_name, p_wedding_date, p_location, p_currency,
    p_estimated_guests, coalesce(p_style_tags, '{}'), coalesce(p_accent, 'rose'), auth.uid()
  )
  returning id into new_id;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  insert into public.events (wedding_id, name, event_date, sort_order)
  values (new_id, 'Ceremony', p_wedding_date, 0),
         (new_id, 'Reception', p_wedding_date, 1);

  return new_id;
end;
$$;
