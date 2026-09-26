-- =============================================================
-- Vow – Phase 4: seating chart
-- Run after the phase 3 migration (Supabase → SQL Editor).
-- =============================================================

-- One floor plan per event (sizes in centimetres).
create table public.seating_layouts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  event_id uuid not null,
  room_width integer not null default 2000 check (room_width between 300 and 20000),
  room_height integer not null default 1400 check (room_height between 300 and 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id),
  unique (id, wedding_id),
  foreign key (event_id, wedding_id) references public.events (id, wedding_id) on delete cascade
);

create type public.seating_kind as enum (
  'round', 'rect', 'square', 'head', 'sweetheart',
  'dance_floor', 'stage', 'bar', 'buffet', 'cake', 'entrance', 'pillar', 'label'
);

-- Tables and decor. The id is created by the app so new tables appear instantly.
-- Seats are not stored separately: a table has seats 0..seat_count-1, and their
-- positions are calculated from the table's shape (see lib/seating/geometry.ts).
create table public.seating_objects (
  id uuid primary key,
  wedding_id uuid not null,
  layout_id uuid not null,
  kind public.seating_kind not null,
  label text check (char_length(label) <= 60),
  number integer check (number between 0 and 999),
  x real not null default 0,
  y real not null default 0,
  rotation real not null default 0 check (rotation between -360 and 360),
  width real not null check (width between 10 and 5000),
  height real not null check (height between 10 and 5000),
  seat_count integer not null default 0 check (seat_count between 0 and 30),
  ends boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, layout_id),
  foreign key (layout_id, wedding_id)
    references public.seating_layouts (id, wedding_id) on delete cascade
);
create index seating_objects_layout_idx on public.seating_objects (layout_id);

-- Who sits where. Primary key (layout, guest): a guest has one seat per event.
create table public.seat_assignments (
  layout_id uuid not null,
  guest_id uuid not null,
  wedding_id uuid not null,
  object_id uuid not null,
  seat_index integer not null check (seat_index >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (layout_id, guest_id),
  -- one guest per seat. Checked at the END of a save ("deferred"), so two
  -- guests can swap seats in one go.
  constraint seat_assignments_one_per_seat unique (object_id, seat_index)
    deferrable initially deferred,
  foreign key (object_id, layout_id)
    references public.seating_objects (id, layout_id) on delete cascade,
  foreign key (layout_id, wedding_id)
    references public.seating_layouts (id, wedding_id) on delete cascade,
  foreign key (guest_id, wedding_id)
    references public.guests (id, wedding_id) on delete cascade
);
create index seat_assignments_object_idx on public.seat_assignments (object_id);

-- A seat must exist on its table.
create or replace function public.check_seat_exists()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.seating_objects o
    where o.id = new.object_id and new.seat_index < o.seat_count
  ) then
    raise exception 'seat_does_not_exist';
  end if;
  return new;
end;
$$;

create trigger seat_assignments_seat_exists
  before insert or update on public.seat_assignments
  for each row execute function public.check_seat_exists();

-- When a table loses seats, unseat the people in seats that no longer exist.
create or replace function public.trim_removed_seats()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.seat_count < old.seat_count then
    delete from public.seat_assignments
    where object_id = new.id and seat_index >= new.seat_count;
  end if;
  return new;
end;
$$;

create trigger seating_objects_trim_seats
  after update of seat_count on public.seating_objects
  for each row execute function public.trim_removed_seats();

-- updated_at + RLS (members read, owners/editors change)
do $$
declare
  t text;
begin
  foreach t in array array['seating_layouts', 'seating_objects', 'seat_assignments'] loop
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
-- Save a batch of changes from the editor in ONE transaction.
-- SECURITY INVOKER: runs with the caller's rights, so RLS still applies.
-- p_changes = {
--   layout?: { room_width, room_height },
--   objects: [ {id, kind, label, number, x, y, rotation, width, height, seat_count, ends} ],
--   deleted_objects: [ id ],
--   assign: [ {guest_id, object_id, seat_index} ],
--   unassign: [ guest_id ]
-- }
-- =============================================================
create or replace function public.apply_seating_changes(p_layout_id uuid, p_changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  wid uuid;
begin
  select wedding_id into wid from public.seating_layouts where id = p_layout_id;
  if wid is null then
    raise exception 'layout_not_found';
  end if;
  if not public.can_edit_wedding(wid) then
    raise exception 'not_allowed';
  end if;

  if p_changes ? 'layout' then
    update public.seating_layouts set
      room_width = coalesce((p_changes -> 'layout' ->> 'room_width')::integer, room_width),
      room_height = coalesce((p_changes -> 'layout' ->> 'room_height')::integer, room_height)
    where id = p_layout_id;
  end if;

  -- 1. unseat
  delete from public.seat_assignments
  where layout_id = p_layout_id
    and guest_id in (
      select value::uuid from jsonb_array_elements_text(coalesce(p_changes -> 'unassign', '[]'))
    );

  -- 2. removed tables (their seat assignments go too)
  delete from public.seating_objects
  where layout_id = p_layout_id
    and id in (
      select value::uuid from jsonb_array_elements_text(coalesce(p_changes -> 'deleted_objects', '[]'))
    );

  -- 3. new / changed tables
  insert into public.seating_objects as so
    (id, wedding_id, layout_id, kind, label, number, x, y, rotation, width, height, seat_count, ends)
  select o.id, wid, p_layout_id, o.kind::public.seating_kind, o.label, o.number, o.x, o.y,
         o.rotation, o.width, o.height, o.seat_count, coalesce(o.ends, false)
  from jsonb_to_recordset(coalesce(p_changes -> 'objects', '[]')) as o(
    id uuid, kind text, label text, number integer, x real, y real, rotation real,
    width real, height real, seat_count integer, ends boolean
  )
  on conflict (id) do update set
    kind = excluded.kind, label = excluded.label, number = excluded.number,
    x = excluded.x, y = excluded.y, rotation = excluded.rotation,
    width = excluded.width, height = excluded.height,
    seat_count = excluded.seat_count, ends = excluded.ends
  where so.layout_id = p_layout_id;

  -- 4. seat guests (moves and swaps are fine: one-per-seat is checked at the end)
  insert into public.seat_assignments as sa (layout_id, guest_id, wedding_id, object_id, seat_index)
  select p_layout_id, a.guest_id, wid, a.object_id, a.seat_index
  from jsonb_to_recordset(coalesce(p_changes -> 'assign', '[]')) as a(
    guest_id uuid, object_id uuid, seat_index integer
  )
  on conflict (layout_id, guest_id) do update set
    object_id = excluded.object_id, seat_index = excluded.seat_index;
end;
$$;

revoke execute on function public.apply_seating_changes(uuid, jsonb) from public, anon;
grant execute on function public.apply_seating_changes(uuid, jsonb) to authenticated;

-- =============================================================
-- Realtime: collaborators see each other's changes live.
-- =============================================================
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.seating_layouts, public.seating_objects, public.seat_assignments;
  end if;
end;
$$;
