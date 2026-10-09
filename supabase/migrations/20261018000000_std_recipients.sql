-- =============================================================
-- Vow – Save the Date: SD2 — per-household send tracking
-- =============================================================

create type public.std_send_method as enum ('email', 'sms', 'whatsapp', 'manual');
create type public.std_send_status as enum (
  'not_sent', 'queued', 'sent', 'delivered', 'opened', 'failed', 'opted_out'
);

create table public.save_the_date_sends (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  save_the_date_id uuid not null references public.save_the_dates (id) on delete cascade,
  household_id uuid not null,
  -- per-household unguessable token for the public page
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  method public.std_send_method,
  method_override boolean not null default false,
  status public.std_send_status not null default 'not_sent',
  to_address text,
  resend_id text,
  error text check (char_length(error) <= 500),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (save_the_date_id, household_id),
  foreign key (household_id, wedding_id)
    references public.households (id, wedding_id) on delete cascade
);

create index std_sends_wedding_idx on public.save_the_date_sends (wedding_id);
create index std_sends_std_idx on public.save_the_date_sends (save_the_date_id);
create index std_sends_household_idx on public.save_the_date_sends (household_id);

create trigger std_sends_updated_at before update on public.save_the_date_sends
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------

alter table public.save_the_date_sends enable row level security;

create policy "std_sends_select" on public.save_the_date_sends
  for select to authenticated
  using (public.is_wedding_member(wedding_id));

create policy "std_sends_insert" on public.save_the_date_sends
  for insert to authenticated
  with check (public.can_edit_wedding(wedding_id));

create policy "std_sends_update" on public.save_the_date_sends
  for update to authenticated
  using (public.can_edit_wedding(wedding_id));

create policy "std_sends_delete" on public.save_the_date_sends
  for delete to authenticated
  using (public.can_edit_wedding(wedding_id));

-- ---------- public page: allow per-household token ----------

create or replace function public.get_save_the_date_by_household(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', s.id,
    'media_path', s.media_path,
    'media_type', s.media_type,
    'template', s.template,
    'headline', s.headline,
    'subline', s.subline,
    'message', s.message,
    'show_date', s.show_date,
    'show_location', s.show_location,
    'show_countdown', s.show_countdown,
    'partner_a_name', w.partner_a_name,
    'partner_b_name', w.partner_b_name,
    'wedding_date', w.wedding_date,
    'location', w.location,
    'accent', w.accent,
    'language', h.preferred_language
  ) into result
  from public.save_the_date_sends ss
  join public.save_the_dates s on s.id = ss.save_the_date_id
  join public.weddings w on w.id = s.wedding_id
  join public.households h on h.id = ss.household_id
  where ss.token = p_token and s.published = true;

  -- track open
  if result is not null then
    update public.save_the_date_sends
    set status = 'opened', opened_at = coalesce(opened_at, now())
    where token = p_token and status in ('sent', 'delivered');
  end if;

  return result;
end;
$$;
