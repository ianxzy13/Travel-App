-- =============================================================
-- Vow – Save the Date: SD1 — upload, design, public page
-- =============================================================

create type public.std_template as enum ('elegant', 'modern', 'playful');

create table public.save_the_dates (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null unique references public.weddings (id) on delete cascade,
  media_path text check (char_length(media_path) <= 500),
  media_type text check (media_type is null or media_type in ('image', 'video')),
  template public.std_template not null default 'elegant',
  headline text not null default 'Save the Date' check (char_length(headline) <= 120),
  subline text check (char_length(subline) <= 200),
  message text check (char_length(message) <= 2000),
  token text not null unique default encode(gen_random_bytes(12), 'hex'),
  show_date boolean not null default true,
  show_location boolean not null default true,
  show_countdown boolean not null default true,
  published boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger save_the_dates_updated_at before update on public.save_the_dates
  for each row execute function public.set_updated_at();

-- ---------- RLS ----------

alter table public.save_the_dates enable row level security;

create policy "std_select" on public.save_the_dates
  for select to authenticated
  using (public.is_wedding_member(wedding_id));

create policy "std_insert" on public.save_the_dates
  for insert to authenticated
  with check (public.can_edit_wedding(wedding_id));

create policy "std_update" on public.save_the_dates
  for update to authenticated
  using (public.can_edit_wedding(wedding_id));

create policy "std_delete" on public.save_the_dates
  for delete to authenticated
  using (public.can_edit_wedding(wedding_id));

-- ---------- storage ----------

insert into storage.buckets (id, name, public)
values ('std-media', 'std-media', true)
on conflict (id) do nothing;

create policy "std_media_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'std-media' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.is_wedding_member(id)
  ));

create policy "std_media_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'std-media' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.can_edit_wedding(id)
  ));

create policy "std_media_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'std-media' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.can_edit_wedding(id)
  ));

create policy "std_media_anon_select" on storage.objects
  for select to anon
  using (bucket_id = 'std-media' and (storage.foldername(name))[1] in (
    select w.id::text from public.weddings w
    join public.save_the_dates s on s.wedding_id = w.id
    where s.published = true
  ));

-- ---------- public page RPC ----------

create or replace function public.get_save_the_date(p_token text)
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
    'accent', w.accent
  ) into result
  from public.save_the_dates s
  join public.weddings w on w.id = s.wedding_id
  where s.token = p_token and s.published = true;

  return result;
end;
$$;
