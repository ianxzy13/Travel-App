-- =============================================================
-- Vow – Phase 8: wedding website (templates, sections, publishing,
-- password protection)
-- Run after the phase 7 migration (Supabase → SQL Editor).
-- =============================================================

-- Passwords are hashed with bcrypt from pgcrypto (Supabase has it in the
-- "extensions" schema already; this line is a no-op there).
create extension if not exists pgcrypto with schema extensions;

create type public.site_template as enum ('classic', 'modern', 'garden', 'boho', 'beach');
create type public.site_section as enum (
  'home', 'story', 'events', 'travel', 'party', 'rsvp', 'registry', 'faq', 'gallery'
);

-- One row per wedding: look and publishing state. The site lives at /w/<weddings.slug>.
create table public.website_settings (
  wedding_id uuid primary key references public.weddings (id) on delete cascade,
  template public.site_template not null default 'classic',
  -- null = use the template's own colour / fonts
  accent_color text check (accent_color ~ '^#[0-9a-f]{6}$'),
  heading_font text check (heading_font in ('cormorant', 'playfair', 'fraunces', 'josefin', 'inter', 'great-vibes')),
  body_font text check (body_font in ('inter', 'lora', 'nunito', 'josefin')),
  hero_path text check (char_length(hero_path) <= 500),
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sections of the one-page site, in order. `content` holds the section's own
-- texts/lists (e.g. FAQ items); events and hotels come from their own tables.
create table public.website_sections (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  kind public.site_section not null,
  sort_order integer not null default 0,
  visible boolean not null default true,
  content jsonb not null default '{}'::jsonb
    check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 200000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, kind)
);

-- Password hash + the token stored in a visitor's cookie after they type the
-- password. RLS on, no policies: only the functions below can touch it, so
-- not even collaborators can read the hash.
create table public.website_secrets (
  wedding_id uuid primary key references public.weddings (id) on delete cascade,
  password_hash text not null,
  -- changes whenever the password changes, which logs everyone out
  access_token text not null,
  updated_at timestamptz not null default now()
);

do $$
declare
  t text;
begin
  foreach t in array array['website_settings', 'website_sections'] loop
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s_select" on public.%1$I for select to authenticated
         using (public.is_wedding_member(wedding_id))', t);
    execute format(
      'create policy "%1$s_update" on public.%1$I for update to authenticated
         using (public.can_edit_wedding(wedding_id))
         with check (public.can_edit_wedding(wedding_id))', t);
  end loop;
end;
$$;
-- Rows are created automatically (below); sections can't be added or removed, only hidden.
alter table public.website_secrets enable row level security;

-- ---------- default content for every wedding ----------

create or replace function public.create_default_website(wid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.website_settings (wedding_id) values (wid) on conflict do nothing;
  insert into public.website_sections (wedding_id, kind, sort_order, content)
  select wid, s.kind::public.site_section, s.ord, s.content
  from (values
    ('home', 0, jsonb_build_object('tagline', 'We''re getting married')),
    ('story', 1, jsonb_build_object('intro', '', 'milestones', '[]'::jsonb)),
    ('events', 2, jsonb_build_object('intro', '')),
    ('travel', 3, jsonb_build_object('intro', '', 'notes', '')),
    ('rsvp', 4, jsonb_build_object('intro', 'We can''t wait to celebrate with you. Please let us know if you can make it.')),
    ('party', 5, jsonb_build_object('people', '[]'::jsonb)),
    ('registry', 6, jsonb_build_object('intro', '', 'links', '[]'::jsonb)),
    ('faq', 7, jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid()::text, 'question', 'Are children welcome?', 'answer', ''),
      jsonb_build_object('id', gen_random_uuid()::text, 'question', 'Is there parking at the venue?', 'answer', ''),
      jsonb_build_object('id', gen_random_uuid()::text, 'question', 'What should I wear?', 'answer', '')
    ))),
    ('gallery', 8, jsonb_build_object('photos', '[]'::jsonb))
  ) as s(kind, ord, content)
  on conflict (wedding_id, kind) do nothing;
