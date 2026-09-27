// Every text in the app lives in messages/<language>/<part>.json, one file per
// area of the app. English is complete; other languages fall back to English
// for anything missing. Add an area by adding its file for every language and
// listing it here.
import app from "../messages/en/app.json";
import core from "../messages/en/core.json";
import guest from "../messages/en/guest.json";
import guests from "../messages/en/guests.json";
import rsvpAdmin from "../messages/en/rsvpAdmin.json";
import settings from "../messages/en/settings.json";
import start from "../messages/en/start.json";
import seating from "../messages/en/seating.json";
import budget from "../messages/en/budget.json";
import places from "../messages/en/places.json";
import inspiration from "../messages/en/inspiration.json";
import websiteEditor from "../messages/en/websiteEditor.json";
import plan from "../messages/en/plan.json";
import notices from "../messages/en/notices.json";
import { isLocale } from "./locales";
import { withFallback } from "./resolve";

export const PARTS = [
  "guest",
  "app",
  "core",
  "start",
  "settings",
  "guests",
  "rsvpAdmin",
  "seating",
  "budget",
  "places",
  "inspiration",
  "websiteEditor",
  "plan",
  "notices",
] as const;

export const EN = {
  ...guest,
  ...app,
  ...core,
  ...start,
  ...settings,
  ...guests,
  ...rsvpAdmin,
  ...seating,
  ...budget,
  ...places,
  ...inspiration,
  ...websiteEditor,
  ...plan,
  ...notices,
};
export type Messages = typeof EN;

/** Namespaces guests' pages need in the browser (the rest stays on the server). */
export const GUEST_NAMESPACES = ["common", "site", "rsvp", "board", "validation"] as const;

/** All texts of one language, English filling any gaps. */
export async function loadMessages(locale: string): Promise<Messages> {
  if (locale === "en" || !isLocale(locale)) return EN;
  const parts = await Promise.all(
    PARTS.map((p) =>
      import(`../messages/${locale}/${p}.json`)
        .then((m) => m.default as Record<string, unknown>)
        .catch(() => ({})),
    ),
  );
  return withFallback(Object.assign({}, ...parts) as Partial<Messages>, EN);
}
