-- =============================================================
-- Vow – fix guest photo uploads
-- Guests aren't signed in, and the database hides the weddings table from
-- them, so the storage rules "is photo sharing on for this wedding?" always
-- answered no and every guest upload failed ("Upload failed").
-- A small helper function looks it up with the right permissions instead.
-- Safe to run more than once.
-- =============================================================

create or replace function public.photo_sharing_open(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.weddings
    where id::text = p_folder and photos_enabled = true
  );
$$;

grant execute on function public.photo_sharing_open(text) to anon, authenticated;

-- Guests (signed in to Vow or not) can view and add photos while sharing is on.
drop policy if exists "photos_storage_anon_select" on storage.objects;
create policy "photos_storage_anon_select" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'photos' and public.photo_sharing_open((storage.foldername(name))[1]));

drop policy if exists "photos_storage_anon_insert" on storage.objects;
create policy "photos_storage_anon_insert" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'photos' and public.photo_sharing_open((storage.foldername(name))[1]));

drop policy if exists "wedding_photos_anon_select" on public.wedding_photos;
create policy "wedding_photos_anon_select" on public.wedding_photos
  for select to anon, authenticated
  using (public.photo_sharing_open(wedding_id::text));
