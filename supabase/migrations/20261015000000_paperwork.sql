-- =============================================================
-- Vow – Prompt D: Marriage paperwork tracker
-- =============================================================

create table public.paperwork_items (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  person text not null check (person in ('partner_a', 'partner_b', 'shared')),
  title text not null check (char_length(title) between 1 and 200),
  template_key text check (char_length(template_key) <= 60),
  status text not null default 'not_started'
    check (status in ('not_started','requested','received','apostilled','translated','submitted')),
  responsible_id uuid references public.profiles (id) on delete set null,
  due_date date,
  notes text check (char_length(notes) <= 4000),
  file_path text check (char_length(file_path) <= 500),
  issue_date date,
  max_age_months integer check (max_age_months > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index paperwork_items_wedding_idx on public.paperwork_items (wedding_id);

-- updated_at trigger + RLS
do $$
declare t text;
begin
  foreach t in array array['paperwork_items'] loop
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

-- Private storage bucket for document scans
insert into storage.buckets (id, name, public)
values ('paperwork', 'paperwork', false)
on conflict (id) do nothing;

create policy "paperwork_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'paperwork' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.is_wedding_member(id)
  ));

create policy "paperwork_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'paperwork' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.can_edit_wedding(id)
  ));

create policy "paperwork_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'paperwork' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.can_edit_wedding(id)
  ));
