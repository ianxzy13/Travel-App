-- =============================================================
-- Vow – SMS invitations for RSVP
-- Tracks SMS sends alongside email sends. Uses the same
-- household + kind pattern as email_sends.
-- =============================================================

create table public.sms_sends (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  kind text not null check (kind in ('invitation', 'reminder')),
  to_phone text not null check (char_length(to_phone) between 5 and 30),
  twilio_sid text,
  status text not null default 'sent' check (status in ('sent', 'delivered', 'failed')),
  error text check (char_length(error) <= 500),
  sent_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index sms_sends_wedding_idx on public.sms_sends (wedding_id, created_at desc);
alter table public.sms_sends enable row level security;

create policy "sms_sends_select" on public.sms_sends for select to authenticated
  using (public.is_wedding_member(wedding_id));
create policy "sms_sends_insert" on public.sms_sends for insert to authenticated
  with check (public.can_edit_wedding(wedding_id));
