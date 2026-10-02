-- =============================================================
-- Vow – bug fixes (October 2026)
-- Run after the hotel rooms migration (Supabase → SQL Editor).
-- Safe to run more than once.
-- =============================================================

-- ---------- "Find your seat": forgiving name matching ----------
-- Before: the guest had to type their name exactly, accents included
-- ("Kovač" didn't match "Kovac"), and the web address had to be lower case.
-- Now it matches names the same way "find your invitation" does, and prefers
-- the dinner/reception seat when a guest is seated at several events.
create or replace function public.find_seat(p_slug text, p_name text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  wid uuid;
  wanted text := regexp_replace(public.fold(trim(p_name)), '\s+', ' ', 'g');
  result jsonb;
begin
  if char_length(wanted) < 3 then
    return null;
  end if;
  select id into wid from public.weddings
    where slug = lower(trim(p_slug)) and find_seat_enabled = true;
  if wid is null then
    return null;
  end if;
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
  join public.events e on e.id = sl.event_id
  where g.wedding_id = wid
    and sl.is_active = true
    and regexp_replace(public.fold(trim(g.first_name || ' ' || g.last_name)), '\s+', ' ', 'g') = wanted
  order by e.meal_choice desc, e.sort_order desc
  limit 1;
  return result;
end;
$$;

revoke execute on function public.find_seat(text, text) from public;
grant execute on function public.find_seat(text, text) to anon, authenticated;

-- ---------- room preferences: never fail on long text ----------
-- The RSVP page limits these to 200 characters, but a too-long note made the
-- whole save fail. Cut it to fit instead.
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

  for pref in select * from jsonb_array_elements(coalesce(p_prefs, '[]'::jsonb))
  loop
    update public.guests set
      wants_hotel_room = case
        when pref->>'wants_hotel_room' in ('yes','no','elsewhere')
        then pref->>'wants_hotel_room' else null end,
      needs_crib = coalesce((pref->>'needs_crib')::boolean, false),
      room_pref_share = nullif(left(trim(pref->>'room_pref_share'), 200), ''),
      room_pref_avoid = nullif(left(trim(pref->>'room_pref_avoid'), 200), '')
    where id = (pref->>'guest_id')::uuid
      and wedding_id = h.wedding_id
      and household_id = h.household_id;
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.submit_room_preferences(text, jsonb) from public;
grant execute on function public.submit_room_preferences(text, jsonb) to anon, authenticated;
