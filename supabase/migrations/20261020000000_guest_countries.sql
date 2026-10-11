-- Phase 1: Cross-border story – add guest_countries to weddings
alter table public.weddings
  add column guest_countries text[] not null default '{}';
