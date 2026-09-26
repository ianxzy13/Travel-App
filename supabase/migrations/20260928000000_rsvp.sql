-- =============================================================
-- Vow – Phase 3: RSVP codes, meal options, responses, emails,
-- notifications, public RSVP functions
-- Run after the phase 2 migration (Supabase → SQL Editor).
-- =============================================================

-- ---------- helpers ----------

-- Lower-case and strip common accents ("José" → "jose") for name matching and slugs.
create or replace function public.fold(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select translate(
    lower(coalesce(t, '')),
    'áàâäãåāéèêëēíìîïīóòôöõøōúùûüūñçćčšžýÿ',
    'aaaaaaaeeeeeiiiiiooooooouuuuuncccszyy'
  );
$$;

-- 6-character code like "K7P2QX". 32 letters/digits without look-alikes
-- (no 0/O, 1/I), so ~1 billion combinations. Randomness comes from
-- gen_random_uuid(), which uses a cryptographically secure generator;
-- 256 is divisible by 32, so every character is equally likely.
create or replace function public.generate_rsvp_code()
returns text
language plpgsql
volatile
-- definer rights: must check codes of ALL weddings, not just the ones RLS shows
security definer
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  bytes bytea;
  code text;
begin
  loop
    bytes := uuid_send(gen_random_uuid());
    code := '';
    for i in 0..5 loop
      code := code || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.households where rsvp_code = code);
  end loop;
  return code;
end;
$$;

-- "Ian", "María" → "ian-and-maria" (adds -2, -3… if already taken).
create or replace function public.unique_wedding_slug(a text, b text)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  base := regexp_replace(public.fold(a) || '-and-' || public.fold(b), '[^a-z0-9]+', '-', 'g');
  base := trim(both '-' from left(trim(both '-' from base), 50));
  if length(base) < 3 then
    base := 'wedding';
  end if;
  candidate := base;
  while exists (select 1 from public.weddings where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- ---------- weddings: public slug + RSVP settings ----------

alter table public.weddings
  add column slug text,
  add column rsvp_deadline date,
  add column rsvp_contact text check (char_length(rsvp_contact) <= 300),
  add column rsvp_ask_song boolean not null default true,
  add column rsvp_notify_email boolean not null default false;

update public.weddings set slug = public.unique_wedding_slug(partner_a_name, partner_b_name);

alter table public.weddings
  alter column slug set not null,
  add constraint weddings_slug_key unique (slug),
  add constraint weddings_slug_format check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60
  );

-- ---------- households: RSVP code + household-level answers ----------

alter table public.households
  add column rsvp_code text,
  add column rsvp_song_request text check (char_length(rsvp_song_request) <= 200),
  add column rsvp_message text check (char_length(rsvp_message) <= 2000),
  add column rsvp_responded_at timestamptz;

update public.households set rsvp_code = public.generate_rsvp_code();

alter table public.households
  alter column rsvp_code set not null,
  alter column rsvp_code set default public.generate_rsvp_code(),
  add constraint households_rsvp_code_key unique (rsvp_code),
  add constraint households_rsvp_code_format check (rsvp_code ~ '^[2-9A-HJ-NP-Z]{6}$');

-- ---------- events: which ones ask for a meal choice ----------

alter table public.events add column meal_choice boolean not null default false;
update public.events set meal_choice = true where public.fold(name) like '%reception%' or public.fold(name) like '%dinner%';

-- ---------- meal options ----------

