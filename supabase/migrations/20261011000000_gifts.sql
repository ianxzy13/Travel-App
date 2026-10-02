-- =============================================================
-- Vow – Phase 15: Gift Tracker & Thank-You Notes
-- Track gifts received (cash, registry items, handmade, etc.),
-- link them to households on the guest list, and mark thank-you
-- notes as sent.
-- =============================================================

create type public.gift_category as enum (
  'cash', 'registry', 'handmade', 'experience', 'other'
);

create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  amount numeric(12, 2) check (amount is null or amount >= 0),
  household_id uuid references public.households (id) on delete set null,
  from_name text not null check (char_length(from_name) between 1 and 120),
  category public.gift_category not null default 'other',
  received_on date,
  thank_you_sent boolean not null default false,
  thank_you_sent_on date,
  notes text check (char_length(notes) <= 500),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gifts_wedding_idx on public.gifts (wedding_id, sort_order);

-- updated_at trigger + RLS (same loop pattern as other tables)
do $$
begin
  execute 'create trigger gifts_updated_at before update on public.gifts
     for each row execute function public.set_updated_at()';
  execute 'alter table public.gifts enable row level security';
  execute 'create policy "gifts_select" on public.gifts for select to authenticated
     using (public.is_wedding_member(wedding_id))';
  execute 'create policy "gifts_insert" on public.gifts for insert to authenticated
     with check (public.can_edit_wedding(wedding_id))';
  execute 'create policy "gifts_update" on public.gifts for update to authenticated
     using (public.can_edit_wedding(wedding_id))
     with check (public.can_edit_wedding(wedding_id))';
  execute 'create policy "gifts_delete" on public.gifts for delete to authenticated
     using (public.can_edit_wedding(wedding_id))';
end;
$$;
