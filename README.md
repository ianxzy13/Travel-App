# Vow – all-in-one wedding planner

Plan your whole wedding in one calm place, together with your partner, family or planner:
guests and RSVPs, a drag-and-drop seating chart, budget and vendors, venues, hotels and travel,
inspiration boards, a wedding website, to-dos, the day-of schedule and reminders.

Built with Next.js 15 (App Router, TypeScript), Tailwind CSS v4 + shadcn/ui, and Supabase
(database, sign-in and file storage). Emails via Resend, photos via Unsplash. Hosted on Vercel.

**Contents:** [What's inside](#whats-inside) · [1. Run it locally](#1-run-it-on-your-computer-windows--powershell) ·
[2. Supabase](#2-set-up-supabase-free) · [3. Email, photos & extras](#3-email-photos-and-extras-optional) ·
[4. Demo data](#4-demo-data) · [5. Tests](#5-tests) · [6. Deploy to Vercel](#6-deploy-to-vercel) ·
[7. Using the app](#7-using-the-app) · [8. Troubleshooting](#8-troubleshooting) · [9. The code](#9-how-the-code-is-organised)

---

## What's inside

| Module                     | Highlights                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**              | Countdown, budget / RSVP / seating / to-do / inspiration cards, "next steps"                                               |
| **Guests**                 | Households, sides, tags, A/B list, plus-ones, dietary needs, per-event invites, CSV import/export                          |
| **RSVP**                   | Private link per household (`/r/K7P2QX`) or find-by-name, meals, deadline, email invites & reminders                       |
| **Seating chart**          | Tables & room items on a floor plan, drag guests or whole households, rules, auto-arrange, undo, live collaboration, print |
| **Budget & vendors**       | Suggested categories, expenses, payment schedules, receipts, charts, CSV export, vendor book with contracts                |
| **Venues, hotels, travel** | Venue comparison & visit checklists, room blocks, guest hotel assignments, flights & arrivals board                        |
| **Inspiration**            | Pinterest-style boards, uploads, link previews, Unsplash Discover, hearts & comments, colour palette, share links          |
| **Wedding website**        | 5 templates, live editor, sections, password, publishing, SEO and link-preview image                                       |
| **To-dos & schedule**      | Suggested timeline from your date, assignees, day-of run sheet with print-out                                              |
| **Notifications**          | New RSVPs, to-dos for you, payment / room-block / overdue reminders                                                        |

Everything is **mobile-first** (works from 375 px wide), has **light and dark mode**, and is checked
for **accessibility** (keyboard use, labels, contrast) by the automated tests.

---

## 1. Run it on your computer (Windows / PowerShell)

You need **Node.js 20 or newer** (check with `node -v`; get it from <https://nodejs.org>).

```powershell
cd C:\Users\<you>\Travel-App
npm install
Copy-Item .env.example .env.local   # then fill it in, see step 2
npm run dev
```

Open <http://localhost:3000>. Until `.env.local` is filled in, the landing page works and the
sign-in page shows a "Supabase isn't connected yet" notice.

| Command             | What it does                                         |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start the app with live reload                       |
| `npm run build`     | Production build (what Vercel runs)                  |
| `npm run lint`      | Check the code for common mistakes                   |
| `npm run typecheck` | Check TypeScript types                               |
| `npm run format`    | Auto-format all files with Prettier                  |
| `npm run test`      | Unit tests (Vitest)                                  |
| `npm run test:e2e`  | Browser tests of every page (Playwright), see step 5 |
| `npm run seed`      | Create the demo wedding, see step 4                  |

---

## 2. Set up Supabase (free)

### 2a. Create the project

1. Go to <https://supabase.com> and sign in (GitHub login is easiest).
2. Click **New project**. Pick any name (e.g. `vow`), set a database password (save it in a
   password manager), choose the region closest to you, and click **Create new project**.
   Wait about a minute until it's ready.

### 2b. Copy your keys into `.env.local`

1. In your project, click **Project Settings** (gear icon, bottom left) → **API Keys**.
2. Copy the **Publishable key** (starts with `sb_publishable_`) into
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The older **anon public** key also works.
3. Go to **Project Settings → Data API** and copy the **Project URL** into
   `NEXT_PUBLIC_SUPABASE_URL`.
4. Optional but recommended: on the **API Keys** page, copy the **Secret key** (starts with
   `sb_secret_`) into `SUPABASE_SECRET_KEY`. It's needed for the demo data, the browser tests,
   "email me when someone replies" and email "opened" status. **Keep it private**: it bypasses
   all security rules, so never put it in a `NEXT_PUBLIC_` variable or share it.

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxx
```

Never share or commit `.env.local` (Git already ignores it). Restart `npm run dev` after editing it.

### 2c. Create the database tables (run the migrations)

1. In Supabase, open **SQL Editor** (left sidebar) → **New query**.
2. For each file in `supabase/migrations/`, **in this order**: open it, copy everything, paste it
   into the editor and click **Run**. You should see "Success. No rows returned".
   A quick way to copy a file in PowerShell:
   `Get-Content supabase\migrations\20260926000000_foundation.sql -Raw | Set-Clipboard`

   | File                                | Creates                                                |
   | ----------------------------------- | ------------------------------------------------------ |
   | `20260926000000_foundation.sql`     | users, weddings, collaborators & invites               |
   | `20260927000000_guests_events.sql`  | events, households, guests, tags, seating rules        |
   | `20260928000000_rsvp.sql`           | RSVP codes, meals, replies, emails, notifications      |
   | `20260929000000_seating.sql`        | floor plans, tables, seat assignments (+ live updates) |
   | `20260930000000_budget_vendors.sql` | budget, payments, vendors, private file storage        |
   | `20261001000000_venues_travel.sql`  | venues, visit checklists, hotels, flights              |
   | `20261002000000_inspiration.sql`    | boards, pins, comments, hearts, palette, shared boards |
   | `20261003000000_website.sql`        | wedding website, sections, password protection         |
   | `20261004000000_tasks_schedule.sql` | to-dos, day-of schedule, reminders                     |

3. Check **Table Editor**: you should see `weddings`, `guests`, `households`, `events` and more,
   and **Storage** should show a private bucket called `wedding-files`.

_(Advanced alternative: install the Supabase CLI, `npx supabase link`, then `npx supabase db push`.)_

### 2d. Configure sign-in

1. Go to **Authentication → URL Configuration**.
2. **Site URL**: `http://localhost:3000` for now (your Vercel URL once you deploy).
3. Under **Redirect URLs**, add `http://localhost:3000/**` and `https://<your-app>.vercel.app/**`
   (optionally `https://*-<your-vercel-team>.vercel.app/**` for preview deployments). **Save**.
4. **Sign-in code (recommended):** so people can type a code instead of clicking the link, go to
   **Authentication → Emails**, open the **Magic link** and **Confirm signup** templates, and replace
   the message body with the contents of `supabase/email-templates/sign-in.html`.

Supabase's built-in email sender only sends a few emails per hour, which is fine for testing. For
real use, add your own SMTP (e.g. Resend) under **Authentication → Emails → SMTP Settings**.

### 2e. (Optional) Sign in with Google

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, then
   **APIs & Services → OAuth consent screen**: choose **External**, fill in the app name and your
   email, and save.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
3. Under **Authorized redirect URIs**, add the **Callback URL** shown in Supabase under
   **Authentication → Sign In / Providers → Google** (like
   `https://abcdefghijkl.supabase.co/auth/v1/callback`).
4. Copy the Google **Client ID** and **Client secret** into that Supabase page, switch it **on**, save.

If Google isn't set up, "Continue with Google" shows a friendly error and email sign-in still works.

---

## 3. Email, photos and extras (optional)

The app works without any of these.

### Resend: RSVP invitation emails

Without it you can still copy each household's RSVP link or share it on WhatsApp.

1. Sign up at <https://resend.com> (free: 100 emails/day, 3,000/month).
2. **API Keys → Create API Key** (Sending access) → `.env.local`: `RESEND_API_KEY=re_...`.
3. **Testing:** without your own domain, Resend only delivers to **your own** Resend account email.
   Add yourself as a guest with that email to try it.
4. **Real guests:** you need a domain (about €10/year). In Resend: **Domains → Add domain**, add the
   DNS records it shows at your domain provider, wait for "Verified", then set
   `EMAIL_FROM=rsvp@yourdomain.com`.
5. **"Opened" / "bounced" status** (only once the app is online): Resend → **Webhooks → Add
   Endpoint**, URL `https://<your-app>.vercel.app/api/resend/webhook`, events `email.delivered`,
   `email.opened`, `email.bounced`, `email.complained`. Put the **Signing secret** in
   `RESEND_WEBHOOK_SECRET` (needs `SUPABASE_SECRET_KEY` too).

### Unsplash: "Discover" wedding photos

1. <https://unsplash.com/developers> → **Your apps → New Application**, accept the guidelines,
   name it (e.g. "Vow wedding planner").
2. Copy the **Access Key** (not the Secret key) into `UNSPLASH_ACCESS_KEY` and restart `npm run dev`.
3. New apps start in "Demo" mode (50 searches per hour), plenty for a couple. Photographers are
   credited as Unsplash requires. (Pinterest isn't used: its API needs app approval, so it's a
   possible future integration.)

---

## 4. Demo data

`npm run seed` creates a complete demo wedding, **"Sofia & Lucas" in Sintra**, so every screen has
something to show: ~80 guests in households (some from abroad), RSVPs with meals, a budget with
vendors and payments (one overdue, one due this week), 3 venues, 2 hotels with a room block,
flights and an arrivals board, a half-finished seating chart, inspiration boards, a published
website at `/w/sofia-and-lucas-demo`, a planning timeline and a day-of schedule.

1. Sign in to the app once with your email (so your account exists).
2. In `.env.local` set `SUPABASE_SECRET_KEY` (step 2b) and `SEED_OWNER_EMAIL=<that email>`.
   With `UNSPLASH_ACCESS_KEY` set, the boards get real wedding photos.
3. Run `npm run seed`, then open <http://localhost:3000/app> and pick **Sofia & Lucas** in the
   wedding switcher (top left). Your own weddings are never touched.

Running it again deletes and re-creates only the demo wedding. It also creates a demo collaborator
account (`lucas.demo@example.com`, can't sign in) so assigned to-dos and comments look real. To
remove the demo, delete the wedding in **Settings → Danger zone**.

---

## 5. Tests

- **Unit tests** (`npm run test`): pure logic, e.g. budget totals, RSVP counts, CSV mapping, seating
  auto-arrange and rules, the suggested timeline, schedule times, website link safety.
- **Browser tests** (`npm run test:e2e`, Playwright): signs in, opens **every page** on a desktop
  and a phone-sized screen, and checks that it loads without errors, that nothing sticks out
  sideways, and that there are no serious accessibility problems (axe-core, WCAG 2.1 AA).
  1. Needs `SUPABASE_SECRET_KEY` and an account with a wedding: run `npm run seed` first. It signs
     in as `E2E_EMAIL` (or `SEED_OWNER_EMAIL`) with a one-time link, no email needed.
  2. Browser: set `PW_CHANNEL=msedge` in `.env.local` to use Microsoft Edge, or run
     `npx playwright install chromium` once.
  3. `npm run test:e2e` starts the app if it isn't running. A report is saved in
     `playwright-report/` (open `index.html`).

---

## 6. Deploy to Vercel

The project deploys automatically from the `main` branch on GitHub.

**Checklist**

1. **Database:** all migrations from step 2c have been run in your Supabase project.
2. **Environment variables:** Vercel → your project → **Settings → Environment Variables**. Add
   these for **Production** and **Preview**, then **Deployments → ⋯ → Redeploy**:

   | Variable                                                                  | Required?                                                          |
   | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
   | `NEXT_PUBLIC_SUPABASE_URL`                                                | yes                                                                |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                                    | yes                                                                |
   | `NEXT_PUBLIC_SITE_URL` = `https://<your-app>.vercel.app` (or your domain) | yes                                                                |
   | `RESEND_API_KEY`, `EMAIL_FROM`                                            | for RSVP emails                                                    |
   | `SUPABASE_SECRET_KEY`                                                     | for "email me on replies" and email status (mark it **Sensitive**) |
   | `RESEND_WEBHOOK_SECRET`                                                   | for email status                                                   |
   | `UNSPLASH_ACCESS_KEY`                                                     | for Discover                                                       |

   `SEED_OWNER_EMAIL`, `E2E_EMAIL` and `PW_CHANNEL` are only for your computer.

3. **Supabase sign-in URLs:** Authentication → URL Configuration: **Site URL** = your Vercel URL,
   and it's listed under **Redirect URLs** (step 2d). Google sign-in: nothing to change.
4. **Resend:** domain verified and `EMAIL_FROM` set before inviting real guests; webhook pointing at
   `https://<your-app>.vercel.app/api/resend/webhook`.
5. **Try it:** open the Vercel URL in a private window, sign in, open a few pages, open your public
   website `/w/<address>` and an RSVP link `/r/<code>`.
6. **Your own domain (optional):** Vercel → Settings → Domains. Then update `NEXT_PUBLIC_SITE_URL`
   and the Supabase URLs to the new domain.

---

## 7. Using the app

**Getting started:** open the app → **Get started** → enter your email → click the link (or type the
code) → create your wedding in 4 short steps → the dashboard shows what to do next. Invite your
partner or planner in **Settings → Collaborators** (copy the invite link and send it to them).

**Roles:** **owner** (everything, incl. collaborators and deleting), **editor** (add and change
everything), **viewer** (read only; can still heart and comment on pins).

**Guests**

- A **household** gets one invitation and one RSVP link. Put couples and families together.
- **Plus-ones** are real guests linked to the person who brings them, so they can RSVP and be
  seated. Unnamed ones show as "Ann's guest".
- **Import**: Guests → Import → upload a CSV. Columns are matched automatically and you can fix
  them before saving. Rows with the same _Household_ value become one household. Export gives a
  file you can edit and re-import.
- **Seating rules** (keep together / keep apart) are set in a guest's edit panel.

**RSVP**

- Each household has a private link like `/r/K7P2QX`. Guests answer per person and event, choose
  meals, and can change their answers until the deadline.
- `/rsvp/<your-address>` lets guests find their invitation by typing their full name
  (**RSVPs → Copy RSVP page link**).
- **RSVPs → Meals & settings**: deadline, message after the deadline, meal options, and which
  events ask for a meal. Got an answer by phone? **RSVPs → ⋯ → Record or edit their reply**.

**Seating chart**

- Pick the event at the top. **Add** tables and room items and drag them into place (50 cm grid,
  switch off in the Room panel). Scroll or pinch to zoom; drag the empty floor to move around.
- Drag a guest, or a whole household by its header, onto a seat or table. Drag a seated guest to
  another seat to move or swap, or back to the list to unseat. On a phone: tap a name, then a seat.
- Red **!** badges mark broken rules, children without an adult from their household, or declined
  guests who still have a seat. **Auto-arrange** only fills empty seats and can be undone. Ctrl+Z /
  Ctrl+Y undo and redo. Changes save automatically and appear live for collaborators.
- **Print**: floor plan, table-by-table list, A–Z "find your seat" list, place cards, caterer
  summary. Choose "Save as PDF" in the print dialog for a PDF.

**Budget & vendors**

- Set a **total budget**, then "Use suggested categories" (16 categories with a typical split).
- Expenses have an **estimate** and, once agreed, an **actual** price. Add **payments** (deposits,
  balance) with due dates and tick them when paid; overdue ones are red. Receipts and contracts are
  stored privately. On a vendor, **Add quote to budget** creates an expense.

**Venues, hotels & travel**

- Every venue gets a 10-question **site-visit checklist**; tick "Compare" on 2–4 venues to see them
  side by side. Marking one **Booked** feeds its capacity into the seating chart and offers it as an
  event's venue.
- Hotels: room block (rooms held/booked, code, cut-off) with reminders; "Show on website" puts it on
  your wedding website. Travel: flight times are **local airport times** as on the ticket; the
  **arrivals board** groups arrivals by day for pickups. "Search flights" opens Google Flights /
  Skyscanner (no flight API; the data model is ready for one later).

**Inspiration**

- Start with a suggested board or your own. **Add pins** by uploading, pasting a link (a page or an
  image) or **Discover** (Unsplash).
- Drag a pin onto a board chip to move it, or onto another pin to reorder (phone: long-press). In a
  pin: notes, tags, Love it / Maybe, link to a budget category or vendor, hearts and comments.
  **Find colours** reads the image's main colours for your **wedding palette**.
- **Share** gives a board a secret read-only link (`/b/...`) for your florist; turning it off stops
  the old link working. Comments and hearts are never shared.

**Wedding website**

- **Website** opens the editor; it saves automatically. **Design**: 5 templates (switching keeps
  your content), accent colour, fonts, hero photo. **Sections**: drag to reorder, switch on/off,
  click to edit. Empty sections stay hidden automatically.
- **Publish**: the site lives at `/w/<your-address>`; before publishing only your team can see it.
  Optional **password** (remembered for 30 days). Published sites without a password can appear in
  Google; shared links show a preview image with your names, date and place.

**To-dos, schedule & notifications**

- **To-dos → Create my timeline** adds ~45 to-dos dated backwards from your wedding; if you start
  late, overdue ones are spread over the next weeks. Assign with **Who** (they get notified). "Looks
  done" appears when the app sees it's done (e.g. a booked venue): click **Tick it off**.
- **Day-of schedule**: start from the template (timed around your ceremony) or from scratch; add
  your events in one click; **⋯ → 15 min later, with everything after** when plans move. **Print**
  gives a run sheet with vendor phone numbers.
- **Notifications** (bell): new RSVPs, to-dos given to you, payments due within 7 days or overdue,
  room-block cut-offs within 14 days, to-dos due in 3 days, and a weekly overdue summary. Reminders
  are checked once a day when someone opens the app (no cron job needed).

---

## 8. Troubleshooting

| Problem                                | Fix                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| "Supabase isn't connected yet"         | Fill in `.env.local` (step 2b) and restart `npm run dev`.                                                                      |
| Sign-in link says **expired**          | Email apps sometimes "open" links early. Use the 6-digit code instead (step 2d, sign-in code template), or request a new link. |
| No sign-in email                       | Supabase's own sender is limited to a few emails per hour; wait, or set up SMTP (step 2d). Check spam.                         |
| Upload fails                           | Run the phase 5 migration (it creates the `wedding-files` bucket) and check **Storage**.                                       |
| RSVP email not arriving                | Without a verified domain, Resend only sends to your own Resend email (step 3).                                                |
| A page says a table is missing         | A migration hasn't been run; run the newer files from step 2c in order.                                                        |
| `npm run seed` says "No account for …" | Sign in to the app once with `SEED_OWNER_EMAIL`, then run it again.                                                            |
| Browser tests can't start a browser    | Set `PW_CHANNEL=msedge`, or run `npx playwright install chromium`.                                                             |

---

## 9. How the code is organised

```
app/                      pages (Next.js App Router)
  page.tsx                landing page
  login/, auth/callback/  sign-in (magic link, code, Google)
  onboarding/             "create your wedding" wizard
  invite/[token]/         accept a collaborator invite
  app/                    the signed-in app: dashboard + one folder per module (page + server actions)
  r/, rsvp/[slug]/        public RSVP pages
  w/[slug]/               public wedding website (+ link-preview image)
  b/[shareId]/            public shared inspiration board
  print/                  printable seating chart and run sheet
  api/resend/webhook/     email delivery status from Resend
components/               UI, one folder per module; components/ui = shadcn/ui building blocks
lib/                      logic shared by pages and server actions (one folder per module),
                          validation (zod), Supabase clients, database types
emails/                   React Email templates
scripts/seed.ts           demo data (npm run seed)
e2e/                      Playwright browser tests
supabase/migrations/      SQL: tables, security rules, database functions
middleware.ts             keeps the session fresh and protects /app pages
```

**Security:** every table has **Row Level Security**: people only see weddings they're a member of,
and only owners/editors can change things. Public pages (website, RSVP, shared boards) go through
database functions that return only what's meant to be public. Uploaded files are private (links
expire after an hour). The database guarantees every wedding keeps at least one owner.
