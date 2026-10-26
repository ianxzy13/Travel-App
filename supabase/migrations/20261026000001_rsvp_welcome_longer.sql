-- Longer RSVP welcome message: up to 4000 characters (was 1000). Safe to run more than once.
alter table public.weddings drop constraint if exists weddings_rsvp_welcome_check;
alter table public.weddings
  add constraint weddings_rsvp_welcome_check check (char_length(rsvp_welcome) <= 4000);
