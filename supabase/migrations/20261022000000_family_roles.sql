-- Phase 3: Family planners abroad — new roles
-- Adds "parent" and "helper" roles to the member_role enum.
-- Safe to run more than once (e.g. again in the Supabase SQL editor).

-- 1. Extend the enum
alter type public.member_role add value if not exists 'parent';
alter type public.member_role add value if not exists 'helper';

-- 2. Update can_edit_wedding to include parent (guests, tasks, travel, budget…)
create or replace function public.can_edit_wedding(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = wid and user_id = auth.uid()
      -- compared as text: a brand-new enum value can't be used in the same
      -- transaction that adds it (Postgres error 55P04)
      and role::text in ('owner', 'editor', 'parent')
  );
$$;

-- 3. New function: only owner/editor can change wedding settings or manage members
create or replace function public.can_manage_wedding(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.wedding_members
    where wedding_id = wid and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

-- 4. Tighten weddings table update policy (settings) to owner/editor only
drop policy if exists "weddings_update" on public.weddings;
create policy "weddings_update" on public.weddings for update to authenticated
  using (public.can_manage_wedding(id))
  with check (public.can_manage_wedding(id));

-- 5. Household "managed by" — which member manages a group of guests
alter table public.households
  add column if not exists managed_by uuid references public.wedding_members (id) on delete set null;

comment on column public.households.managed_by is 'The member (e.g. a parent) who manages this group of guests.';

-- 6. Task comments
create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);
alter table public.task_comments enable row level security;

drop policy if exists "task_comments_select" on public.task_comments;
create policy "task_comments_select" on public.task_comments for select to authenticated
  using (public.is_wedding_member(wedding_id));
drop policy if exists "task_comments_insert" on public.task_comments;
create policy "task_comments_insert" on public.task_comments for insert to authenticated
  with check (public.is_wedding_member(wedding_id) and author_id = auth.uid());
drop policy if exists "task_comments_delete" on public.task_comments;
create policy "task_comments_delete" on public.task_comments for delete to authenticated
  using (author_id = auth.uid());

-- 7. Member time zone
alter table public.wedding_members
  add column if not exists time_zone text check (char_length(time_zone) <= 60);

comment on column public.wedding_members.time_zone is 'IANA time zone of this member, e.g. America/New_York. Default from browser.';

-- 8. Activity feed view (last 30 items across the wedding)
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (char_length(kind) <= 30),
  subject text check (char_length(subject) <= 200),
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_wedding_idx on public.activity_log (wedding_id, created_at desc);
alter table public.activity_log enable row level security;

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log for select to authenticated
  using (public.is_wedding_member(wedding_id));
drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log for insert to authenticated
  with check (public.is_wedding_member(wedding_id));
