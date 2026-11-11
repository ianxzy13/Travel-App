-- =============================================================
-- Vow: paid plans (Free, Vow Plus for couples, Vow Pro for planners)
--
-- * subscriptions: one row per purchase, written ONLY by the payment
--   webhook (it uses the secret key). People can read their own rows.
-- * plan_overrides: give a wedding Plus or Pro for free (early users,
--   friends, demos). Set it in the Supabase table editor.
-- * wedding_plan(wid): the plan a wedding is on right now.
--     pro  = an owner or editor of the wedding has an active Vow Pro
--     plus = someone bought Vow Plus for this wedding
--     free = everything else
-- Safe to run more than once.
-- =============================================================

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- the wedding a Vow Plus purchase is for (Vow Pro covers all the buyer's weddings)
  wedding_id uuid references public.weddings (id) on delete set null,
  product text not null check (product in ('plus', 'pro')),
  -- 'recurring': renews every month; 'one_time': paid once, valid until valid_until
  kind text not null check (kind in ('recurring', 'one_time')),
  provider text not null default 'paddle' check (provider in ('paddle', 'apple', 'manual')),
  -- the provider's subscription id (recurring) or transaction id (one-time)
  provider_id text not null,
  provider_customer_id text,
  -- active, trialing, past_due, paused, canceled (recurring) or paid, refunded (one-time)
  status text not null,
  -- end of the paid period; null = no end known yet
  valid_until timestamptz,
  -- when a cancelled subscription stops (it stays active until then)
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_id)
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_wedding_idx on public.subscriptions (wedding_id);

drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

-- Read your own purchases. No insert/update/delete policies on purpose:
-- only the webhook (secret key, bypasses RLS) writes here.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions for select to authenticated
  using (user_id = auth.uid());

create table if not exists public.plan_overrides (
  wedding_id uuid primary key references public.weddings (id) on delete cascade,
  plan text not null check (plan in ('plus', 'pro')),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

alter table public.plan_overrides enable row level security;
-- Members may see it; nobody can change it from the app.
drop policy if exists "plan_overrides_select" on public.plan_overrides;
create policy "plan_overrides_select" on public.plan_overrides for select to authenticated
  using (public.is_wedding_member(wedding_id));

-- Is this purchase paying for something right now?
create or replace function public.subscription_active(status text, valid_until timestamptz)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select status in ('active', 'trialing', 'past_due', 'paid')
    and (valid_until is null or valid_until > now());
$$;

-- The plan of a wedding (internal: no permission check, not callable from the app).
create or replace function public.wedding_plan_internal(wid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.plan_overrides o where o.wedding_id = wid and o.plan = 'pro'
    ) or exists (
      select 1
      from public.subscriptions s
      join public.wedding_members m on m.user_id = s.user_id
      where m.wedding_id = wid
        and m.role::text in ('owner', 'editor')
        and s.product = 'pro'
        and public.subscription_active(s.status, s.valid_until)
    ) then 'pro'
    when exists (
      select 1 from public.plan_overrides o where o.wedding_id = wid and o.plan = 'plus'
    ) or exists (
      select 1
      from public.subscriptions s
      where s.wedding_id = wid
        and s.product = 'plus'
        and public.subscription_active(s.status, s.valid_until)
    ) then 'plus'
    else 'free'
  end;
$$;

-- The plan of a wedding, for its members ('free' for everyone else).
create or replace function public.wedding_plan(wid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_wedding_member(wid) then public.wedding_plan_internal(wid)
    else 'free'
  end;
$$;

-- Should the public wedding website show "Made with Vow"? (Free plan: yes.)
-- Guests are not signed in, so this only reveals yes or no.
create or replace function public.site_shows_branding(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.wedding_plan_internal(w.id) = 'free'
    from public.weddings w
    where w.slug = lower(trim(p_slug))
  ), true);
$$;

-- Does the signed-in person have an active Vow Pro?
create or replace function public.user_has_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.product = 'pro'
      and public.subscription_active(s.status, s.valid_until)
  );
$$;

revoke all on function public.wedding_plan_internal(uuid) from public, anon, authenticated;
revoke all on function public.wedding_plan(uuid) from public, anon;
revoke all on function public.user_has_pro() from public, anon;
grant execute on function public.wedding_plan(uuid) to authenticated;
grant execute on function public.user_has_pro() to authenticated;
grant execute on function public.site_shows_branding(text) to anon, authenticated;