create table public.meal_options (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (char_length(description) <= 300),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index meal_options_wedding_idx on public.meal_options (wedding_id, sort_order);

-- ---------- RSVP answers: one per guest per event ----------

create type public.rsvp_status as enum ('attending', 'declined');

create table public.rsvp_responses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  guest_id uuid not null,
  event_id uuid not null,
  status public.rsvp_status not null,
  meal_option_id uuid,
  -- who filled it in: the guest (public page) or the couple (dashboard)
  responded_by text not null default 'guest' check (responded_by in ('guest', 'couple')),
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (guest_id, event_id),
  foreign key (guest_id, wedding_id) references public.guests (id, wedding_id) on delete cascade,
  foreign key (event_id, wedding_id) references public.events (id, wedding_id) on delete cascade,
  -- an answer only exists for an actual invitation; un-inviting removes it
  foreign key (guest_id, event_id)
    references public.guest_event_invites (guest_id, event_id) on delete cascade,
  -- deleting a meal option clears the choice but keeps the answer
  foreign key (meal_option_id, wedding_id)
    references public.meal_options (id, wedding_id) on delete set null (meal_option_id)
);
create index rsvp_responses_wedding_idx on public.rsvp_responses (wedding_id);
create index rsvp_responses_event_idx on public.rsvp_responses (event_id);

-- ---------- log of invitation / reminder emails ----------

create table public.email_sends (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  household_id uuid not null,
  kind text not null check (kind in ('invitation', 'reminder')),
  to_emails text[] not null,
  -- id Resend gives the email; used to match delivery/open webhooks
  resend_id text unique,
  status text not null default 'sent'
    check (status in ('sent', 'delivered', 'opened', 'bounced', 'complained', 'failed')),
  error text,
  sent_by uuid references public.profiles (id) on delete set null,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, wedding_id)
    references public.households (id, wedding_id) on delete cascade
);
create index email_sends_household_idx on public.email_sends (household_id, created_at desc);
create index email_sends_wedding_idx on public.email_sends (wedding_id);

-- ---------- in-app notifications (one row per person) ----------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (char_length(type) <= 40),
  title text not null check (char_length(title) <= 200),
  body text check (char_length(body) <= 1000),
  link text check (char_length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, wedding_id, created_at desc);

-- ---------- triggers + RLS ----------

do $$
declare
  t text;
begin
  foreach t in array array['meal_options', 'rsvp_responses', 'email_sends'] loop
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

create trigger notifications_updated_at before update on public.notifications
  for each row execute function public.set_updated_at();
alter table public.notifications enable row level security;
-- Everyone only sees and manages their own notifications. They are created
-- by the security-definer functions below, never directly.
create policy "notifications_select" on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy "notifications_update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications_delete" on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================
-- Public RSVP functions
-- Guests have no account. They can ONLY reach their own household's data,
-- through these functions and the secret code. They can't read tables.
-- =============================================================

-- Everything the RSVP page needs for one household code (or null).
create or replace function public.get_rsvp(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  h public.households%rowtype;
begin
  select * into h from public.households where rsvp_code = upper(trim(p_code));
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'wedding', (
      select jsonb_build_object(
        'id', w.id,
        'slug', w.slug,
        'partner_a_name', w.partner_a_name,
        'partner_b_name', w.partner_b_name,
        'wedding_date', w.wedding_date,
        'location', w.location,
        'accent', w.accent,
        'rsvp_deadline', w.rsvp_deadline,
        'rsvp_contact', w.rsvp_contact,
        'rsvp_ask_song', w.rsvp_ask_song,
        'deadline_passed', w.rsvp_deadline is not null and current_date > w.rsvp_deadline
      )
      from public.weddings w where w.id = h.wedding_id
    ),
    'household', jsonb_build_object(
      'id', h.id,
      'name', h.name,
      'code', h.rsvp_code,
      'song_request', h.rsvp_song_request,
      'message', h.rsvp_message,
      'responded_at', h.rsvp_responded_at
    ),
    'guests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'first_name', g.first_name,
        'last_name', g.last_name,
        'plus_one_of', g.plus_one_of,
        'age_group', g.age_group,
        'dietary', g.dietary
      ) order by g.plus_one_of is not null, g.created_at)
      from public.guests g where g.household_id = h.id
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'event_date', e.event_date,
        'start_time', e.start_time,
        'end_time', e.end_time,
        'venue_name', e.venue_name,
        'address', e.address,
        'dress_code', e.dress_code,
        'description', e.description,
        'meal_choice', e.meal_choice
      ) order by e.sort_order)
      from public.events e
      where exists (
        select 1 from public.guest_event_invites i
        join public.guests g on g.id = i.guest_id
        where i.event_id = e.id and g.household_id = h.id
      )
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('guest_id', i.guest_id, 'event_id', i.event_id))
      from public.guest_event_invites i
      join public.guests g on g.id = i.guest_id
      where g.household_id = h.id
    ), '[]'::jsonb),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'guest_id', r.guest_id,
        'event_id', r.event_id,
        'status', r.status,
        'meal_option_id', r.meal_option_id
      ))
      from public.rsvp_responses r
      join public.guests g on g.id = r.guest_id
      where g.household_id = h.id
    ), '[]'::jsonb),
    'meal_options', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'description', m.description)
        order by m.sort_order, m.created_at)
      from public.meal_options m where m.wedding_id = h.wedding_id
    ), '[]'::jsonb)
  );
