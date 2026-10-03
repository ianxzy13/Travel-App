-- Prompt B: Affiliate-ready travel links, click tracking, fare cache, group rate

-- ---------- outbound click log ----------

create table public.outbound_clicks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings (id) on delete cascade,
  guest_id uuid references public.guests (id) on delete set null,
  provider text not null check (char_length(provider) between 1 and 60),
  url text not null check (char_length(url) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.outbound_clicks enable row level security;

create policy "couple reads own clicks"
  on public.outbound_clicks for select
  using (wedding_id in (select wedding_id from public.wedding_members where user_id = auth.uid()));

create policy "insert via authenticated"
  on public.outbound_clicks for insert
  with check (wedding_id in (select wedding_id from public.wedding_members where user_id = auth.uid()));

create index outbound_clicks_wedding_idx on public.outbound_clicks (wedding_id, created_at desc);

-- ---------- fare cache ----------

create table public.fare_cache (
  id uuid primary key default gen_random_uuid(),
  origin text not null check (char_length(origin) = 3),
  destination text not null check (char_length(destination) = 3),
  depart_month text not null check (depart_month ~ '^\d{4}-\d{2}$'),
  price_eur numeric not null,
  airline text,
  fetched_at timestamptz not null default now(),
  unique (origin, destination, depart_month)
);

alter table public.fare_cache enable row level security;

create policy "anyone reads fare cache"
  on public.fare_cache for select
  using (true);

-- ---------- hotel group rate request ----------

alter type public.hotel_status add value if not exists 'rate_requested';
alter type public.hotel_status add value if not exists 'rate_received';
alter type public.hotel_status add value if not exists 'rate_signed';

alter table public.hotels
  add column group_rate_email text check (char_length(group_rate_email) <= 300),
  add column group_rate_notes text check (char_length(group_rate_notes) <= 1000),
  add column hold_date date,
  add column release_date date;
