-- =============================================================
-- Vow: room sharing (RS1). Paste into the Supabase SQL editor and click Run.
-- Adds an optional nickname and capacity to each hotel room.
-- Safe to run more than once.
-- =============================================================

alter table public.hotel_rooms
  add column if not exists name text check (char_length(name) <= 60);

alter table public.hotel_rooms
  add column if not exists capacity integer check (capacity between 1 and 20);
