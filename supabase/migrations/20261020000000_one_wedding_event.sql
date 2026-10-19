-- =============================================================
-- Merge the default Ceremony + Reception into one "Ceremony & Reception" event.
-- Safe to run more than once (idempotent).
-- =============================================================

-- All known translations of "Ceremony" and "Reception" across the 25 supported
-- languages, folded for accent-insensitive matching.  A wedding matches only
-- when it has EXACTLY one event whose folded name is in the ceremony set AND
-- one whose folded name is in the reception set.

do $$
declare
  cer_names text[] := array[
    'ceremony', 'porocni obred', 'obred',
    'مراسم الزفاف',
    'obrad', 'trauung', 'τελετη', 'ceremonia', 'ceremonie',
    'विवाह समारोह', 'समारोह',
    'vjencanje', 'akad / pemberkatan',
    'cerimonia', '挙式', '예식',
    'ceremonie',
    'cerimonia',
    'церемония', 'vigsel',
    'พิธีแต่งงาน',
    'nikah toreni',
    'церемонія',
    'le cuoi', 'lễ cưới',
    '婚礼仪式', '婚禮儀式',
    'ceremony & reception'
  ];
  rec_names text[] := array[
    'reception', 'pogostitev',
    'حفل الاستقبال',
    'hostina', 'feier', 'δεξιωση', 'banquete', 'reception',
    'रिसेप्शन',
    'svadba', 'resepsi',
    'ricevimento', '披露宴', '피로연',
    'feest', 'przyjecie weselne',
    'copo-d''agua',
    'банкет', 'brollopsfest',
    'งานเลี้ยงฉลอง',
    'dugun yemegi',
    'банкет',
    'tiec cuoi', 'tiệc cưới',
    '婚宴', '喜宴'
  ];
  -- "Ceremony & Reception" translated per language (keyed by the wedding's languages[1])
  merged_names text[][] := array[
    array['en', 'Ceremony & Reception'],
    array['sl', 'Poročni obred in pogostitev'],
    array['ar', 'مراسم الزفاف والاستقبال'],
    array['cs', 'Obřad a hostina'],
    array['de', 'Trauung & Feier'],
    array['el', 'Τελετή & Δεξίωση'],
    array['es', 'Ceremonia y banquete'],
    array['fr', 'Cérémonie & réception'],
    array['hi', 'विवाह समारोह और रिसेप्शन'],
    array['hr', 'Vjenčanje i svadba'],
    array['id', 'Akad & Resepsi'],
    array['it', 'Cerimonia e ricevimento'],
    array['ja', '挙式・披露宴'],
    array['ko', '예식 및 피로연'],
    array['nl', 'Ceremonie & feest'],
    array['pl', 'Ceremonia i przyjęcie weselne'],
    array['pt', 'Cerimónia e copo-d''água'],
    array['ru', 'Церемония и банкет'],
    array['sv', 'Vigsel & bröllopsfest'],
    array['th', 'พิธีแต่งงานและงานเลี้ยง'],
    array['tr', 'Nikâh töreni ve düğün yemeği'],
    array['uk', 'Церемонія і банкет'],
    array['vi', 'Lễ cưới và tiệc cưới'],
    array['zh-CN', '婚礼仪式暨婚宴'],
    array['zh-TW', '婚禮儀式暨喜宴']
  ];
  r record;
  cer_id uuid;
  rec_id uuid;
  keep_id uuid;
  drop_id uuid;
  new_name text;
  lang text;
  i int;
begin
  -- For each wedding that has exactly one ceremony-named and one reception-named event
  for r in
    select w.id as wedding_id, w.languages
    from public.weddings w
    where (
      select count(*) from public.events e
      where e.wedding_id = w.id and public.fold(e.name) = any(cer_names)
    ) = 1
    and (
      select count(*) from public.events e
      where e.wedding_id = w.id and public.fold(e.name) = any(rec_names)
    ) = 1
  loop
    select id into cer_id from public.events
      where wedding_id = r.wedding_id and public.fold(name) = any(cer_names);
    select id into rec_id from public.events
      where wedding_id = r.wedding_id and public.fold(name) = any(rec_names);

    -- Skip if they are the same event (already merged)
    if cer_id = rec_id then continue; end if;

    -- Keep the reception (has meals/seating), drop the ceremony
    keep_id := rec_id;
    drop_id := cer_id;

    -- Determine the merged name in the wedding's language
    lang := coalesce(r.languages[1], 'en');
    new_name := 'Ceremony & Reception'; -- default
    for i in 1..array_length(merged_names, 1) loop
      if merged_names[i][1] = lang then
        new_name := merged_names[i][2];
        exit;
      end if;
    end loop;

    -- 1. Rename the kept event and take the lower sort_order
    update public.events set
      name = new_name,
      meal_choice = true,
      sort_order = least(
        (select sort_order from public.events where id = keep_id),
        (select sort_order from public.events where id = drop_id)
      ),
      -- Copy missing details from the ceremony
      venue_name = coalesce(
        (select venue_name from public.events where id = keep_id),
        (select venue_name from public.events where id = drop_id)
      ),
      address = coalesce(
        (select address from public.events where id = keep_id),
        (select address from public.events where id = drop_id)
      ),
      start_time = coalesce(
        (select start_time from public.events where id = keep_id),
        (select start_time from public.events where id = drop_id)
      ),
      end_time = coalesce(
        (select end_time from public.events where id = keep_id),
        (select end_time from public.events where id = drop_id)
      ),
      dress_code = coalesce(
        (select dress_code from public.events where id = keep_id),
        (select dress_code from public.events where id = drop_id)
      ),
      description = coalesce(
        (select description from public.events where id = keep_id),
        (select description from public.events where id = drop_id)
      )
    where id = keep_id;

    -- 2. Move invites: anyone invited to the dropped event → invited to the kept event
    --    Skip duplicates (already invited to the kept event).
    insert into public.guest_event_invites (wedding_id, guest_id, event_id)
    select gi.wedding_id, gi.guest_id, keep_id
    from public.guest_event_invites gi
    where gi.event_id = drop_id
      and not exists (
        select 1 from public.guest_event_invites gi2
        where gi2.guest_id = gi.guest_id and gi2.event_id = keep_id
      )
    on conflict (guest_id, event_id) do nothing;

    -- 3. Move RSVP answers: for each guest in the dropped event
    --    - If they also have an answer for the kept event, keep the kept-event answer
    --      but upgrade to attending if either said attending, and keep the meal choice.
    --    - If they only answered for the dropped event, move the answer.
    --    First: update existing kept-event answers where the dropped answer was "attending"
    update public.rsvp_responses rk set
      status = 'attending',
      meal_option_id = coalesce(rk.meal_option_id, rd.meal_option_id),
      updated_at = greatest(rk.updated_at, rd.updated_at)
    from public.rsvp_responses rd
    where rd.event_id = drop_id
      and rk.event_id = keep_id
      and rd.guest_id = rk.guest_id
      and rd.status = 'attending';

    -- Then: move answers that only exist for the dropped event
    update public.rsvp_responses set event_id = keep_id
    where event_id = drop_id
      and not exists (
        select 1 from public.rsvp_responses r2
        where r2.guest_id = rsvp_responses.guest_id and r2.event_id = keep_id
      );

    -- Delete any remaining dropped-event answers (they were duplicates we already merged)
    delete from public.rsvp_responses where event_id = drop_id;

    -- 4. Seating layouts: if the kept event has no layout but the dropped one does, move it
    if not exists (select 1 from public.seating_layouts where event_id = keep_id) then
      update public.seating_layouts set event_id = keep_id where event_id = drop_id;
    else
      -- Both have layouts: drop the ceremony layout's objects and assignments
      delete from public.seating_layouts where event_id = drop_id;
    end if;

    -- 5. Schedule items: point them to the kept event
    update public.schedule_items set event_id = keep_id where event_id = drop_id;

    -- 6. Delete remaining invites for the dropped event, then the event itself
    delete from public.guest_event_invites where event_id = drop_id;
    delete from public.events where id = drop_id;
  end loop;

  -- Also handle weddings with only one of the two (just rename)
  for r in
    select e.id as event_id, w.languages
    from public.events e
    join public.weddings w on w.id = e.wedding_id
    where public.fold(e.name) = any(cer_names)
      and e.name not like '%&%' and e.name not like '%и%' and e.name not like '%和%'
      and e.name not like '%و%' and e.name not like '%और%' and e.name not like '%및%'
      and e.name not like '%暨%' and e.name not like '%・%' and e.name not like '%và%'
      and not exists (
        select 1 from public.events e2
        where e2.wedding_id = e.wedding_id and e2.id <> e.id
          and public.fold(e2.name) = any(rec_names)
      )
  loop
    lang := coalesce(r.languages[1], 'en');
    new_name := 'Ceremony & Reception';
    for i in 1..array_length(merged_names, 1) loop
      if merged_names[i][1] = lang then new_name := merged_names[i][2]; exit; end if;
    end loop;
    update public.events set name = new_name, meal_choice = true where id = r.event_id;
  end loop;

  for r in
    select e.id as event_id, w.languages
    from public.events e
    join public.weddings w on w.id = e.wedding_id
    where public.fold(e.name) = any(rec_names)
      and e.name not like '%&%' and e.name not like '%и%' and e.name not like '%和%'
      and e.name not like '%و%' and e.name not like '%और%' and e.name not like '%및%'
      and e.name not like '%暨%' and e.name not like '%・%' and e.name not like '%và%'
      and not exists (
        select 1 from public.events e2
        where e2.wedding_id = e.wedding_id and e2.id <> e.id
          and public.fold(e2.name) = any(cer_names)
      )
  loop
    lang := coalesce(r.languages[1], 'en');
    new_name := 'Ceremony & Reception';
    for i in 1..array_length(merged_names, 1) loop
      if merged_names[i][1] = lang then new_name := merged_names[i][2]; exit; end if;
    end loop;
    update public.events set name = new_name, meal_choice = true where id = r.event_id;
  end loop;
end $$;

-- =============================================================
-- Update create_wedding to insert ONE event instead of two.
-- =============================================================

create or replace function public.create_wedding(
  p_partner_a_name text,
  p_partner_b_name text,
  p_wedding_date date,
  p_location text,
  p_currency text,
  p_estimated_guests integer,
  p_style_tags text[],
  p_accent text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.weddings (
    partner_a_name, partner_b_name, wedding_date, location, currency,
    estimated_guests, style_tags, accent, created_by, slug
  )
  values (
    p_partner_a_name, p_partner_b_name, p_wedding_date, p_location, p_currency,
    p_estimated_guests, coalesce(p_style_tags, '{}'), coalesce(p_accent, 'rose'), auth.uid(),
    public.unique_wedding_slug(p_partner_a_name, p_partner_b_name)
  )
  returning id into new_id;

  insert into public.wedding_members (wedding_id, user_id, role)
  values (new_id, auth.uid(), 'owner');

  insert into public.events (wedding_id, name, event_date, sort_order, meal_choice)
  values (new_id, 'Ceremony & Reception', p_wedding_date, 0, true);

  return new_id;
end;
$$;

-- =============================================================
-- Add "rastellino" to the heading_font check constraint.
-- =============================================================

alter table public.website_settings
  drop constraint if exists website_settings_heading_font_check;
alter table public.website_settings
  add constraint website_settings_heading_font_check
  check (heading_font in ('cormorant', 'playfair', 'fraunces', 'josefin', 'inter', 'great-vibes', 'rastellino'));
