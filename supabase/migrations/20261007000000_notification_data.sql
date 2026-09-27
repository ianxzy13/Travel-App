-- =============================================================
-- Vow – Phase 11 (part 3): notifications in everyone's language.
-- Each notification also stores what it's about (kind + values) in `data`;
-- the app writes the text in the reader's language. The English title/body
-- stay as a fallback. Run after 20261006000000_household_languages.sql.
-- =============================================================

alter table public.notifications
  add column if not exists data jsonb
    check (data is null or (jsonb_typeof(data) = 'object' and pg_column_size(data) < 4000));

-- ---------- RSVP replies ----------
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
    insert into public.notifications (wedding_id, user_id, type, title, body, link, data)
    select w.id, m.user_id, 'rsvp',
      h.name || case when was_responded then ' updated their RSVP' else ' replied' end,
      format('%s attending, %s not attending', n_attending, n_declined),
      '/app/rsvp?household=' || h.id,
      jsonb_build_object(
        'kind', case when was_responded then 'rsvpUpdated' else 'rsvpReplied' end,
        'name', h.name, 'attending', n_attending, 'declined', n_declined)
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

-- ---------- "X gave you a to-do" ----------
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
  insert into public.notifications (wedding_id, user_id, type, title, body, link, data)
  values (
    new.wedding_id, new.assignee_id, 'task',
    coalesce(who, 'Someone') || ' gave you a to-do',
    new.title || case when new.due_date is not null then ' · due ' || to_char(new.due_date, 'FMDD Mon YYYY') else '' end,
    '/app/tasks?task=' || new.id,
    jsonb_build_object('kind', 'taskAssigned', 'who', coalesce(who, ''), 'title', new.title,
      'due', new.due_date)
  );
  return new;
end;
$$;

-- ---------- daily reminders ----------
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
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key, data)
  select p_wedding_id, m.user_id, 'payment',
    case when p.due_date < today then 'Payment overdue: ' else 'Payment due soon: ' end || e.name,
    to_char(p.amount, 'FM999G999G990D00') || ' ' || cur || ' · due ' || to_char(p.due_date, 'FMDD Mon YYYY'),
    '/app/budget',
    case when p.due_date < today then 'pay-late:' else 'pay-soon:' end || p.id || ':' || p.due_date,
    jsonb_build_object(
      'kind', case when p.due_date < today then 'paymentLate' else 'paymentSoon' end,
      'name', e.name, 'amount', p.amount, 'currency', cur, 'due', p.due_date)
  from public.payments p
  join public.expenses e on e.id = p.expense_id
  join public.wedding_members m on m.wedding_id = p.wedding_id and m.role in ('owner', 'editor')
  where p.wedding_id = p_wedding_id and not p.paid and p.due_date is not null
    and p.due_date <= today + 7 and p.due_date >= today - 60
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count; added := added + n;

  -- Hotel room-block cut-offs within 14 days while rooms are still free
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key, data)
  select p_wedding_id, m.user_id, 'hotel',
    'Room block cut-off soon: ' || h.name,
    'Guests must book by ' || to_char(h.cutoff_date, 'FMDD Mon YYYY')
      || case when h.rooms_held is not null
           then format(' · %s of %s rooms booked', coalesce(h.rooms_booked, 0), h.rooms_held) else '' end,
    '/app/hotels',
    'cutoff:' || h.id || ':' || h.cutoff_date,
    jsonb_build_object('kind', 'hotelCutoff', 'name', h.name, 'due', h.cutoff_date,
      'booked', coalesce(h.rooms_booked, 0), 'held', h.rooms_held)
  from public.hotels h
  join public.wedding_members m on m.wedding_id = h.wedding_id and m.role in ('owner', 'editor')
  where h.wedding_id = p_wedding_id and h.status <> 'rejected' and h.cutoff_date between today and today + 14
    and (h.rooms_held is null or coalesce(h.rooms_booked, 0) < h.rooms_held)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count; added := added + n;

  -- To-dos due within 3 days → the person they're assigned to
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key, data)
  select p_wedding_id, t.assignee_id, 'task',
    'Due ' || case when t.due_date = today then 'today' else to_char(t.due_date, 'FMDay') end || ': ' || t.title,
    null, '/app/tasks?task=' || t.id,
    'task-soon:' || t.id || ':' || t.due_date,
    jsonb_build_object('kind', case when t.due_date = today then 'taskDueToday' else 'taskDue' end,
      'title', t.title, 'due', t.due_date)
  from public.tasks t
  where t.wedding_id = p_wedding_id and not t.done and t.assignee_id is not null
    and t.due_date between today and today + 3
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count; added := added + n;

  -- Overdue to-dos: one summary a week per person (their own + unassigned ones)
  insert into public.notifications (wedding_id, user_id, type, title, body, link, dedupe_key, data)
  select p_wedding_id, m.user_id, 'task',
    case when x.n = 1 then '1 to-do is overdue' else x.n || ' to-dos are overdue' end,
    x.first_title || case when x.n > 1 then ' and more' else '' end,
    '/app/tasks?show=overdue',
    'tasks-late:' || to_char(today, 'IYYY-IW'),
    jsonb_build_object('kind', 'tasksOverdue', 'count', x.n, 'title', x.first_title)
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
