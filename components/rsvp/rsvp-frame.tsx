import Link from "next/link";
import type { Accent } from "@/lib/database.types";
import { formatWeddingDate } from "@/lib/format";

/** Elegant page frame for the public RSVP pages (uses the couple's accent colour). */
export function RsvpFrame({
  accent = "rose",
  couple,
  date,
  location,
  children,
}: {
  accent?: Accent;
  couple?: string;
  date?: string | null;
  location?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div data-accent={accent} className="bg-background min-h-dvh">
      <div
        className="from-primary-soft absolute inset-x-0 top-0 h-96 bg-gradient-to-b to-transparent"
        aria-hidden
      />
      <main className="relative mx-auto max-w-2xl px-4 pt-12 pb-16 sm:pt-16">
        {couple && (
          <header className="mb-10 text-center">
            <p className="text-primary text-xs font-medium tracking-[0.3em] uppercase">
              The wedding of
            </p>
            <h1 className="mt-3 text-5xl sm:text-6xl">{couple}</h1>
            {(date || location) && (
              <p className="text-muted-foreground mt-3">
                {[date ? formatWeddingDate(date, "EEEE d MMMM yyyy") : null, location]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </header>
        )}
        {children}
      </main>
      <footer className="text-muted-foreground pb-8 text-center text-xs">
        RSVPs by{" "}
        <Link href="/" className="font-serif text-sm hover:underline">
          Vow
        </Link>
      </footer>
    </div>
  );
}
