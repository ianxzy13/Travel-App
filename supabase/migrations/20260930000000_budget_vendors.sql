-- =============================================================
-- Vow – Phase 5: budget, expenses, payments, vendors, file storage
-- Run after the phase 4 migration (Supabase → SQL Editor).
-- Money is stored as numeric(12,2) in the wedding's currency.
-- =============================================================

alter table public.weddings
  add column budget_total numeric(12, 2) check (budget_total >= 0);

-- ---------- budget categories ----------

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  allocated numeric(12, 2) not null default 0 check (allocated >= 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index budget_categories_wedding_idx on public.budget_categories (wedding_id, sort_order);

-- ---------- vendors ----------

create type public.vendor_status as enum ('researching', 'contacted', 'quoted', 'booked', 'rejected');

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category_id uuid,
  contact_name text check (char_length(contact_name) <= 120),
  email text check (char_length(email) <= 320),
  phone text check (char_length(phone) <= 50),
  website text check (char_length(website) <= 300),
  instagram text check (char_length(instagram) <= 100),
  address text check (char_length(address) <= 300),
  quote numeric(12, 2) check (quote >= 0),
  status public.vendor_status not null default 'researching',
  notes text check (char_length(notes) <= 4000),
  -- file in the "wedding-files" storage bucket
  contract_path text check (char_length(contract_path) <= 500),
  contract_name text check (char_length(contract_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id),
  -- deleting a category keeps the vendor, just uncategorised
  foreign key (category_id, wedding_id)
    references public.budget_categories (id, wedding_id) on delete set null (category_id)
);
create index vendors_wedding_idx on public.vendors (wedding_id);

-- ---------- expenses ----------

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  category_id uuid not null,
  vendor_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  estimated numeric(12, 2) not null default 0 check (estimated >= 0),
  -- null until the final price is known
  actual numeric(12, 2) check (actual >= 0),
  notes text check (char_length(notes) <= 4000),
  receipt_path text check (char_length(receipt_path) <= 500),
  receipt_name text check (char_length(receipt_name) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id),
  foreign key (category_id, wedding_id)
    references public.budget_categories (id, wedding_id) on delete cascade,
  foreign key (vendor_id, wedding_id)
    references public.vendors (id, wedding_id) on delete set null (vendor_id)
);
create index expenses_wedding_idx on public.expenses (wedding_id);
create index expenses_category_idx on public.expenses (category_id);
create index expenses_vendor_idx on public.expenses (vendor_id);

-- ---------- payments (deposits / instalments) ----------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  expense_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date,
  paid boolean not null default false,
  paid_on date,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (expense_id, wedding_id)
    references public.expenses (id, wedding_id) on delete cascade
);
create index payments_wedding_idx on public.payments (wedding_id, due_date);
create index payments_expense_idx on public.payments (expense_id);

-- updated_at + RLS (members read, owners/editors change)
do $$
declare
  t text;
begin
  foreach t in array array['budget_categories', 'vendors', 'expenses', 'payments'] loop
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
-- Private file storage for receipts, contracts (and later photos).
-- Files live at  <wedding_id>/<folder>/<file>. Only members of that
-- wedding can read them; owners/editors can upload and delete.
-- =============================================================

-- The first folder of a storage path, if it is a wedding the user belongs to.
create or replace function public.storage_wedding_access(object_name text, need_edit boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  wid uuid;
begin
  begin
    wid := split_part(object_name, '/', 1)::uuid;
  exception when others then
    return false; -- not a wedding folder
  end;
  if need_edit then
    return public.can_edit_wedding(wid);
  end if;
  return public.is_wedding_member(wid);
end;
$$;

do $$
begin
  -- Supabase has a "storage" schema; plain Postgres (e.g. local tests) doesn't.
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'wedding-files', 'wedding-files', false, 10485760,
      array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'application/pdf']
    )
    on conflict (id) do nothing;

    execute $p$
      create policy "wedding_files_select" on storage.objects for select to authenticated
        using (bucket_id = 'wedding-files' and public.storage_wedding_access(name, false))
    $p$;
    execute $p$
      create policy "wedding_files_insert" on storage.objects for insert to authenticated
        with check (bucket_id = 'wedding-files' and public.storage_wedding_access(name, true))
    $p$;
    execute $p$
      create policy "wedding_files_update" on storage.objects for update to authenticated
        using (bucket_id = 'wedding-files' and public.storage_wedding_access(name, true))
    $p$;
    execute $p$
      create policy "wedding_files_delete" on storage.objects for delete to authenticated
        using (bucket_id = 'wedding-files' and public.storage_wedding_access(name, true))
    $p$;
  end if;
end;
$$;
