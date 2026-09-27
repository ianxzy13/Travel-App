-- =============================================================
-- Vow – Phase 11: languages (wedding languages, time zone, per-language
-- content for the website, events and meals; guests' preferred language)
-- Run after the phase 9 migration (Supabase → SQL Editor).
-- =============================================================

-- A language code like "en", "pt" or "zh-CN".
create or replace function public.is_language_code(code text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select code ~ '^[a-z]{2}(-[A-Z]{2})?$';
$$;

-- Translations are stored as { "<language>": { ...texts } }.
create or replace function public.is_translations(t jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(t) = 'object'
    and pg_column_size(t) < 400000
    and not exists (
      select 1 from jsonb_each(t) e
      where not public.is_language_code(e.key) or jsonb_typeof(e.value) <> 'object'
    );
$$;

-- ---------- weddings ----------
alter table public.weddings
  -- languages the wedding is presented in; the first one is the main language
  add column languages text[] not null default '{en}',
  -- IANA time zone of the venue, e.g. "Europe/Ljubljana" (event times are local times there)
  add column time_zone text check (char_length(time_zone) <= 64),
  -- per-language versions of short texts: { "sl": { "location": "…", "rsvp_contact": "…" } }
  add column translations jsonb not null default '{}' check (public.is_translations(translations));

alter table public.weddings add constraint weddings_languages_check check (
  cardinality(languages) between 1 and 25
  and array_position(languages, null) is null
  and public.is_language_code(languages[1])
);

-- ---------- per-language content ----------
alter table public.website_sections
  add column translations jsonb not null default '{}' check (public.is_translations(translations));
alter table public.events
  add column translations jsonb not null default '{}' check (public.is_translations(translations));
alter table public.meal_options
  add column translations jsonb not null default '{}' check (public.is_translations(translations));

-- ---------- people ----------
alter table public.households
  add column preferred_language text check (preferred_language is null or public.is_language_code(preferred_language));
-- languages each guest speaks (used by seating in phase 13)
alter table public.guests
  add column languages text[] not null default '{}' check (cardinality(languages) <= 10);
-- the app language each person chose for themselves
alter table public.profiles
  add column locale text check (locale is null or public.is_language_code(locale));

-- ---------- public functions ----------

-- Language info for a public page, so it can open in the right language.
-- p_kind: 'site' (/w/<slug>, /rsvp/<slug>), 'rsvp' (/r/<code>) or 'board' (/b/<share id>).
create or replace function public.get_page_languages(p_kind text, p_key text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'site' then (
      select jsonb_build_object('languages', w.languages, 'preferred', null)
      from public.weddings w where w.slug = lower(trim(p_key)))
    when 'rsvp' then (
      select jsonb_build_object('languages', w.languages, 'preferred', h.preferred_language)
      from public.households h join public.weddings w on w.id = h.wedding_id
      where h.rsvp_code = upper(trim(p_key)))
    when 'board' then (
      select jsonb_build_object('languages', w.languages, 'preferred', null)
      from public.boards b join public.weddings w on w.id = b.wedding_id
      where b.share_id = p_key)
  end;
$$;

-- Everything language-related for one RSVP code (complements get_rsvp()).
create or replace function public.get_rsvp_extras(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'languages', w.languages,
    'time_zone', w.time_zone,
    'translations', w.translations,
    'preferred_language', h.preferred_language,
    'events', coalesce((
      select jsonb_object_agg(e.id, e.translations) from public.events e
      where e.wedding_id = w.id and e.translations <> '{}'::jsonb), '{}'::jsonb),
    'meals', coalesce((
      select jsonb_object_agg(m.id, m.translations) from public.meal_options m
      where m.wedding_id = w.id and m.translations <> '{}'::jsonb), '{}'::jsonb)
  )
  from public.households h
  join public.weddings w on w.id = h.wedding_id
  where h.rsvp_code = upper(trim(p_code));
$$;

-- A guest picks their language on the RSVP page: remembered for emails and links.
create or replace function public.set_rsvp_language(p_code text, p_language text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_language_code(p_language) then
    raise exception 'invalid language' using errcode = '22023';
  end if;
  update public.households set preferred_language = p_language
  where rsvp_code = upper(trim(p_code));
end;
$$;

-- /rsvp/<slug> and the RSVP frame also need the languages.
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
    'translations', w.translations
  )
  from public.weddings w where w.slug = lower(trim(p_slug));
$$;

-- The public website, now with languages, time zone and translations.
create or replace function public.get_public_site(p_slug text, p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  w public.weddings;
  s public.website_settings;
  secret text;
  member boolean;
  look jsonb;
begin
  select * into w from public.weddings where slug = lower(trim(p_slug));
  if not found then return null; end if;
  select * into s from public.website_settings where wedding_id = w.id;
  if not found then return null; end if;

  member := public.is_wedding_member(w.id);
  if not s.published and not member then return null; end if;

  look := jsonb_build_object(
    'template', s.template, 'accent_color', s.accent_color,
    'heading_font', s.heading_font, 'body_font', s.body_font
  );

  select access_token into secret from public.website_secrets where wedding_id = w.id;
  if secret is not null and not member and p_token is distinct from secret then
    return jsonb_build_object(
      'locked', true,
      'couple', w.partner_a_name || ' & ' || w.partner_b_name,
      'languages', w.languages,
      'settings', look
    );
  end if;

  return jsonb_build_object(
    'locked', false,
    'published', s.published,
    'has_password', secret is not null,
    'wedding', jsonb_build_object(
      'slug', w.slug,
      'partner_a_name', w.partner_a_name,
      'partner_b_name', w.partner_b_name,
      'wedding_date', w.wedding_date,
      'location', w.location,
      'destination_airport', w.destination_airport,
      'rsvp_deadline', w.rsvp_deadline,
      'languages', w.languages,
      'time_zone', w.time_zone,
      'translations', w.translations
    ),
    'settings', look || jsonb_build_object('hero_path', s.hero_path),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('kind', x.kind, 'content', x.content, 'translations', x.translations) order by x.sort_order)
      from public.website_sections x where x.wedding_id = w.id and x.visible
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'event_date', e.event_date,
        'start_time', e.start_time, 'end_time', e.end_time,
        'venue_name', e.venue_name, 'address', e.address,
        'dress_code', e.dress_code, 'description', e.description,
        'translations', e.translations
      ) order by e.event_date nulls last, e.start_time nulls last, e.sort_order)
      from public.events e where e.wedding_id = w.id
    ), '[]'::jsonb),
    'hotels', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', h.id, 'name', h.name, 'address', h.address, 'distance', h.distance,
        'website', h.website, 'booking_url', h.booking_url,
        'price_per_night', h.price_per_night, 'discount_code', h.discount_code,
        'cutoff_date', h.cutoff_date
      ) order by h.name)
      from public.hotels h where h.wedding_id = w.id and h.show_on_website
    ), '[]'::jsonb),
    'currency', w.currency
  );
end;
$$;

revoke execute on function public.get_page_languages(text, text) from public;
revoke execute on function public.get_rsvp_extras(text) from public;
revoke execute on function public.set_rsvp_language(text, text) from public;
grant execute on function public.get_page_languages(text, text) to anon, authenticated;
grant execute on function public.get_rsvp_extras(text) to anon, authenticated;
grant execute on function public.set_rsvp_language(text, text) to anon, authenticated;
grant execute on function public.is_language_code(text) to anon, authenticated;
grant execute on function public.is_translations(jsonb) to anon, authenticated;
