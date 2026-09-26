-- =============================================================
-- Vow – Phase 9: to-dos, day-of schedule, reminder notifications
-- Run after the phase 8 migration (Supabase → SQL Editor).
-- =============================================================

-- ---------- to-dos ----------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text check (char_length(notes) <= 4000),
  due_date date,
  -- must be a member of the wedding (checked by a trigger below)
  assignee_id uuid references public.profiles (id) on delete set null,
  category text check (char_length(category) <= 40),
  -- optional shortcut to a page in the app, e.g. /app/venues
  link text check (link ~ '^/app(/[A-Za-z0-9/_#?=&-]*)?$' and char_length(link) <= 200),
  -- set for tasks from the suggested timeline, so they're only added once
  suggestion_key text check (char_length(suggestion_key) <= 60),
  done boolean not null default false,
  done_at timestamptz,
  done_by uuid references public.profiles (id) on delete set null,
  sort_order double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wedding_id, suggestion_key)
);
create index tasks_wedding_idx on public.tasks (wedding_id, done, due_date);
create index tasks_assignee_idx on public.tasks (assignee_id) where assignee_id is not null;

-- Keeps done_at/done_by in sync and checks the assignee belongs to the wedding.
create or replace function public.tasks_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee_id is not null and not exists (
    select 1 from public.wedding_members m where m.wedding_id = new.wedding_id and m.user_id = new.assignee_id
  ) then
    raise exception 'assignee must be part of this wedding' using errcode = '23514';
  end if;
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at := now();
    new.done_by := auth.uid();
  elsif not new.done then
    new.done_at := null;
    new.done_by := null;
  end if;
  return new;
end;
$$;

create trigger tasks_before_write before insert or update on public.tasks
  for each row execute function public.tasks_before_write();

-- "Maria assigned you a to-do" (not when you assign yourself).
create or replace function public.tasks_notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  who text;
begin
  if new.assignee_id is null or new.assignee_id = auth.uid() or new.done then return new; end if;
  if tg_op = 'UPDATE' and old.assignee_id is not distinct from new.assignee_id then return new; end if;
  select coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1), 'Someone') into who
    from public.profiles p where p.id = auth.uid();
  insert into public.notifications (wedding_id, user_id, type, title, body, link)
  values (
    new.wedding_id, new.assignee_id, 'task',
    coalesce(who, 'Someone') || ' gave you a to-do',
    new.title || case when new.due_date is not null then ' · due ' || to_char(new.due_date, 'FMDD Mon YYYY') else '' end,
    '/app/tasks?task=' || new.id
  );
  return new;
end;
$$;

create trigger tasks_notify_assignee after insert or update of assignee_id on public.tasks
  for each row execute function public.tasks_notify_assignee();

-- When someone leaves the wedding, their to-dos become unassigned.
create or replace function public.members_unassign_tasks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tasks set assignee_id = null
  where wedding_id = old.wedding_id and assignee_id = old.user_id;
  return old;
end;
$$;

create trigger wedding_members_unassign_tasks after delete on public.wedding_members
  for each row execute function public.members_unassign_tasks();

-- ---------- day-of schedule (run sheet) ----------

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  -- null = the wedding day itself (so it follows the date if that changes)
  day date,
  start_time time not null,
  duration_min integer check (duration_min between 0 and 1440),
  title text not null check (char_length(title) between 1 and 150),
  location text check (char_length(location) <= 200),
  -- who's in charge, e.g. "Photographer" or "Anna (maid of honour)"
  owner text check (char_length(owner) <= 120),
  notes text check (char_length(notes) <= 2000),
  vendor_id uuid,
  event_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vendor_id, wedding_id) references public.vendors (id, wedding_id) on delete set null (vendor_id),
  foreign key (event_id, wedding_id) references public.events (id, wedding_id) on delete set null (event_id)
);
create index schedule_items_wedding_idx on public.schedule_items (wedding_id, day, start_time);

-- ---------- triggers + RLS ----------

do $$
declare
  t text;
begin
  foreach t in array array['tasks', 'schedule_items'] loop
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
-- Reminder notifications
-- Checked at most once a day per wedding, when someone opens the app
-- (no scheduled job needed). Each reminder has a key so it's sent once.
-- =============================================================

alter table public.notifications add column dedupe_key text check (char_length(dedupe_key) <= 120);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key)
  where dedupe_key is not null;

