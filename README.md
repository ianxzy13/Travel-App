# Vow – all-in-one wedding planner

Plan guests, RSVPs, seating, budget, venues, hotels, travel, inspiration and a wedding website,
together with your partner, family or planner.

Built with Next.js 15 (App Router, TypeScript), Tailwind CSS v4 + shadcn/ui, and Supabase
(database, sign-in and file storage). Hosted on Vercel.

> **Status:** Phases 1–3 are done: sign-in, onboarding, dashboard, settings with collaborators and
> events, the full guest list (households, tags, seating rules, CSV import/export) and RSVPs (private
> links, meal choices, email invitations and reminders, notifications). The other modules show a
> "coming soon" page until their phase is built.

---

## 1. Run it on your computer (Windows / PowerShell)

You need **Node.js 20 or newer** (check with `node -v`).

```powershell
cd C:\Users\<you>\Travel-App
npm install
Copy-Item .env.example .env.local   # then fill it in, see step 2
npm run dev
```

Open <http://localhost:3000>. Until `.env.local` is filled in, the landing page works and the
sign-in page shows a "Supabase isn't connected yet" notice.

Useful commands:

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Start the app with live reload      |
| `npm run build`     | Production build (what Vercel runs) |
| `npm run lint`      | Check code for common mistakes      |
| `npm run typecheck` | Check TypeScript types              |
| `npm run format`    | Auto-format all files with Prettier |
| `npm run test`      | Run the unit tests (Vitest)         |

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
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The older **anon public** key (under "Legacy API keys")
   also works.
3. Go to **Project Settings → Data API** and copy the **Project URL** into
   `NEXT_PUBLIC_SUPABASE_URL`.

Your `.env.local` should look like:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijkl.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Never share or commit `.env.local` (Git already ignores it). Restart `npm run dev` after editing it.

### 2c. Create the database tables (run the migrations)

1. In Supabase, open **SQL Editor** (left sidebar) → **New query**.
2. Open each file in `supabase/migrations/` **in filename order**, copy its entire contents,
   paste into the editor and click **Run**. You should see "Success. No rows returned".
   - `20260926000000_foundation.sql` (phase 1: users, weddings, collaborators)
   - `20260927000000_guests_events.sql` (phase 2: events, households, guests, tags)
   - `20260928000000_rsvp.sql` (phase 3: RSVP codes, meals, replies, emails, notifications)
   - Later phases add more files. Run only the new ones each time.
3. Check **Table Editor**: you should see `weddings`, `guests`, `households`, `events` and more.

_(Advanced alternative: install the Supabase CLI, `npx supabase link`, then `npx supabase db push`.)_

### 2d. Configure sign-in links

1. Go to **Authentication → URL Configuration**.
2. **Site URL**: `http://localhost:3000` for now (change to your Vercel URL when you deploy).
3. Under **Redirect URLs**, click **Add URL** and add:
   - `http://localhost:3000/**`
   - `https://<your-vercel-app>.vercel.app/**`
   - `https://*-<your-vercel-team>.vercel.app/**` (optional, for preview deployments)
4. Click **Save**.

Email sign-in (magic link) is on by default. Supabase's built-in email sender is limited to a few
emails per hour, which is fine for testing. For real use, add your own SMTP (e.g. Resend) under
**Authentication → Emails → SMTP Settings**.

**Sign-in code (recommended):** so people can also type a code instead of clicking the link, go to
**Authentication → Emails**, open the **Magic link** and **Confirm signup** templates, and replace
the message body with the contents of `supabase/email-templates/sign-in.html`.

### 2e. (Optional) Sign in with Google

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, then
   **APIs & Services → OAuth consent screen**: choose **External**, fill in the app name and your
   email, and save.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type
   **Web application**.
3. Under **Authorized redirect URIs**, add the **Callback URL** shown in Supabase under
   **Authentication → Sign In / Providers → Google** (it looks like
   `https://abcdefghijkl.supabase.co/auth/v1/callback`).
4. Copy the Google **Client ID** and **Client secret** into that Supabase Google provider page,
   switch it **on**, and save.

If Google isn't set up, the "Continue with Google" button shows a friendly error and email sign-in
still works.

### 2f. Set up Resend (RSVP invitation emails)

The app works without this: you can copy each household's RSVP link or share it on WhatsApp.

1. Sign up at <https://resend.com> (free: 100 emails/day, 3,000/month).
2. **API Keys → Create API Key** (permission: Sending access). Copy it into `.env.local` as
   `RESEND_API_KEY=re_...` and restart `npm run dev`.
3. **Testing:** without a domain, Resend only delivers to **your own** Resend account email. Add
   yourself as a guest with that email to try it.
