-- =============================================================
-- Vow: who's staying when
-- Each hotel gets the dates it is booked for (check-in/check-out),
-- and each guest can have their own arrival/departure. Empty guest
-- dates mean "same as the hotel's booked dates". Each hotel also
-- remembers how many people the couple puts in one room.
-- Safe to run more than once.
-- =============================================================

alter table public.hotels add column if not exists booked_from date;
alter table public.hotels add column if not exists booked_to date;
alter table public.hotels drop constraint if exists hotels_booked_dates_check;
alter table public.hotels add constraint hotels_booked_dates_check
  check (booked_from is null or booked_to is null or booked_to > booked_from);

alter table public.hotels add column if not exists people_per_room integer;
alter table public.hotels drop constraint if exists hotels_people_per_room_check;
alter table public.hotels add constraint hotels_people_per_room_check
  check (people_per_room is null or people_per_room >= 1);

alter table public.guests add column if not exists stay_from date;
alter table public.guests add column if not exists stay_to date;
alter table public.guests drop constraint if exists guests_stay_dates_check;
alter table public.guests add constraint guests_stay_dates_check
  check (stay_from is null or stay_to is null or stay_to > stay_from);
