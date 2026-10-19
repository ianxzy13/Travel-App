import { getLocale, getTranslations } from "next-intl/server";
import type { Accent } from "@/lib/database.types";
import { fmtDate } from "@/lib/i18n/format";
import { RsvpLanguageSwitcher } from "./rsvp-language-switcher";

/** Elegant page frame for the public RSVP pages (uses the couple's accent colour). */
export async function RsvpFrame({
  accent = "rose",
  couple,
  date,
  location,
  languages,
  code,
  children,
}: {
  accent?: Accent;
  couple?: string;
  date?: string | null;
  location?: string | null;
  /** the wedding's languages (listed first in the language picker) */
  languages?: string[];
  /** RSVP code, so the household's language choice is remembered */
  code?: string;
  children: React.ReactNode;
}) {
  const [t, locale] = await Promise.all([getTranslations("rsvp"), getLocale()]);
  return (
    <div data-accent={accent} className="bg-background min-h-dvh">
      <div className="soft-photo absolute inset-x-0 top-0 h-72 sm:h-80" aria-hidden />
      {languages && (
        <div className="relative flex justify-end px-4 pt-4">
          <RsvpLanguageSwitcher offered={languages} code={code} />
        </div>
      )}
      <main className="relative mx-auto max-w-2xl px-4 pt-20 pb-20 sm:pt-28">
        {couple && (
          <header className="bg-card mb-12 rounded-md border px-6 py-12 text-center sm:px-12">
            <p className="eyebrow text-primary-ink">{t("weddingOf")}</p>
            <h1 className="font-script mt-4 text-6xl leading-tight font-normal sm:text-7xl">
              {couple}
            </h1>
            <div aria-hidden className="bg-primary mx-auto my-6 h-px w-16" />
            {(date || location) && (
              <p className="caps text-muted-foreground">
                {[date ? fmtDate(date, locale, "full") : null, location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </header>
        )}
        {children}
      </main>
      <footer className="text-muted-foreground space-y-2 pb-10 text-center text-xs">
        {t.rich("rsvpsBy", {
          link: (chunks) => (
            // a normal link (full page load): the app uses its own language, and an
            // in-page switch would keep parts of this page in the guest's language
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/" className="font-serif text-sm hover:underline">
              {chunks}
            </a>
          ),
        })}
        <p>
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            {t("footerPrivacy")}
          </a>
          {" · "}
          <a href="/terms" className="underline underline-offset-2 hover:text-foreground">
            {t("footerTerms")}
          </a>
        </p>
      </footer>
    </div>
  );
}
