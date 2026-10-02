-- Phase 13: Smart Seating Upgrades
-- Adds find_seat_enabled to weddings, name/is_active to seating_layouts,
-- scenario limit trigger, and the find_seat RPC.

-- 1. Find-your-seat toggle on weddings
alter table public.weddings add column if not exists find_seat_enabled boolean not null default false;

-- 2. Seating scenarios: name + is_active columns
alter table public.seating_layouts
  add column if not exists name text not null default '',
  add column if not exists is_active boolean not null default true;

-- Add a check constraint for name length
alter table public.seating_layouts
  add constraint seating_layouts_name_length check (char_length(name) <= 60);

-- Replace the unique constraint on event_id with a partial unique on active
alter table public.seating_layouts drop constraint if exists seating_layouts_event_id_key;
create unique index if not exists seating_layouts_active_idx
  on public.seating_layouts (event_id) where (is_active = true);

-- Max 3 layouts per event
create or replace function public.check_layout_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.seating_layouts where event_id = new.event_id) >= 3 then
    raise exception 'max_layouts_reached';
  end if;
  return new;
end; $$;

drop trigger if exists seating_layouts_limit on public.seating_layouts;
create trigger seating_layouts_limit before insert on public.seating_layouts
  for each row execute function public.check_layout_limit();

-- 3. Find-your-seat RPC (public, security definer)
create or replace function public.find_seat(p_slug text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare wid uuid; result jsonb;
begin
  select id into wid from public.weddings
    where slug = p_slug and find_seat_enabled = true;
  if wid is null then return null; end if;
  select jsonb_build_object(
    'guest_name', g.first_name || ' ' || g.last_name,
    'table_label', so.label,
    'table_number', so.number,
    'table_kind', so.kind::text
  ) into result
  from public.guests g
  join public.seat_assignments sa on sa.guest_id = g.id
  join public.seating_objects so on so.id = sa.object_id
  join public.seating_layouts sl on sl.id = sa.layout_id
  where g.wedding_id = wid
    and sl.is_active = true
    and lower(trim(g.first_name || ' ' || g.last_name)) = lower(trim(p_name))
  limit 1;
  return result;
end; $$;
