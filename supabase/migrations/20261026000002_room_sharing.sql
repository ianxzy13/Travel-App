-- =============================================================
-- Vow: room sharing (RS1)
-- A room can have its own nickname ("Girls' room") and its own
-- capacity that overrides the room type (one room fits 6, one 4).
-- Safe to run more than once.
-- =============================================================

alter table public.hotel_rooms
  add column if not exists name text check (char_length(name) <= 60);

alter table public.hotel_rooms
  add column if not exists capacity integer check (capacity between 1 and 20);
