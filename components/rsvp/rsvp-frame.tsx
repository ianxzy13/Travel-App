import Link from "next/link";
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
  /** the wedding's languages: shows a language picker when there are several */
  languages?: string[];
  /** RSVP code, so the household's language choice is remembered */
  code?: string;
  children: React.ReactNode;
}) {
  const [t, locale] = await Promise.all([getTranslations("rsvp"), getLocale()]);
  return (
    <div data-accent={accent} className="bg-background min-h-dvh">
      <div
        className="from-primary-soft absolute inset-x-0 top-0 h-96 bg-gradient-to-b to-transparent"
        aria-hidden
      />
      {languages && languages.length > 1 && (
        <div className="relative flex justify-end px-4 pt-4">
          <RsvpLanguageSwitcher offered={languages} code={code} />
        </div>
      )}
      <main className="relative mx-auto max-w-2xl px-4 pt-12 pb-16 sm:pt-16">
        {couple && (
          <header className="mb-10 text-center">
            <p className="text-primary text-xs font-medium tracking-[0.3em] uppercase">
              {t("weddingOf")}
            </p>
            <h1 className="mt-3 text-5xl sm:text-6xl">{couple}</h1>
            {(date || location) && (
              <p className="text-muted-foreground mt-3">
                {[date ? fmtDate(date, locale, "full") : null, location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </header>
        )}
        {children}
      </main>
      <footer className="text-muted-foreground pb-8 text-center text-xs">
        {t.rich("rsvpsBy", {
          link: (chunks) => (
            <Link href="/" className="font-serif text-sm hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </footer>
    </div>
  );
}
