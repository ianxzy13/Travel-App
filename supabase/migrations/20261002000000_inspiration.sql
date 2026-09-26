-- =============================================================
-- Vow – Phase 7: inspiration boards, pins, comments, reactions,
-- colour palette, public board sharing
-- Run after the phase 6 migration (Supabase → SQL Editor).
-- =============================================================

create type public.pin_status as enum ('love', 'maybe');

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (char_length(description) <= 300),
  sort_order integer not null default 0,
  -- random token for the public read-only link /b/<share_id>; null = not shared
  share_id text unique check (share_id ~ '^[A-Za-z0-9_-]{16,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id)
);
create index boards_wedding_idx on public.boards (wedding_id, sort_order);

create table public.pins (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  board_id uuid not null,
  -- an uploaded file (private storage) OR an external https image (e.g. Unsplash)
  image_path text check (char_length(image_path) <= 500),
  image_url text check (char_length(image_url) <= 2000 and image_url ~ '^https://'),
  width integer check (width between 1 and 20000),
  height integer check (height between 1 and 20000),
  title text check (char_length(title) <= 200),
  note text check (char_length(note) <= 2000),
  source_url text check (char_length(source_url) <= 2000),
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  status public.pin_status,
  budget_category_id uuid,
  vendor_id uuid,
  -- photographer credit (required for Unsplash photos)
  credit_name text check (char_length(credit_name) <= 120),
  credit_url text check (char_length(credit_url) <= 500),
  unsplash_id text check (char_length(unsplash_id) <= 40),
  -- fractional order: moving a pin between two others just averages their values
  sort_order double precision not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wedding_id),
  check (image_path is not null or image_url is not null),
  foreign key (board_id, wedding_id) references public.boards (id, wedding_id) on delete cascade,
  foreign key (budget_category_id, wedding_id)
    references public.budget_categories (id, wedding_id) on delete set null (budget_category_id),
  foreign key (vendor_id, wedding_id)
    references public.vendors (id, wedding_id) on delete set null (vendor_id)
);
create index pins_board_idx on public.pins (board_id, sort_order);
create index pins_wedding_idx on public.pins (wedding_id, created_at desc);

create table public.pin_comments (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  pin_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (pin_id, wedding_id) references public.pins (id, wedding_id) on delete cascade
);
create index pin_comments_pin_idx on public.pin_comments (pin_id, created_at);

create table public.pin_reactions (
  pin_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  wedding_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (pin_id, user_id),
  foreign key (pin_id, wedding_id) references public.pins (id, wedding_id) on delete cascade
);

create table public.palette_colors (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  hex text not null check (hex ~ '^#[0-9a-f]{6}$'),
  source_pin_id uuid references public.pins (id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index palette_colors_wedding_idx on public.palette_colors (wedding_id, sort_order);

-- ---------- updated_at + RLS ----------
do $$
declare
  t text;
begin
  foreach t in array array['boards', 'pins', 'pin_comments', 'pin_reactions', 'palette_colors'] loop
    execute format(
      'create trigger %1$s_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%1$s_select" on public.%1$I for select to authenticated
         using (public.is_wedding_member(wedding_id))', t);
  end loop;

  -- boards, pins and the palette: owners/editors change them
  foreach t in array array['boards', 'pins', 'palette_colors'] loop
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

-- Comments and hearts: every member (viewers too) can add their own, and
-- only change or remove their own.
create policy "pin_comments_insert" on public.pin_comments for insert to authenticated
  with check (public.is_wedding_member(wedding_id) and user_id = auth.uid());
create policy "pin_comments_update" on public.pin_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pin_comments_delete" on public.pin_comments for delete to authenticated
  using (user_id = auth.uid());
create policy "pin_reactions_insert" on public.pin_reactions for insert to authenticated
  with check (public.is_wedding_member(wedding_id) and user_id = auth.uid());
create policy "pin_reactions_delete" on public.pin_reactions for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================
-- Public read-only boards (/b/<share_id>)
-- =============================================================

create or replace function public.get_shared_board(p_share_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', b.name,
    'description', b.description,
    'couple', w.partner_a_name || ' & ' || w.partner_b_name,
    'accent', w.accent,
    'pins', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'note', p.note,
        'image_path', p.image_path,
        'image_url', p.image_url,
        'width', p.width,
        'height', p.height,
        'source_url', p.source_url,
        'credit_name', p.credit_name,
        'credit_url', p.credit_url
      ) order by p.sort_order)
      from public.pins p where p.board_id = b.id
    ), '[]'::jsonb)
  )
  from public.boards b
  join public.weddings w on w.id = b.wedding_id
  where b.share_id = p_share_id;
$$;

-- True when a storage file is the image of a pin on a shared board.
create or replace function public.is_shared_pin_file(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pins p
    join public.boards b on b.id = p.board_id
    where p.image_path = object_name and b.share_id is not null
  );
$$;

revoke execute on function public.get_shared_board(text) from public;
grant execute on function public.get_shared_board(text) to anon, authenticated;
grant execute on function public.is_shared_pin_file(text) to anon, authenticated;

do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    -- Anyone with a shared board's link may view (not change) that board's uploaded images.
    execute $p$
      create policy "wedding_files_shared_pins" on storage.objects for select to anon, authenticated
        using (bucket_id = 'wedding-files' and public.is_shared_pin_file(name))
    $p$;
  end if;
end;
$$;
