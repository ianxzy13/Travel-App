import fs from "node:fs";
import path from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const AUTH_FILE = path.join(__dirname, ".auth", "user.json");
export const DEMO_SLUG = "sofia-and-lucas-demo";

/**
 * Signs in once for all tests: asks Supabase (with the admin key) for a
 * one-time sign-in link for E2E_EMAIL, opens it, and saves the cookies.
 * Also selects the demo wedding from `npm run seed` if it exists.
 * If the account hasn't picked an app language yet (so every page would show
 * the welcome screen), English is set for the test run and cleared afterwards.
 */
export default async function globalSetup(config: FullConfig) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.E2E_EMAIL || process.env.SEED_OWNER_EMAIL;
  if (!url || !secret || !email) {
    throw new Error(
      "E2E tests need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and E2E_EMAIL (or SEED_OWNER_EMAIL) in .env.local",
    );
  }
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token)
    throw new Error(`Couldn't create a sign-in link for ${email}: ${error?.message}`);
  const { data: demo } = await admin
    .from("weddings")
    .select("id")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();

  const userId = data.user?.id;
  const { data: profile } = userId
    ? await admin.from("profiles").select("locale").eq("id", userId).maybeSingle()
    : { data: null };
  const setLanguage = !!userId && !!profile && !profile.locale;
  if (setLanguage) await admin.from("profiles").update({ locale: "en" }).eq("id", userId);

  const baseURL = config.projects[0].use.baseURL!;
  const browser = await chromium.launch({ channel: config.projects[0].use.channel });
  const context = await browser.newContext({ baseURL });
  if (demo) await context.addCookies([{ name: "vow_wedding", value: demo.id, url: baseURL }]);
  const page = await context.newPage();
  await page.goto(
    `/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/app`,
  );
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 60_000 });
  if (page.url().includes("/onboarding"))
    throw new Error(`${email} has no wedding yet. Run "npm run seed" first.`);

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await context.storageState({ path: AUTH_FILE });
  await browser.close();

  // Playwright runs the returned function after all tests (global teardown).
  if (setLanguage)
    return async () => {
      await admin.from("profiles").update({ locale: null }).eq("id", userId);
    };
}
