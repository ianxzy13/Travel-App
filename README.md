# Vow – all-in-one wedding planner

Plan guests, RSVPs, seating, budget, venues, hotels, travel, inspiration and a wedding website,
together with your partner, family or planner.

Built with Next.js 15 (App Router, TypeScript), Tailwind CSS v4 + shadcn/ui, and Supabase
(database, sign-in and file storage). Hosted on Vercel.

> **Status:** Phase 1 (foundation) is done: landing page, sign-in, onboarding, dashboard shell,
> settings with collaborators. The other modules show a "coming soon" page until their phase is
> built.

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
   - Phase 1 has one file: `20260926000000_foundation.sql`.
   - Later phases add more files. Run only the new ones each time.
3. Check **Table Editor**: you should see `profiles`, `weddings`, `wedding_members` and
   `wedding_invitations`.

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

---

## 3. Try it out

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