alter table public.weddings add column reminders_checked_on date;

create or replace function public.sync_reminders(p_wedding_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := current_date;
  added integer := 0;
  n integer;
  cur text;
begin
  if not public.is_wedding_member(p_wedding_id) then return 0; end if;

  -- only once a day (the update also "claims" today, so parallel calls don't double up)
  update public.weddings set reminders_checked_on = today
  where id = p_wedding_id and reminders_checked_on is distinct from today
  returning currency into cur;
  if not found then return 0; end if;

  -- Payments due within 7 days, and overdue ones → owners and editors
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key)
  select p_wedding_id, m.user_id, 'payment',
    case when p.due_date < today then 'Payment overdue: ' else 'Payment due soon: ' end || e.name,
    to_char(p.amount, 'FM999G999G990D00') || ' ' || cur || ' · due ' || to_char(p.due_date, 'FMDD Mon YYYY'),
    '/app/budget',
    case when p.due_date < today then 'pay-late:' else 'pay-soon:' end || p.id || ':' || p.due_date
  from public.payments p
  join public.expenses e on e.id = p.expense_id
  join public.wedding_members m on m.wedding_id = p.wedding_id and m.role in ('owner', 'editor')
  where p.wedding_id = p_wedding_id and not p.paid and p.due_date is not null
    and p.due_date <= today + 7 and p.due_date >= today - 60
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count; added := added + n;

  -- Hotel room-block cut-offs within 14 days while rooms are still free
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key)
  select p_wedding_id, m.user_id, 'hotel',
    'Room block cut-off soon: ' || h.name,
    'Guests must book by ' || to_char(h.cutoff_date, 'FMDD Mon YYYY')
      || case when h.rooms_held is not null
           then format(' · %s of %s rooms booked', coalesce(h.rooms_booked, 0), h.rooms_held) else '' end,
    '/app/hotels',
    'cutoff:' || h.id || ':' || h.cutoff_date
  from public.hotels h
  join public.wedding_members m on m.wedding_id = h.wedding_id and m.role in ('owner', 'editor')
  where h.wedding_id = p_wedding_id and h.status <> 'rejected' and h.cutoff_date between today and today + 14
    and (h.rooms_held is null or coalesce(h.rooms_booked, 0) < h.rooms_held)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count; added := added + n;

  -- To-dos due within 3 days → the person they're assigned to
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key)
  select p_wedding_id, t.assignee_id, 'task',
    'Due ' || case when t.due_date = today then 'today' else to_char(t.due_date, 'FMDay') end || ': ' || t.title,
    null, '/app/tasks?task=' || t.id,
    'task-soon:' || t.id || ':' || t.due_date
  from public.tasks t
  where t.wedding_id = p_wedding_id and not t.done and t.assignee_id is not null
    and t.due_date between today and today + 3
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count; added := added + n;

  -- Overdue to-dos: one summary a week per person (their own + unassigned ones)
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key)
  select p_wedding_id, m.user_id, 'task',
    case when x.n = 1 then '1 to-do is overdue' else x.n || ' to-dos are overdue' end,
    x.first_title || case when x.n > 1 then ' and more' else '' end,
    '/app/tasks?show=overdue',
    'tasks-late:' || to_char(today, 'IYYY-IW')
  from public.wedding_members m
  cross join lateral (
    select count(*)::int as n, (array_agg(t.title order by t.due_date))[1] as first_title
    from public.tasks t
    where t.wedding_id = p_wedding_id and not t.done and t.due_date < today
      and (t.assignee_id = m.user_id or (t.assignee_id is null and m.role in ('owner', 'editor')))
  ) x
  where m.wedding_id = p_wedding_id and x.n > 0
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count; added := added + n;

  -- keep the list tidy: drop read reminders older than 90 days
  delete from public.notifications
  where wedding_id = p_wedding_id and read_at is not null and created_at < now() - interval '90 days';

  return added;
end;
$$;

revoke execute on function public.sync_reminders(uuid) from public, anon;
grant execute on function public.sync_reminders(uuid) to authenticated;
revoke execute on function public.tasks_before_write() from public, anon, authenticated;
revoke execute on function public.tasks_notify_assignee() from public, anon, authenticated;
revoke execute on function public.members_unassign_tasks() from public, anon, authenticated;