4. **Sending to real guests:** you need a domain you own (e.g. from Namecheap or Cloudflare, about
   €10/year). In Resend: **Domains → Add domain**, add the DNS records it shows at your domain
   provider, wait for "Verified", then set `EMAIL_FROM=rsvp@yourdomain.com` in `.env.local`.

### 2g. (Optional) "Opened" status and emails to the couple

Both need the Supabase **secret key**, which bypasses security rules, so keep it private and
**never** put it in a `NEXT_PUBLIC_` variable.

1. Supabase → **Project Settings → API Keys → Secret keys** → copy it into `.env.local` as
   `SUPABASE_SECRET_KEY=sb_secret_...`. This enables "Email me when someone replies" (RSVPs →
   Meals & settings).
2. For "opened" / "bounced" status: this only works once the app is online (Vercel), because
   Resend has to reach it. In Resend: **Webhooks → Add Endpoint**, URL
   `https://<your-app>.vercel.app/api/resend/webhook`, events `email.delivered`,
   `email.opened`, `email.bounced`, `email.complained`. Copy the **Signing secret** into
   `RESEND_WEBHOOK_SECRET`. Open tracking must also be switched on for your domain in Resend.

---

## 3. Try it out

**Guest list tips**

- A **household** gets one invitation and one RSVP link (phase 3). Put couples and families in the
  same household.
- **Plus-ones** are real guest rows linked to the guest who brings them, so they can RSVP and be
  seated later. Unnamed ones show as "Ann's guest".
- **Import**: Guests → Import → upload a CSV. Columns are matched automatically and you can fix
  them before anything is saved. Rows with the same _Household_ value become one household.
  Export produces a file you can edit and re-import.
- **Seating rules** (keep together / keep apart) are set in a guest's edit panel and are used by
  the seating chart in phase 4.

**RSVP tips**

- Each household has a private link like `/r/K7P2QX`. Guests answer per person and per event,
  choose meals, and can change their answers until the deadline.
- There's also a general page, `/rsvp/<your-slug>` (e.g. `/rsvp/ian-and-maria`), where guests find
  their invitation by typing their full name. **RSVPs → Copy RSVP page link** copies it.
- **RSVPs → Meals & settings**: deadline, message after the deadline, meal options, and which
  events ask for a meal (usually the reception).
- Got an answer by phone or on paper? **RSVPs → ⋯ → Record or edit their reply**.

1. `npm run dev`, open <http://localhost:3000>, click **Get started**.
2. Enter your email → open the link in the email → you land on **onboarding**.
3. Create your wedding (4 short steps) → you land on the **dashboard** with a countdown.
4. **Settings** → change details or the accent colour, invite a collaborator (copy the link and
   open it in a private window signed in as another email), change roles, delete the wedding.

---

## 4. Deploy to Vercel

The project deploys automatically from the `main` branch on GitHub.

1. In the Vercel dashboard, open the project → **Settings → Environment Variables** and add, for
   **Production** and **Preview**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = `https://<your-app>.vercel.app`
   - optional: `RESEND_API_KEY`, `EMAIL_FROM`, `SUPABASE_SECRET_KEY`, `RESEND_WEBHOOK_SECRET`
2. Redeploy (**Deployments → ⋯ → Redeploy**) so the new variables are picked up.
3. In Supabase, set the **Site URL** to your Vercel URL and make sure it's in **Redirect URLs**
   (step 2d).

---

## 5. How the code is organised

```
app/                      pages (Next.js App Router)
  page.tsx                marketing landing page
  login/                  sign-in page + server actions (magic link, Google, sign out)
  auth/callback/          finishes sign-in after the email link / Google
  onboarding/             "create your wedding" wizard
  invite/[token]/         accept a collaborator invite
  app/                    the signed-in app (dashboard, settings, modules)
components/
  ui/                     shadcn/ui building blocks (button, dialog, …)
  app/                    app shell: sidebar, mobile tab bar, wedding switcher, user menu
  …                       feature components (settings, onboarding, dashboard)
lib/
  supabase/               Supabase clients for server, browser and middleware
  wedding.ts              "who is signed in / which wedding is selected" helpers
  validation/             zod schemas shared by forms and server actions
  database.types.ts       TypeScript types for the database tables
supabase/migrations/      SQL that creates tables and security rules
middleware.ts             keeps the session fresh and protects /app pages
```

### Security model

Every table has **Row Level Security** (RLS). Users only see weddings they are a member of.
Roles:

- **owner**: everything, including managing collaborators and deleting the wedding
- **editor**: can add and change everything
- **viewer**: read only

The database guarantees a wedding always keeps at least one owner.
