-- Phase 2: Budget in two currencies
alter table public.weddings
  add column secondary_currency text default null,
  add column exchange_rate numeric default null;

comment on column public.weddings.secondary_currency is 'Optional second currency for the budget (e.g. vendors charge in local currency, couple pays in home currency)';
comment on column public.weddings.exchange_rate is 'How many units of secondary_currency equal 1 unit of currency (the primary). Set by the couple.';
