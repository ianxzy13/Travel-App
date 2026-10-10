-- =============================================================
-- Vow – Save the Date: SD3 — email delivery tracking
-- =============================================================
-- Extend the existing record_email_event RPC so Resend webhook
-- events also update save_the_date_sends when a resend_id matches.

create or replace function public.record_email_event(p_resend_id text, p_event text, p_at timestamptz)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  -- RSVP email_sends (existing)
  update public.email_sends set
    status = case
      when p_event = 'email.bounced' then 'bounced'
      when p_event = 'email.complained' then 'complained'
      when p_event = 'email.opened' and status in ('sent', 'delivered') then 'opened'
      when p_event = 'email.delivered' and status = 'sent' then 'delivered'
      else status end,
    delivered_at = case when p_event = 'email.delivered' then coalesce(delivered_at, p_at) else delivered_at end,
    opened_at = case when p_event = 'email.opened' then coalesce(opened_at, p_at) else opened_at end
  where resend_id = p_resend_id;

  -- Save the Date sends
  update public.save_the_date_sends set
    status = case
      when p_event = 'email.bounced' then 'failed'::public.std_send_status
      when p_event = 'email.complained' then 'failed'::public.std_send_status
      when p_event = 'email.opened' and status in ('sent', 'delivered') then 'opened'::public.std_send_status
      when p_event = 'email.delivered' and status = 'sent' then 'delivered'::public.std_send_status
      else status end,
    error = case
      when p_event = 'email.bounced' then 'bounced'
      when p_event = 'email.complained' then 'complained'
      else error end,
    delivered_at = case when p_event = 'email.delivered' then coalesce(delivered_at, p_at) else delivered_at end,
    opened_at = case when p_event = 'email.opened' then coalesce(opened_at, p_at) else opened_at end
  where resend_id = p_resend_id;
$$;
