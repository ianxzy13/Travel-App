-- =============================================================
-- Vow – Phase 1: profiles, weddings, collaborators (+ RLS)
-- Run this in Supabase → SQL Editor, or with `supabase db push`.
-- =============================================================

-- ---------- shared helpers ----------

create type public.member_role as enum ('owner', 'editor', 'viewer');

-- Keeps `updated_at` fresh on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles (one row per signed-up user) ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Automatically create a profile when someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- weddings ----------

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  partner_a_name text not null check (char_length(partner_a_name) between 1 and 80),
  partner_b_name text not null check (char_length(partner_b_name) between 1 and 80),
  wedding_date date,
  location text check (char_length(location) <= 200),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  estimated_guests integer check (estimated_guests between 0 and 5000),
  style_tags text[] not null default '{}',
  accent text not null default 'rose' check (accent in ('rose', 'sage')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger weddings_updated_at before update on public.weddings
  for each row execute function public.set_updated_at();

-- ---------- wedding_members (who can access which wedding) ----------

create table public.wedding_members (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  -- references profiles (which cascades from auth.users) so the API can join names
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, user_id)
);

create index wedding_members_user_id_idx on public.wedding_members (user_id);

create trigger wedding_members_updated_at before update on public.wedding_members
  for each row execute function public.set_updated_at();

-- ---------- wedding_invitations (pending collaborator invites) ----------

create table public.wedding_invitations (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  email text not null check (char_length(email) <= 320),
  role public.member_role not null default 'editor',
  -- 64 random hex characters; the secret part of the invite link
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wedding_invitations_wedding_id_idx on public.wedding_invitations (wedding_id);

create trigger wedding_invitations_updated_at before update on public.wedding_invitations
  for each row execute function public.set_updated_at();

-- =============================================================
-- Permission helpers
-- These are SECURITY DEFINER so RLS policies can call them without
-- recursively triggering the wedding_members policies.
-- Every later table (guests, budget, …) reuses them.
-- =============================================================

create or replace function public.is_wedding_member(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = wid and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_wedding(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = wid and user_id = auth.uid() and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_wedding_owner(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = wid and user_id = auth.uid() and role = 'owner'
  );
$$;

-- True when the current user and `other_user` share at least one wedding.
create or replace function public.shares_wedding_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.wedding_members me
    join public.wedding_members them on them.wedding_id = me.wedding_id
    where me.user_id = auth.uid() and them.user_id = other_user
  );
$$;

-- A wedding must always keep at least one owner.
create or replace function public.ensure_wedding_has_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Skip when the whole wedding is being deleted (cascade).
  if exists (select 1 from public.weddings where id = old.wedding_id)
     and not exists (
       select 1 from public.wedding_members
       where wedding_id = old.wedding_id and role = 'owner'
     ) then
    raise exception 'A wedding needs at least one owner.';
  end if;
  return null;
end;
$$;

create trigger wedding_members_keep_owner
  after update or delete on public.wedding_members
  for each row execute function public.ensure_wedding_has_owner();

-- =============================================================
-- Row Level Security
-- =============================================================

alter table public.profiles enable row level security;
alter table public.weddings enable row level security;
alter table public.wedding_members enable row level security;
alter table public.wedding_invitations enable row level security;

-- profiles: see yourself and people you plan a wedding with; edit only yourself.
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_wedding_with(id));
create policy "profiles_update_self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- weddings: members read, owners/editors edit, owners delete.
-- (Creating a wedding goes through the create_wedding() function below.)
create policy "weddings_select" on public.weddings for select to authenticated
  using (public.is_wedding_member(id));
create policy "weddings_update" on public.weddings for update to authenticated
  using (public.can_edit_wedding(id)) with check (public.can_edit_wedding(id));
create policy "weddings_delete" on public.weddings for delete to authenticated
  using (public.is_wedding_owner(id));

-- wedding_members: members see each other; owners manage; anyone may leave.
create policy "members_select" on public.wedding_members for select to authenticated
  using (public.is_wedding_member(wedding_id));
create policy "members_insert" on public.wedding_members for insert to authenticated
  with check (public.is_wedding_owner(wedding_id));
create policy "members_update" on public.wedding_members for update to authenticated
  using (public.is_wedding_owner(wedding_id)) with check (public.is_wedding_owner(wedding_id));
create policy "members_delete" on public.wedding_members for delete to authenticated
  using (public.is_wedding_owner(wedding_id) or user_id = auth.uid());

-- wedding_invitations: only owners can see and manage invites.
create policy "invitations_select" on public.wedding_invitations for select to authenticated
  using (public.is_wedding_owner(wedding_id));
create policy "invitations_insert" on public.wedding_invitations for insert to authenticated
  with check (public.is_wedding_owner(wedding_id) and invited_by = auth.uid());
create policy "invitations_delete" on public.wedding_invitations for delete to authenticated
  using (public.is_wedding_owner(wedding_id));

-- =============================================================
-- RPC functions called from the app
-- =============================================================

-- Creates a wedding and makes the caller its owner in one step.
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

  return new_id;
end;
$$;

-- Lets a signed-in user preview an invite before accepting it.
create or replace function public.get_invitation(invite_token text)
returns table (
  wedding_id uuid,
  partner_a_name text,
  partner_b_name text,
  role public.member_role,
  status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    w.id,
    w.partner_a_name,
    w.partner_b_name,
    i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end
  from public.wedding_invitations i
  join public.weddings w on w.id = i.wedding_id
  where i.token = invite_token;
$$;

-- Accepts an invite: adds the caller as a member and marks the invite used.
create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.wedding_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select * into inv from public.wedding_invitations
  where token = invite_token and accepted_at is null and expires_at > now()
  for update;

  if not found then
    raise exception 'This invitation is invalid or has expired.';
  end if;

  -- Already a member? Keep the existing role rather than downgrading.
  insert into public.wedding_members (wedding_id, user_id, role)
  values (inv.wedding_id, auth.uid(), inv.role)
  on conflict (wedding_id, user_id) do nothing;

  update public.wedding_invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = inv.id;

  return inv.wedding_id;
end;
$$;

-- Only signed-in users may call the RPCs.
revoke execute on function public.create_wedding(text, text, date, text, text, integer, text[], text) from public, anon;
revoke execute on function public.get_invitation(text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_wedding(text, text, date, text, text, integer, text[], text) to authenticated;
grant execute on function public.get_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