$$;
revoke execute on function public.create_default_website(uuid) from public, anon, authenticated;

create or replace function public.weddings_create_website()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.create_default_website(new.id);
  return new;
end;
$$;

create trigger weddings_create_website after insert on public.weddings
  for each row execute function public.weddings_create_website();

-- existing weddings
select public.create_default_website(id) from public.weddings;

-- ---------- password ----------

-- Sets (or with null/empty, removes) the site password. Owners/editors only.
create or replace function public.set_site_password(p_wedding_id uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_wedding(p_wedding_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if coalesce(p_password, '') = '' then
    delete from public.website_secrets where wedding_id = p_wedding_id;
    return;
  end if;
  if char_length(p_password) not between 4 and 100 then
    raise exception 'password must be 4 to 100 characters' using errcode = '22023';
  end if;
  insert into public.website_secrets (wedding_id, password_hash, access_token)
  values (
    p_wedding_id,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    encode(extensions.gen_random_bytes(24), 'hex')
  )
  on conflict (wedding_id) do update
    set password_hash = excluded.password_hash, access_token = excluded.access_token, updated_at = now();
end;
$$;

-- Lets members see whether a password is set (never the password itself).
create or replace function public.site_has_password(p_wedding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_wedding_member(p_wedding_id)
    and exists (select 1 from public.website_secrets where wedding_id = p_wedding_id);
$$;

-- Checks a visitor's password; returns the cookie token when it's right.
create or replace function public.unlock_site(p_slug text, p_password text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.access_token
  from public.weddings w
  join public.website_secrets s on s.wedding_id = w.id
  where w.slug = lower(trim(p_slug))
    and s.password_hash = extensions.crypt(coalesce(p_password, ''), s.password_hash);
$$;

-- ---------- the public site ----------

-- Everything the public page shows. Returns null when there's no such site
-- or it isn't published (members can always preview). With a password and
-- no valid token it returns only {locked, couple, look} for the password page.
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
      'rsvp_deadline', w.rsvp_deadline
    ),
    'settings', look || jsonb_build_object('hero_path', s.hero_path),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object('kind', x.kind, 'content', x.content) order by x.sort_order)
      from public.website_sections x where x.wedding_id = w.id and x.visible
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'name', e.name, 'event_date', e.event_date,
        'start_time', e.start_time, 'end_time', e.end_time,
        'venue_name', e.venue_name, 'address', e.address,
        'dress_code', e.dress_code, 'description', e.description
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

-- True when a storage file is a picture of a published website
-- (<wedding_id>/website/...). Paths contain random ids, so they can't be guessed.
create or replace function public.is_public_site_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select split_part(object_name, '/', 2) = 'website'
    and exists (
      select 1 from public.website_settings s
      where s.published and s.wedding_id::text = split_part(object_name, '/', 1)
    );
$$;

revoke execute on function public.set_site_password(uuid, text) from public, anon;
revoke execute on function public.site_has_password(uuid) from public, anon;
revoke execute on function public.unlock_site(text, text) from public;
revoke execute on function public.get_public_site(text, text) from public;
revoke execute on function public.is_public_site_file(text) from public;
grant execute on function public.set_site_password(uuid, text) to authenticated;
grant execute on function public.site_has_password(uuid) to authenticated;
grant execute on function public.unlock_site(text, text) to anon, authenticated;
grant execute on function public.get_public_site(text, text) to anon, authenticated;
grant execute on function public.is_public_site_file(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    -- Visitors may view (not change) the pictures of published websites.
    execute $p$
      create policy "wedding_files_public_site" on storage.objects for select to anon, authenticated
        using (bucket_id = 'wedding-files' and public.is_public_site_file(name))
    $p$;
  end if;
end;
$$;
