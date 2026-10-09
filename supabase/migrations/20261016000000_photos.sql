-- =============================================================
-- Vow – Prompt E: Guest photo sharing by QR code
-- =============================================================

-- Add toggle to weddings
alter table public.weddings
  add column if not exists photos_enabled boolean not null default false;

-- Photo records
create table public.wedding_photos (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  uploader_name text not null check (char_length(uploader_name) between 1 and 100),
  file_path text not null check (char_length(file_path) between 1 and 500),
  caption text check (char_length(caption) <= 500),
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create index wedding_photos_wedding_idx on public.wedding_photos (wedding_id);

-- RLS: couple members can read/delete, guests upload via RPC
alter table public.wedding_photos enable row level security;

create policy "wedding_photos_select" on public.wedding_photos
  for select to authenticated
  using (public.is_wedding_member(wedding_id));

create policy "wedding_photos_delete" on public.wedding_photos
  for delete to authenticated
  using (public.can_edit_wedding(wedding_id));

-- Anon can also read (for the public gallery page)
create policy "wedding_photos_anon_select" on public.wedding_photos
  for select to anon
  using (
    exists (
      select 1 from public.weddings
      where id = wedding_id and photos_enabled = true
    )
  );

-- Public storage bucket for wedding photos (guests need to view them)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Storage policies: authenticated couple members can manage
create policy "photos_storage_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.is_wedding_member(id)
  ));

create policy "photos_storage_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.can_edit_wedding(id)
  ));

create policy "photos_storage_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where public.can_edit_wedding(id)
  ));

-- Anon can read photos from enabled weddings
create policy "photos_storage_anon_select" on storage.objects
  for select to anon
  using (bucket_id = 'photos' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where photos_enabled = true
  ));

-- Anon can upload to enabled weddings
create policy "photos_storage_anon_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] in (
    select id::text from public.weddings where photos_enabled = true
  ));

-- Security definer RPCs for guest (anon) usage

create or replace function public.upload_wedding_photo(
  p_slug text,
  p_uploader_name text,
  p_file_path text,
  p_caption text default null,
  p_width integer default null,
  p_height integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  wid uuid;
  photo_id uuid;
begin
  select id into wid
  from public.weddings
  where slug = p_slug and photos_enabled = true;

  if wid is null then
    raise exception 'photos_not_enabled';
  end if;

  insert into public.wedding_photos (wedding_id, uploader_name, file_path, caption, width, height)
  values (wid, p_uploader_name, p_file_path, p_caption, p_width, p_height)
  returning id into photo_id;

  return photo_id;
end;
$$;

create or replace function public.list_wedding_photos(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  wid uuid;
begin
  select id into wid
  from public.weddings
  where slug = p_slug and photos_enabled = true;

  if wid is null then return null; end if;

  return (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'uploader_name', p.uploader_name,
        'file_path', p.file_path,
        'caption', p.caption,
        'width', p.width,
        'height', p.height,
        'created_at', p.created_at
      ) order by p.created_at desc
    ), '[]'::jsonb)
    from public.wedding_photos p
    where p.wedding_id = wid
  );
end;
$$;

-- Minimal public info for the guest photo page (bypasses RLS)
create or replace function public.get_photo_page(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'id', w.id,
    'partner_a_name', w.partner_a_name,
    'partner_b_name', w.partner_b_name,
    'accent', w.accent
  ) into result
  from public.weddings w
  where w.slug = p_slug and w.photos_enabled = true;

  return result;
end;
$$;
