-- New weddings get an email when a guest RSVPs, without having to find the
-- switch first. Couples can still turn it off in RSVP settings.
-- Existing weddings keep the setting they have.
alter table public.weddings alter column rsvp_notify_email set default true;