end;
$$;

-- Saves a household's answers. Guests may only answer for people in their
-- household and events those people are invited to. p_as_couple = true is
-- for the couple recording a reply (requires edit access; ignores the deadline).
create or replace function public.submit_rsvp(
  p_code text,
  p_payload jsonb,
  p_as_couple boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  h public.households%rowtype;
  w public.weddings%rowtype;
  r record;
  was_responded boolean;
  n_attending integer;
  n_declined integer;
begin
  select * into h from public.households where rsvp_code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'rsvp_not_found';
  end if;
  select * into w from public.weddings where id = h.wedding_id;

  if p_as_couple then
    if not public.can_edit_wedding(w.id) then
      raise exception 'not_allowed';
    end if;
  elsif w.rsvp_deadline is not null and current_date > w.rsvp_deadline then
    raise exception 'deadline_passed';
  end if;

  was_responded := h.rsvp_responded_at is not null;

  -- 1. attending / not attending (+ meal) per guest per event
  for r in
    select * from jsonb_to_recordset(coalesce(p_payload -> 'responses', '[]'::jsonb))
      as x(guest_id uuid, event_id uuid, status text, meal_option_id uuid)
  loop
    if r.status is null or r.status not in ('attending', 'declined') then
      raise exception 'invalid_status';
    end if;
    if not exists (
      select 1 from public.guest_event_invites i
      join public.guests g on g.id = i.guest_id
      where i.guest_id = r.guest_id and i.event_id = r.event_id and g.household_id = h.id
    ) then
      raise exception 'invalid_guest_or_event';
    end if;

    insert into public.rsvp_responses
      (wedding_id, guest_id, event_id, status, meal_option_id, responded_by, responded_at)
    values (
      w.id, r.guest_id, r.event_id, r.status::public.rsvp_status,
      -- keep a meal only if attending, the event asks for one, and it's this wedding's option
      case when r.status = 'attending'
        and exists (select 1 from public.events e where e.id = r.event_id and e.meal_choice)
        and exists (select 1 from public.meal_options m where m.id = r.meal_option_id and m.wedding_id = w.id)
      then r.meal_option_id end,
      case when p_as_couple then 'couple' else 'guest' end,
      now()
    )
    on conflict (guest_id, event_id) do update set
      status = excluded.status,
      meal_option_id = excluded.meal_option_id,
      responded_by = excluded.responded_by,
      responded_at = now();
  end loop;

  -- 2. per-person details: dietary notes; names only for plus-ones
  for r in
    select * from jsonb_to_recordset(coalesce(p_payload -> 'guests', '[]'::jsonb))
      as x(id uuid, dietary text, first_name text, last_name text)
  loop
    update public.guests g set
      dietary = case when r.dietary is null then g.dietary
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

  -- 4. summary: guests coming to at least one event / declined everything they answered
  select
    count(*) filter (where bool_or_attending),
    count(*) filter (where not bool_or_attending)
  into n_attending, n_declined
  from (
    select bool_or(r2.status = 'attending') as bool_or_attending
    from public.rsvp_responses r2
    join public.guests g on g.id = r2.guest_id
    where g.household_id = h.id
    group by r2.guest_id
  ) s;

  -- 5. tell everyone planning this wedding (only for replies from guests)
  if not p_as_couple then
    insert into public.notifications (wedding_id, user_id, type, title, body, link)
    select w.id, m.user_id, 'rsvp',
      h.name || case when was_responded then ' updated their RSVP' else ' replied' end,
      format('%s attending, %s not attending', n_attending, n_declined),
      '/app/rsvp?household=' || h.id
    from public.wedding_members m
    where m.wedding_id = w.id;
  end if;

  return jsonb_build_object(
    'household_id', h.id,
    'household_name', h.name,
    'wedding_id', w.id,
    'attending', n_attending,
    'declined', n_declined,
    'updated', was_responded
  );
end;
$$;

-- Public wedding basics for the "find your invitation" page.
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
    'rsvp_contact', w.rsvp_contact
  )
  from public.weddings w where w.slug = lower(trim(p_slug));
