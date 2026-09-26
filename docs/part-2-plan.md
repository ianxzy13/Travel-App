# Part 2: Make "Vow" Stand Out (add-on phases 11–15)

> Saved from the owner's brief. Start these ONLY after the original 10 phases are complete,
> `npm run build` passes, and the owner has confirmed. Build on existing code; don't rewrite
> working modules. Same working rules: beginner on Windows (PowerShell), explain in plain
> English, one phase at a time, build + lint pass, commit per phase, stop for review, no
> secrets in code (update `.env.example`), keep it deployable on Vercel.

## Positioning

"The wedding planner for couples marrying across borders": destination weddings and
international families (e.g. a Florida couple marrying in Slovenia with guests from the US
and Europe). Slovenia and neighbours (Croatia, Austria, north-east Italy) first.

Deliberately NOT building: a big vendor marketplace, a gift registry with payments, or a paid
flight/hotel booking API. Links and affiliate links are fine.

## Phase 11: Internationalisation

- `next-intl` (or simplest solid App Router option), English + Slovenian first; one JSON file
  per language so German, Italian, Croatian are easy to add.
- Couple's app: language switcher in settings.
- Guest-facing pages first: website `/w/[slug]`, RSVP `/r/[code]`, invitation/reminder emails.
  `preferred_language` on guests/households; links and emails open in it; switcher on page.
- Couples write website content (Our Story, FAQ, event details) per language; "missing
  translation" hint in the editor. "Draft a translation" button only if no paid API is needed,
  otherwise a TODO.
- Locale formatting (e.g. `24. 5. 2027` in Slovenian). Event times in the venue's time zone,
  optional "in your time zone" hint.
- `wedding_languages` setting.

## Phase 12: Guest Travel Tracker

Extend Hotels and Flights (reuse `flights`, `flight_travellers`, `hotels`,
`hotel_guest_assignments`).
- After RSVP "yes", optional step on `/r/[code]`: arrival date/time, airport, flight number,
  departure date, where they're staying (couple's hotels or "other"), needs transfer. Editable
  later with the same link.
- Couple's travel dashboard: booked vs not, arrivals/departures by day, who's where, who needs a
  transfer, "remind guests who haven't added travel" (email in their language).
- Shuttle planner: group arrivals into pickup runs by airport and time window (e.g. 90 min),
  printable list per driver.
- Room-block tracking fed by what guests report.
- Travel info on the website: nearest airports, airport→venue, local transport, visa/entry
  notes, currency/tipping notes, per language.
- Deep links (Google Flights/Skyscanner with guest home airport + destination + dates; hotel
  "Book" buttons), structured so an affiliate ID from an env variable can be appended later.
  Leave affiliate env vars empty in `.env.example`.

## Phase 13: Smart Seating upgrades

- Smarter auto-arrange: keep together/apart, households, side, tags, plus languages spoken,
  age group, and "knows nobody" guests next to a couple-marked "host". Weight sliders. Score +
  short explanation per table. Propose-then-accept with undo.
- `languages` multi-select on guests (used by seating and website/email defaults).
- Live sync with RSVPs: flag seats of guests who change to "no" and offer to fill; new "yes"
  shown as unseated badge.
- Guest-facing "Find your seat" page on the website (enabled on the day) + printable QR code.
- Scenario compare: save 2–3 versions ("Plan A/B") and switch.
- Place card exports in the guest's language.

## Phase 14: Multi-currency budget + family collaboration

- Expenses/payments in any currency (at least USD, EUR, GBP, CHF): original amount + currency +
  converted amount in the main currency. Free no-key rates (ECB / frankfurter.app), cached
  daily, manual override per expense. Totals in main currency with a toggle for a second
  currency. Charts use converted amounts; label rates as approximate.
- Collaborator presets: `partner`, `parent`, `planner`, `helper` (helper sees/edits only what's
  assigned); each collaborator has their own app language.
- Assign tasks, vendors and guests ("Mom manages the Slovenian side"); "my part" filters.
- Comments and @mentions on tasks, vendors, venues, guests, with notifications (optional email
  digest in their language).
- Activity feed on the dashboard. RLS must protect everything including `helper`.

## Phase 15: Destination guides, landing page, monetisation groundwork

- Built-in guides (Markdown/JSON in the repo, owner-editable): Slovenia first (Lake Bled,
  Ljubljana, Piran/coast, Vipava valley, Julian Alps); Croatia/Austria/Italy easy to add. Each:
  overview, best season, typical cost range, legal requirements for foreigners (editable, with
  "check with the local registry office" disclaimer), nearest airports, importable task checklist.
- Curated venue/hotel suggestions per guide, one-click add to Venues/Hotels. No scraping.
- Landing page rewrite around the positioning (seating, travel tracker, multilingual
  website/RSVP, multi-currency budget), screenshots from seed data, in English and Slovenian.
- Freemium groundwork: `plan` on weddings (`free`/`premium`), `isPremium()` helper, "Premium"
  badges on future-premium features (more than 2 languages, seating scenarios, shuttle planner,
  custom domain, removing Vow branding). Everything stays unlocked. TODO for Stripe/Lemon Squeezy.
- Seed script: demo destination wedding in Slovenia (US/SI/DE/IT guests with mixed languages,
  reported flights, shuttle plan, EUR+USD expenses, parent collaborator, language-grouped seating).
- README updates for new setup steps and env variables.

## Quality bar

TypeScript strict, lint passes, RLS on every new table, mobile-first at 375px, light/dark,
friendly empty states. Vitest tests for: improved auto-arrange (language grouping, keep-apart),
shuttle grouping, currency conversion, locale formatting. Extend the Playwright smoke test to open
the RSVP page in Slovenian and submit travel details. Every guest-facing text in English and
Slovenian before a phase is done.
