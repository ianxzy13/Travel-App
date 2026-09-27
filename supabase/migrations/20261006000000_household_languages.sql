-- =============================================================
-- Vow – Phase 11 (part 2): the wedding's languages follow its households.
-- weddings.languages = the couple's own language (first), then every language
-- a household speaks. The couple only chooses their own language; each
-- household's language is set on the household. Kept up to date by triggers.
-- Run after 20261005000000_languages.sql (Supabase → SQL Editor).
-- =============================================================

-- Whenever a wedding's languages are written, keep the first (the couple's
-- language) and rebuild the rest from the households.
create or replace function public.normalize_wedding_languages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.languages := array[new.languages[1]] || coalesce(
    array(
      select distinct h.preferred_language
      from public.households h
      where h.wedding_id = new.id
        and h.preferred_language is not null
        and h.preferred_language <> new.languages[1]
      order by 1
      limit 24
    ),
    '{}'
  );
  return new;
end;
$$;

drop trigger if exists weddings_normalize_languages on public.weddings;
create trigger weddings_normalize_languages
  before insert or update of languages on public.weddings
  for each row execute function public.normalize_wedding_languages();

-- A household's language changed (or a household came or went): refresh the
-- wedding's list. Security definer so guests changing their own language on
-- the RSVP page (and editors) always keep the list right.
create or replace function public.households_refresh_wedding_languages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.preferred_language is not distinct from old.preferred_language
     and new.wedding_id = old.wedding_id then
    return null;
  end if;
  update public.weddings set languages = languages
  where id in (
    select (case when tg_op = 'DELETE' then old.wedding_id else new.wedding_id end)
    union
    select (case when tg_op = 'UPDATE' then old.wedding_id else null end)
  );
  return null;
end;
$$;

drop trigger if exists households_refresh_languages on public.households;
create trigger households_refresh_languages
  after insert or update or delete on public.households
  for each row execute function public.households_refresh_wedding_languages();

revoke execute on function public.households_refresh_wedding_languages() from public, anon, authenticated;

-- Bring existing weddings in line.
update public.weddings set languages = languages;