$$;

-- Finds a household's RSVP code by a guest's full name ("Ann Smith").
-- Returns null when there's no match or the name is ambiguous.
create or replace function public.find_rsvp_code(p_slug text, p_name text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  wanted text := regexp_replace(public.fold(trim(p_name)), '\s+', ' ', 'g');
  codes text[];
begin
  if char_length(wanted) < 3 then
    return null;
  end if;
  select array_agg(distinct h.rsvp_code) into codes
  from public.guests g
  join public.households h on h.id = g.household_id
  join public.weddings w on w.id = g.wedding_id
  where w.slug = lower(trim(p_slug))
    and regexp_replace(public.fold(trim(g.first_name || ' ' || g.last_name)), '\s+', ' ', 'g') = wanted;
  if codes is null or array_length(codes, 1) <> 1 then
    return null;
  end if;
  return codes[1];
end;
$$;

-- Marks a Resend email delivered/opened/bounced (called by the webhook with the secret key).
create or replace function public.record_email_event(p_resend_id text, p_event text, p_at timestamptz)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.email_sends set
    status = case
      when p_event = 'email.bounced' then 'bounced'
      when p_event = 'email.complained' then 'complained'
      when p_event = 'email.opened' and status in ('sent', 'delivered') then 'opened'
      when p_event = 'email.delivered' and status = 'sent' then 'delivered'
      else status end,
    delivered_at = case when p_event = 'email.delivered' then coalesce(delivered_at, p_at) else delivered_at end,
    opened_at = case when p_event = 'email.opened' then coalesce(opened_at, p_at) else opened_at end
  where resend_id = p_resend_id;
$$;

revoke execute on function public.get_rsvp(text) from public;
revoke execute on function public.submit_rsvp(text, jsonb, boolean) from public;
revoke execute on function public.get_wedding_public(text) from public;
revoke execute on function public.find_rsvp_code(text, text) from public;
revoke execute on function public.record_email_event(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.get_rsvp(text) to anon, authenticated;
grant execute on function public.submit_rsvp(text, jsonb, boolean) to anon, authenticated;
grant execute on function public.get_wedding_public(text) to anon, authenticated;
grant execute on function public.find_rsvp_code(text, text) to anon, authenticated;
grant execute on function public.record_email_event(text, text, timestamptz) to service_role;

-- =============================================================
-- New weddings: slug, and the Reception asks for meals.
-- =============================================================

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
    estimated_guests, style_tags, accent, created_by, slug
  )
  values (
    p_partner_a_name, p_partner_b_name, p_wedding_date, p_location, p_currency,
    p_estimated_guests, coalesce(p_style_tags, '{}'), coalesce(p_accent, 'rose'), auth.uid(),
    public.unique_wedding_slug(p_partner_a_name, p_partner_b_name)
  )
  returning id into new_id;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  insert into public.events (wedding_id, name, event_date, sort_order, meal_choice)
  values (new_id, 'Ceremony', p_wedding_date, 0, false),
         (new_id, 'Reception', p_wedding_date, 1, true);

  return new_id;
end;
$$;
