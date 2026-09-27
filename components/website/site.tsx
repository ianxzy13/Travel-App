import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock, ExternalLink, Gift, MapPin, Plane, Shirt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CodeForm } from "@/components/rsvp/code-form";
import { FindInvitation } from "@/components/rsvp/find-invitation";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { SiteSectionKind, SiteTemplate } from "@/lib/database.types";
import { fmtDate, fmtMoney, fmtTime } from "@/lib/i18n/format";
import { flightSearchLinks, mapsSearch } from "@/lib/places/travel";
import { cn } from "@/lib/utils";
import {
  isSectionEmpty,
  safeUrl,
  type Section,
  type SectionContent,
  type SiteData,
} from "@/lib/website/content";
import { siteVars } from "@/lib/website/templates";
import { SiteCountdown } from "./site-countdown";
import { YourTime } from "./your-time";

// Shorthands for the site's colour/font variables (set by siteVars()).
const heading = "font-[family-name:var(--site-heading)]";
const muted = "text-[var(--site-muted)]";
const accentText = "text-[var(--site-accent)]";
const line = "border-[var(--site-line)]";

type Tr = ReturnType<typeof useTranslations<"site">>;
/** t = template, tr = translations for the visitor's language */
type Ctx = { t: SiteTemplate; data: SiteData; preview: boolean; tr: Tr; locale: string };

/** Picture from storage, kept to a fixed shape by its parent box. */
function Pic({
  ctx,
  path,
  alt,
  sizes,
  priority,
  className,
}: {
  ctx: Ctx;
  path: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const src = path ? ctx.data.images[path] : null;
  if (!src)
    return <div className={cn("absolute inset-0 bg-[var(--site-card)]", className)} aria-hidden />;
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      // previews use temporary browser links that the optimiser can't fetch
      unoptimized={ctx.preview || !src.startsWith("https://")}
      className={cn("object-cover", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Ornaments (inline SVG, drawn in the accent colour)
// ---------------------------------------------------------------------------

function Ornament({ t, className }: { t: SiteTemplate; className?: string }) {
  const cls = cn(accentText, "mx-auto block", className);
  switch (t) {
    case "classic":
      return (
        <svg
          viewBox="0 0 160 16"
          className={cn(cls, "h-4 w-40")}
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        >
          <path d="M0 8h62M98 8h62" />
          <path d="M80 2l6 6-6 6-6-6z" fill="currentColor" />
          <circle cx="68" cy="8" r="1.5" fill="currentColor" />
          <circle cx="92" cy="8" r="1.5" fill="currentColor" />
        </svg>
      );
    case "garden":
      return (
        <svg viewBox="0 0 120 32" className={cn(cls, "h-8 w-32")} aria-hidden fill="currentColor">
          <path d="M60 30C60 18 50 8 30 4c10 8 16 16 30 26z" opacity=".75" />
          <path d="M60 30C60 18 70 8 90 4C80 12 74 20 60 30z" opacity=".75" />
          <path
            d="M60 30c-6-4-16-6-28 0 10 1 18 2 28 0zM60 30c6-4 16-6 28 0-10 1-18 2-28 0z"
            opacity=".5"
          />
          <circle cx="60" cy="8" r="3" opacity=".6" />
        </svg>
      );
    case "boho":
      return (
        <svg
          viewBox="0 0 80 40"
          className={cn(cls, "h-9 w-20")}
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M8 38a32 32 0 0 1 64 0" />
          <path d="M18 38a22 22 0 0 1 44 0" opacity=".7" />
          <path d="M28 38a12 12 0 0 1 24 0" opacity=".45" />
        </svg>
      );
    case "beach":
      return (
        <svg
          viewBox="0 0 120 12"
          className={cn(cls, "h-3 w-28")}
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M0 6c10-6 20-6 30 0s20 6 30 0 20-6 30 0 20 6 30 0" />
        </svg>
      );
    default:
      return null;
  }
}

function Wave({ fill, flip }: { fill: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={cn("block h-10 w-full @3xl:h-16", flip && "rotate-180")}
      aria-hidden
    >
      <path
        d="M0 40c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v40H0z"
        fill={fill}
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page frame
// ---------------------------------------------------------------------------

/**
 * The whole wedding website. The same content renders in five looks; the
 * layout uses container queries (@3xl:…) so the editor's phone preview
 * behaves exactly like a real phone.
 */
export function Site({ data, preview = false }: { data: SiteData; preview?: boolean }) {
  const t = data.look.template;
  const tr = useTranslations("site");
  const locale = useLocale();
  const ctx: Ctx = { t, data, preview, tr, locale };
  // The public site hides empty sections; the preview shows a hint instead.
  const sections = data.sections.filter((s) => preview || !isSectionEmpty(s, data));
  const navSections = sections.filter(
    (s) => s.kind !== "home" && (!preview || !isSectionEmpty(s, data)),
  );
  const couple = `${data.wedding.partner_a_name} & ${data.wedding.partner_b_name}`;
  let n = 0;

  return (
    <div
      style={{
        ...siteVars(data.look),
        // make the RSVP form (app components) match the site
        ["--background" as string]: "var(--site-bg)",
        ["--foreground" as string]: "var(--site-fg)",
        ["--card" as string]: "var(--site-bg)",
        ["--popover" as string]: "var(--site-bg)",
        ["--muted" as string]: "var(--site-card)",
        ["--muted-foreground" as string]: "var(--site-muted)",
        ["--border" as string]: "var(--site-line)",
        ["--input" as string]: "var(--site-line)",
        ["--primary" as string]: "var(--site-accent)",
        ["--primary-foreground" as string]: "var(--site-on-accent)",
        ["--ring" as string]: "var(--site-accent)",
        colorScheme: "light",
      }}
      className="@container min-h-full bg-[var(--site-bg)] font-[family-name:var(--site-body)] text-[var(--site-fg)] antialiased"
    >
      <Nav ctx={ctx} couple={couple} sections={navSections} />
      <main>
        {sections.map((s) => {
          const index = s.kind === "home" ? 0 : ++n;
          const empty = isSectionEmpty(s, data);
          return s.kind === "home" ? (
            <Hero
              key={s.kind}
              ctx={ctx}
              content={s.content}
              hasRsvp={sections.some((x) => x.kind === "rsvp")}
            />
          ) : (
            <Block key={s.kind} ctx={ctx} kind={s.kind} index={index}>
              {empty ? (
                <EmptyHint ctx={ctx} kind={s.kind} />
              ) : (
                <SectionBody ctx={ctx} section={s} />
              )}
            </Block>
          );
        })}
      </main>
      <footer className={cn("border-t px-5 py-12 text-center", line)}>
        <Ornament t={t} className="mb-4" />
        <p className={cn(heading, "text-2xl")}>{couple}</p>
        <p className={cn(muted, "mt-1 text-sm")}>
          {data.wedding.wedding_date
            ? fmtDate(data.wedding.wedding_date, locale, "long")
            : tr("dateTbd")}
          {data.wedding.location ? ` · ${data.wedding.location}` : ""}
        </p>
        <p className={cn(muted, "mt-6 text-xs")}>
          {tr.rich("madeWith", {
            link: (chunks) => (
              <Link href="/" className="underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </p>
      </footer>
    </div>
  );
}

function Nav({ ctx, couple, sections }: { ctx: Ctx; couple: string; sections: Section[] }) {
  const initials = `${ctx.data.wedding.partner_a_name.charAt(0)} & ${ctx.data.wedding.partner_b_name.charAt(0)}`;
  const modern = ctx.t === "modern";
  return (
    <nav
      aria-label={ctx.tr("nav")}
      className={cn(
        "sticky top-0 z-20 border-b bg-[color-mix(in_srgb,var(--site-bg)_90%,transparent)] backdrop-blur",
        line,
        modern && "border-b-2",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
        <a
          href="#home"
          className={cn(
            heading,
            "shrink-0 text-xl",
            modern && "font-bold tracking-tight uppercase",
          )}
          aria-label={couple}
        >
          {initials}
        </a>
        <ul className="-me-5 flex min-w-0 flex-1 [scrollbar-width:none] justify-end gap-5 overflow-x-auto pe-5 text-sm whitespace-nowrap">
          {sections.map((s) => (
            <li key={s.kind}>
              <a
                href={`#${s.kind}`}
                className={cn(
                  "hover:text-[var(--site-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]",
                  (modern || ctx.t === "beach") && "text-xs tracking-[0.15em] uppercase",
                )}
              >
                {ctx.tr(`sections.${s.kind}`)}
              </a>
            </li>
          ))}
        </ul>
        {/* guests pick a language; hidden in the editor preview (it would reload the editor) */}
        {!ctx.preview && ctx.data.wedding.languages.length > 1 && (
          <LanguageSwitcher offered={ctx.data.wedding.languages} className="shrink-0" />
        )}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Hero (the biggest difference between templates)
// ---------------------------------------------------------------------------

function Hero({
  ctx,
  content,
  hasRsvp,
}: {
  ctx: Ctx;
  content: SectionContent["home"];
  hasRsvp: boolean;
}) {
  const { t, data } = ctx;
  const w = data.wedding;
  const hero = data.look.hero_path;
  const date = w.wedding_date ? fmtDate(w.wedding_date, ctx.locale, "full") : ctx.tr("dateTbd");
  const place = w.location;
  const tagline = content.tagline.trim();
  const cta = hasRsvp && (
    <a
      href="#rsvp"
      className={cn(
        "inline-flex h-11 items-center justify-center px-7 text-sm font-medium transition-opacity hover:opacity-90",
        "bg-[var(--site-accent)] text-[var(--site-on-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]",
        t === "modern"
          ? "rounded-none tracking-[0.2em] uppercase"
          : t === "classic"
            ? "rounded-sm tracking-widest uppercase"
            : "rounded-full",
      )}
    >
      {ctx.tr("rsvpButton")}
    </a>
  );

  if (t === "modern") {
    return (
      <section id="home" className="scroll-mt-16">
        <div
          className={cn(
            "relative flex min-h-[30rem] flex-col justify-end @3xl:min-h-[40rem]",
            hero ? "text-white" : "",
          )}
        >
          {hero && (
            <>
              <Pic ctx={ctx} path={hero} alt="" sizes="100vw" priority />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                aria-hidden
              />
            </>
          )}
          <div className="relative mx-auto w-full max-w-6xl px-5 pt-24 pb-10">
            {tagline && <p className="mb-4 text-xs tracking-[0.3em] uppercase">{tagline}</p>}
            <h1
              className={cn(
                heading,
                "text-6xl leading-[0.9] font-extrabold tracking-tighter break-words uppercase @xl:text-7xl @3xl:text-9xl",
              )}
            >
              {w.partner_a_name}
              <br />& {w.partner_b_name}
            </h1>
            <div
              className={cn(
                "mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 border-t-2 pt-4 text-sm tracking-[0.15em] uppercase",
                hero ? "border-white" : "border-[var(--site-fg)]",
              )}
            >
              <span>{date}</span>
              {place && <span>{place}</span>}
              <span className="@3xl:ml-auto">
                <SiteCountdown date={w.wedding_date} />
              </span>
            </div>
          </div>
        </div>
        {cta && <div className="mx-auto max-w-6xl px-5 py-8">{cta}</div>}
      </section>
    );
  }

  if (t === "beach") {
    return (
      <section id="home" className="relative scroll-mt-16">
        <div className="relative flex min-h-[30rem] items-center justify-center overflow-hidden px-5 py-24 text-center @3xl:min-h-[38rem]">
          {hero ? (
            <>
              <Pic ctx={ctx} path={hero} alt="" sizes="100vw" priority />
              <div
                className="absolute inset-0 bg-[color-mix(in_srgb,var(--site-bg)_45%,transparent)]"
                aria-hidden
              />
            </>
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-b from-[var(--site-card)] to-[var(--site-bg)]"
              aria-hidden
            />
          )}
          <div className="relative max-w-3xl rounded-3xl bg-[color-mix(in_srgb,var(--site-bg)_70%,transparent)] px-6 py-10 backdrop-blur-sm @3xl:px-14">
            {tagline && <p className="text-xs tracking-[0.35em] uppercase">{tagline}</p>}
            <h1
              className={cn(
                heading,
                "mt-4 text-4xl font-light tracking-[0.12em] uppercase @xl:text-5xl @3xl:text-6xl",
              )}
            >
              {w.partner_a_name} <span className={accentText}>&</span> {w.partner_b_name}
            </h1>
            <Ornament t={t} className="my-5" />
            <p className="tracking-wide">{date}</p>
            {place && <p className={cn(muted, "mt-1")}>{place}</p>}
            <p className={cn(muted, "mt-4 text-sm")}>
              <SiteCountdown date={w.wedding_date} />
            </p>
            {cta && <div className="mt-6">{cta}</div>}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0">
          <Wave fill="var(--site-bg)" />
        </div>
      </section>
    );
  }

  if (t === "boho") {
    return (
      <section id="home" className="scroll-mt-16 bg-[var(--site-card)] px-5 py-14 @3xl:py-20">
        <div className="mx-auto grid max-w-5xl items-center gap-10 @3xl:grid-cols-2">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-t-full border-8 border-[var(--site-bg)] shadow-lg">
            <Pic ctx={ctx} path={hero} alt="" sizes="(min-width: 768px) 400px, 90vw" priority />
          </div>
          <div className="text-center @3xl:text-start">
            <Ornament t={t} className="mb-4 @3xl:mx-0" />
            {tagline && (
              <p className={cn(accentText, "text-sm font-semibold tracking-[0.25em] uppercase")}>
                {tagline}
              </p>
            )}
            <h1 className={cn(heading, "mt-3 text-5xl leading-tight @3xl:text-6xl")}>
              {w.partner_a_name}
              <span className={cn(accentText, "block text-4xl italic")}>and</span>
              {w.partner_b_name}
            </h1>
            <p className="mt-6 text-lg">{date}</p>
            {place && <p className={muted}>{place}</p>}
            <div className={cn(muted, "mt-4")}>
              <SiteCountdown date={w.wedding_date} />
            </div>
            {cta && <div className="mt-8">{cta}</div>}
          </div>
        </div>
      </section>
    );
  }

  if (t === "garden") {
    return (
      <section id="home" className="scroll-mt-16 px-5 py-16 text-center @3xl:py-24">
        {tagline && <p className={cn(muted, "text-sm tracking-[0.3em] uppercase")}>{tagline}</p>}
        <div className="relative mx-auto mt-8 w-60 @3xl:w-72">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[50%] border-4 border-[var(--site-card)] shadow-md">
            <Pic ctx={ctx} path={hero} alt="" sizes="300px" priority />
          </div>
          <Ornament t={t} className="absolute -bottom-5 left-1/2 w-40 -translate-x-1/2" />
        </div>
        <h1 className={cn(heading, "mt-12 text-5xl italic @3xl:text-7xl")}>
          {w.partner_a_name} <span className={accentText}>&</span> {w.partner_b_name}
        </h1>
        <p className="mt-5 text-lg">{date}</p>
        {place && <p className={muted}>{place}</p>}
        <p className={cn(muted, "mt-3 text-sm")}>
          <SiteCountdown date={w.wedding_date} />
        </p>
        {cta && <div className="mt-8">{cta}</div>}
      </section>
    );
  }

  // classic
  return (
    <section id="home" className="scroll-mt-16 px-5 pt-16 pb-12 text-center @3xl:pt-24">
      {tagline && (
        <p className={cn(accentText, "text-xs font-medium tracking-[0.35em] uppercase")}>
          {tagline}
        </p>
      )}
      <h1 className={cn(heading, "mt-6 text-6xl leading-none font-medium @3xl:text-8xl")}>
        {w.partner_a_name}
        <span className={cn(accentText, "my-2 block text-4xl italic @3xl:text-5xl")}>&amp;</span>
        {w.partner_b_name}
      </h1>
      <Ornament t={t} className="my-8" />
      <p className="text-sm tracking-[0.25em] uppercase">{date}</p>
      {place && <p className={cn(muted, "mt-2")}>{place}</p>}
      <p className={cn(muted, "mt-3 text-sm italic")}>
        <SiteCountdown date={w.wedding_date} />
      </p>
      {cta && <div className="mt-8">{cta}</div>}
      {hero && (
        <div className={cn("mx-auto mt-12 max-w-4xl border p-2", line)}>
          <div className="relative aspect-[3/2]">
            <Pic ctx={ctx} path={hero} alt="" sizes="(min-width: 900px) 900px, 95vw" priority />
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section frame + heading
// ---------------------------------------------------------------------------

function Block({
  ctx,
  kind,
  index,
  children,
}: {
  ctx: Ctx;
  kind: SiteSectionKind;
  index: number;
  children: React.ReactNode;
}) {
  const { t } = ctx;
  const alt = index % 2 === 0;
  const tinted = (t === "boho" || t === "garden") && alt;
  const beachTint = t === "beach" && alt;
  return (
    <section
      id={kind}
      aria-labelledby={`${kind}-title`}
      className={cn("scroll-mt-16", tinted && "bg-[var(--site-card)]")}
    >
      {beachTint && <Wave fill="var(--site-card)" flip />}
      <div
        className={cn(
          "px-5 py-16 @3xl:py-24",
          beachTint && "bg-[var(--site-card)]",
          t === "classic" && index > 1 && "border-t",
          t === "modern" && "border-t-2 border-[var(--site-fg)]",
          line,
        )}
      >
        <div
          className={cn(
            "mx-auto",
            t === "modern" ? "grid max-w-6xl gap-8 @3xl:grid-cols-[1fr_2fr]" : "max-w-5xl",
          )}
        >
          <Heading ctx={ctx} kind={kind} index={index} />
          <div className={cn(t !== "modern" && "mt-10")}>{children}</div>
        </div>
      </div>
      {beachTint && <Wave fill="var(--site-card)" />}
    </section>
  );
}

function Heading({ ctx, kind, index }: { ctx: Ctx; kind: SiteSectionKind; index: number }) {
  const title = ctx.tr(`sections.${kind}`);
  const id = `${kind}-title`;
  switch (ctx.t) {
    case "modern":
      return (
        <div>
          <p className="text-sm tabular-nums">{String(index).padStart(2, "0")}</p>
          <h2
            id={id}
            className={cn(
              heading,
              "mt-2 text-4xl leading-none font-extrabold tracking-tighter uppercase @3xl:text-6xl",
            )}
          >
            {title}
          </h2>
        </div>
      );
    case "beach":
      return (
        <div className="text-center">
          <h2
            id={id}
            className={cn(heading, "text-2xl font-light tracking-[0.3em] uppercase @3xl:text-3xl")}
          >
            {title}
          </h2>
          <Ornament t="beach" className="mt-4" />
        </div>
      );
    case "garden":
      return (
        <div className="text-center">
          <Ornament t="garden" className="mb-3" />
          <h2 id={id} className={cn(heading, "text-4xl italic @3xl:text-5xl")}>
            {title}
          </h2>
        </div>
      );
    case "boho":
      return (
        <div className="text-center">
          <Ornament t="boho" className="mb-3" />
          <h2 id={id} className={cn(heading, "text-4xl @3xl:text-5xl")}>
            {title}
          </h2>
        </div>
      );
    default:
      return (
        <div className="text-center">
          <h2 id={id} className={cn(heading, "text-4xl font-medium @3xl:text-5xl")}>
            {title}
          </h2>
          <Ornament t="classic" className="mt-4" />
        </div>
      );
  }
}

function EmptyHint({ ctx, kind }: { ctx: Ctx; kind: SiteSectionKind }) {
  return (
    <p className={cn("rounded-xl border-2 border-dashed p-6 text-center text-sm", line, muted)}>
      {ctx.tr(
        kind === "events" ? "empty.events" : kind === "travel" ? "empty.travel" : "empty.other",
      )}{" "}
      {ctx.tr("empty.hidden")}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Section contents
// ---------------------------------------------------------------------------

function SectionBody({ ctx, section }: { ctx: Ctx; section: Section }) {
  switch (section.kind) {
    case "story":
      return <Story ctx={ctx} c={section.content} />;
    case "events":
      return <Events ctx={ctx} intro={section.content.intro} />;
    case "travel":
      return <Travel ctx={ctx} c={section.content} />;
    case "rsvp":
      return <Rsvp ctx={ctx} intro={section.content.intro} />;
    case "party":
      return <Party ctx={ctx} c={section.content} />;
    case "registry":
      return <Registry ctx={ctx} c={section.content} />;
    case "faq":
      return <Faq ctx={ctx} c={section.content} />;
    case "gallery":
      return <Gallery ctx={ctx} c={section.content} />;
    default:
      return null;
  }
}

const cardShape: Record<SiteTemplate, string> = {
  classic: "border rounded-none",
  modern: "border-t-2 border-[var(--site-fg)] rounded-none px-0",
  garden: "rounded-3xl bg-[color-mix(in_srgb,var(--site-bg)_65%,white)]",
  boho: "rounded-t-[2.5rem] rounded-b-xl bg-[var(--site-bg)] border",
  beach: "rounded-2xl bg-white/70 shadow-sm",
};
const card = (t: SiteTemplate) => cn("p-6", line, cardShape[t]);

const photoShape: Record<SiteTemplate, string> = {
  classic: "rounded-full",
  modern: "rounded-none grayscale",
  garden: "rounded-full",
  boho: "rounded-t-full",
  beach: "rounded-3xl",
};

function Intro({ ctx, text }: { ctx: Ctx; text: string }) {
  if (!text.trim()) return null;
  return (
    <p
      className={cn(
        "mb-10 text-lg whitespace-pre-wrap",
        ctx.t === "modern" ? "max-w-2xl" : "mx-auto max-w-2xl text-center",
      )}
    >
      {text}
    </p>
  );
}

function Story({ ctx, c }: { ctx: Ctx; c: SectionContent["story"] }) {
  const modern = ctx.t === "modern";
  return (
    <>
      <Intro ctx={ctx} text={c.intro} />
      {c.milestones.length > 0 && (
        <ol
          className={cn(
            "relative space-y-10",
            !modern &&
              "@3xl:before:absolute @3xl:before:inset-y-0 @3xl:before:left-1/2 @3xl:before:w-px @3xl:before:bg-[var(--site-line)]",
          )}
        >
          {c.milestones.map((m, i) => (
            <li
              key={m.id}
              className={cn(
                "relative grid gap-5",
                !modern && "items-center",
                modern ? "@xl:grid-cols-[8rem_1fr]" : "@3xl:grid-cols-2 @3xl:gap-16",
              )}
            >
              {modern ? (
                <p className="text-sm font-bold tracking-widest uppercase">{m.date}</p>
              ) : (
                m.photo && (
                  <div
                    className={cn(
                      "relative aspect-[4/3] overflow-hidden",
                      ctx.t === "boho" ? "rounded-t-full" : "rounded-2xl",
                      ctx.t === "classic" && "rounded-none",
                      i % 2 && "@3xl:order-2",
                    )}
                  >
                    <Pic
                      ctx={ctx}
                      path={m.photo}
                      alt={m.title}
                      sizes="(min-width: 768px) 480px, 90vw"
                    />
                  </div>
                )
              )}
              <div
                className={cn(
                  !modern &&
                    !m.photo &&
                    "@3xl:col-span-2 @3xl:mx-auto @3xl:max-w-xl @3xl:text-center",
                  !modern && m.photo && i % 2 && "@3xl:text-end",
                )}
              >
                {!modern && m.date && (
                  <p className={cn(accentText, "text-sm font-medium tracking-[0.2em] uppercase")}>
                    {m.date}
                  </p>
                )}
                {m.title && (
                  <h3
                    className={cn(
                      heading,
                      "mt-1 text-2xl @3xl:text-3xl",
                      modern && "font-bold tracking-tight",
                    )}
                  >
                    {m.title}
                  </h3>
                )}
                {m.text && <p className={cn(muted, "mt-2 whitespace-pre-wrap")}>{m.text}</p>}
                {modern && m.photo && (
                  <div className="relative mt-4 aspect-[16/9] overflow-hidden grayscale">
                    <Pic
                      ctx={ctx}
                      path={m.photo}
                      alt={m.title}
                      sizes="(min-width: 768px) 640px, 90vw"
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

function Events({ ctx, intro }: { ctx: Ctx; intro: string }) {
  return (
    <>
      <Intro ctx={ctx} text={intro} />
      <ul className={cn("grid gap-5", ctx.data.events.length > 1 && "@2xl:grid-cols-2")}>
        {ctx.data.events.map((e) => {
          const start = fmtTime(e.start_time, ctx.locale);
          const end = fmtTime(e.end_time, ctx.locale);
          const where = [e.venue_name, e.address].filter(Boolean).join(", ");
          return (
            <li key={e.id} className={card(ctx.t)}>
              <h3
                className={cn(
                  heading,
                  "text-2xl @3xl:text-3xl",
                  ctx.t === "modern" && "font-bold tracking-tight",
                )}
              >
                {e.name}
              </h3>
              <dl className="mt-4 space-y-2 text-sm">
                <Row icon={CalendarDays} label={ctx.tr("event.date")}>
                  {e.event_date ? fmtDate(e.event_date, ctx.locale, "full") : ctx.tr("dateTbd")}
                </Row>
                {start && (
                  <Row icon={Clock} label={ctx.tr("event.time")}>
                    {end ? `${start} – ${end}` : start}
                    {e.event_date && e.start_time && ctx.data.wedding.time_zone && (
                      <YourTime
                        date={e.event_date}
                        time={e.start_time}
                        timeZone={ctx.data.wedding.time_zone}
                      />
                    )}
                  </Row>
                )}
                {where && (
                  <Row icon={MapPin} label={ctx.tr("event.place")}>
                    {e.venue_name && <span className="block font-medium">{e.venue_name}</span>}
                    {e.address && <span className={cn("block", muted)}>{e.address}</span>}
                    <a
                      href={mapsSearch(where)}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        accentText,
                        "mt-1 inline-flex items-center gap-1 underline underline-offset-2",
                      )}
                    >
                      {ctx.tr("event.openMap")} <ExternalLink className="size-3" aria-hidden />
                      <span className="sr-only">{ctx.tr("newTab")}</span>
                    </a>
                  </Row>
                )}
                {e.dress_code && (
                  <Row icon={Shirt} label={ctx.tr("event.dressCode")}>
                    {e.dress_code}
                  </Row>
                )}
              </dl>
              {e.description && (
                <p className={cn(muted, "mt-4 text-sm whitespace-pre-wrap")}>{e.description}</p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Clock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <dt className="pt-0.5">
        <Icon className={cn("size-4", accentText)} aria-hidden />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Travel({ ctx, c }: { ctx: Ctx; c: SectionContent["travel"] }) {
  const { data } = ctx;
  const airport = data.wedding.destination_airport;
  return (
    <>
      <Intro ctx={ctx} text={c.intro} />
      {airport && (
        <div className={cn(card(ctx.t), "mb-5 flex flex-wrap items-center gap-3")}>
          <Plane className={cn("size-5", accentText)} aria-hidden />
          <p className="flex-1">
            {ctx.tr.rich("travel.airport", { code: airport, b: (c) => <strong>{c}</strong> })}
          </p>
          <a
            href={flightSearchLinks({ to: airport }).google}
            target="_blank"
            rel="noreferrer"
            className={cn(accentText, "text-sm underline underline-offset-2")}
          >
            {ctx.tr("travel.searchFlights")}
            <span className="sr-only"> {ctx.tr("newTab")}</span>
          </a>
        </div>
      )}
      {data.hotels.length > 0 && (
        <ul className={cn("grid gap-5", data.hotels.length > 1 && "@2xl:grid-cols-2")}>
          {data.hotels.map((h) => {
            const book = safeUrl(h.booking_url) ?? safeUrl(h.website);
            const site = safeUrl(h.website);
            return (
              <li key={h.id} className={cn(card(ctx.t), "flex flex-col")}>
                <h3
                  className={cn(
                    heading,
                    "text-2xl",
                    ctx.t === "modern" && "font-bold tracking-tight",
                  )}
                >
                  {h.name}
                </h3>
                {h.distance && <p className={cn(muted, "text-sm")}>{h.distance}</p>}
                {h.address && <p className="mt-2 text-sm">{h.address}</p>}
                <div className="mt-3 space-y-1 text-sm">
                  {h.price_per_night != null && (
                    <p>
                      {ctx.tr.rich("travel.perNight", {
                        price: fmtMoney(Number(h.price_per_night), data.currency, ctx.locale),
                        b: (c) => <span className="font-medium">{c}</span>,
                      })}
                    </p>
                  )}
                  {h.discount_code && (
                    <p>
                      {ctx.tr.rich("travel.code", {
                        code: h.discount_code,
                        mono: (c) => (
                          <span className="rounded bg-[var(--site-card)] px-1.5 py-0.5 font-mono">
                            {c}
                          </span>
                        ),
                      })}
                    </p>
                  )}
                  {h.cutoff_date && (
                    <p>
                      {ctx.tr.rich("travel.bookBy", {
                        date: fmtDate(h.cutoff_date, ctx.locale, "long"),
                        b: (c) => <span className="font-medium">{c}</span>,
                      })}
                    </p>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-3 pt-4 text-sm">
                  {book && (
                    <a
                      href={book}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-full bg-[var(--site-accent)] px-4 text-[var(--site-on-accent)]"
                    >
                      <span aria-hidden>{ctx.tr("travel.bookRoom")}</span>
                      <span className="sr-only">
                        {ctx.tr("travel.bookRoomAt", { name: h.name })} {ctx.tr("newTab")}
                      </span>
                    </a>
                  )}
                  {site && site !== book && (
                    <a
                      href={site}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center underline underline-offset-2"
                    >
                      <span aria-hidden>{ctx.tr("travel.website")}</span>
                      <span className="sr-only">
                        {ctx.tr("travel.websiteOf", { name: h.name })}
                      </span>
                    </a>
                  )}
                  {h.address && (
                    <a
                      href={mapsSearch(`${h.name}, ${h.address}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center underline underline-offset-2"
                    >
                      <span aria-hidden>{ctx.tr("travel.map")}</span>
                      <span className="sr-only">{ctx.tr("travel.mapOf", { name: h.name })}</span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {c.notes.trim() && (
        <p
          className={cn(
            "mt-8 whitespace-pre-wrap",
            ctx.t !== "modern" && "mx-auto max-w-2xl text-center",
          )}
        >
          {c.notes}
        </p>
      )}
    </>
  );
}

function Rsvp({ ctx, intro }: { ctx: Ctx; intro: string }) {
  const deadline = ctx.data.wedding.rsvp_deadline;
  return (
    <>
      <Intro ctx={ctx} text={intro} />
      {deadline && (
        <p className={cn(muted, "-mt-6 mb-8", ctx.t !== "modern" && "text-center")}>
          {ctx.tr.rich("rsvp.replyBy", {
            date: fmtDate(deadline, ctx.locale, "long"),
            b: (c) => <strong className="text-[var(--site-fg)]">{c}</strong>,
          })}
        </p>
      )}
      {/* In the editor preview the forms are inert, so clicks don't leave the editor. */}
      <div
        inert={ctx.preview}
        className={cn(card(ctx.t), "mx-auto max-w-md space-y-6", ctx.t === "modern" && "mx-0")}
      >
        <FindInvitation slug={ctx.data.wedding.slug} />
        <div className={cn("flex items-center gap-3 text-xs tracking-widest uppercase", muted)}>
          <span className="h-px flex-1 bg-[var(--site-line)]" /> {ctx.tr("rsvp.or")}{" "}
          <span className="h-px flex-1 bg-[var(--site-line)]" />
        </div>
        <CodeForm />
      </div>
    </>
  );
}

function Party({ ctx, c }: { ctx: Ctx; c: SectionContent["party"] }) {
  const people = c.people.filter((p) => p.name.trim());
  return (
    <ul className="grid grid-cols-2 gap-x-5 gap-y-10 @xl:grid-cols-3 @4xl:grid-cols-4">
      {people.map((p) => (
        <li key={p.id} className={cn(ctx.t !== "modern" && "text-center")}>
          <div
            className={cn(
              "relative mx-auto aspect-square w-full max-w-44 overflow-hidden bg-[var(--site-card)]",
              photoShape[ctx.t],
              ctx.t === "boho" && "aspect-[3/4]",
            )}
          >
            {p.photo ? (
              <Pic ctx={ctx} path={p.photo} alt={p.name} sizes="180px" />
            ) : (
              <span
                className={cn(
                  heading,
                  "absolute inset-0 flex items-center justify-center text-4xl",
                  accentText,
                )}
                aria-hidden
              >
                {p.name.trim().charAt(0)}
              </span>
            )}
          </div>
          <h3
            className={cn(
              heading,
              "mt-3 text-xl",
              ctx.t === "modern" && "font-bold tracking-tight",
            )}
          >
            {p.name}
          </h3>
          {p.role && (
            <p className={cn(accentText, "text-xs font-medium tracking-[0.2em] uppercase")}>
              {p.role}
            </p>
          )}
          {p.bio && <p className={cn(muted, "mt-2 text-sm")}>{p.bio}</p>}
        </li>
      ))}
    </ul>
  );
}

function Registry({ ctx, c }: { ctx: Ctx; c: SectionContent["registry"] }) {
  const links = c.links.map((l) => ({ ...l, href: safeUrl(l.url) })).filter((l) => l.href);
  return (
    <>
      <Intro ctx={ctx} text={c.intro} />
      <ul
        className={cn(
          "grid gap-5",
          links.length > 1 && "@2xl:grid-cols-2",
          links.length > 2 && "@4xl:grid-cols-3",
        )}
      >
        {links.map((l) => (
          <li
            key={l.id}
            className={cn(
              card(ctx.t),
              "flex flex-col",
              ctx.t !== "modern" && "items-center text-center",
            )}
          >
            <Gift className={cn("mb-3 size-6", accentText)} aria-hidden />
            <h3
              className={cn(heading, "text-2xl", ctx.t === "modern" && "font-bold tracking-tight")}
            >
              {l.label || new URL(l.href!).hostname}
            </h3>
            {l.note && <p className={cn(muted, "mt-2 text-sm")}>{l.note}</p>}
            <a
              href={l.href!}
              target="_blank"
              rel="noreferrer"
              className={cn(
                accentText,
                "mt-4 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2",
              )}
            >
              {ctx.tr("registry.visit")} <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only">
                {l.label} {ctx.tr("newTab")}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function Faq({ ctx, c }: { ctx: Ctx; c: SectionContent["faq"] }) {
  const items = c.items.filter((i) => i.question.trim() && i.answer.trim());
  return (
    <div
      className={cn(
        "divide-y border-y",
        line,
        "divide-[var(--site-line)]",
        ctx.t !== "modern" && "mx-auto max-w-2xl",
      )}
    >
      {items.map((i) => (
        <details key={i.id} className="group py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--site-accent)] [&::-webkit-details-marker]:hidden">
            {i.question}
            <span
              className={cn(
                accentText,
                "text-2xl leading-none transition-transform group-open:rotate-45",
              )}
              aria-hidden
            >
              +
            </span>
          </summary>
          <p className={cn(muted, "mt-3 whitespace-pre-wrap")}>{i.answer}</p>
        </details>
      ))}
    </div>
  );
}

function Gallery({ ctx, c }: { ctx: Ctx; c: SectionContent["gallery"] }) {
  const round =
    ctx.t === "modern" || ctx.t === "classic"
      ? ""
      : ctx.t === "boho"
        ? "rounded-t-full rounded-b-lg"
        : "rounded-2xl";
  return (
    <ul className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
      {c.photos.map((p, i) => (
        <li
          key={p.id}
          className={cn(ctx.t === "modern" && i % 5 === 0 && "col-span-2 @3xl:col-span-2")}
        >
          <figure>
            <div
              className={cn(
                "relative overflow-hidden",
                ctx.t === "boho"
                  ? "aspect-[3/4]"
                  : ctx.t === "modern" && i % 5 === 0
                    ? "aspect-[2/1]"
                    : "aspect-square",
                round,
              )}
            >
              <Pic
                ctx={ctx}
                path={p.path}
                alt={p.caption || ctx.tr("gallery.alt")}
                sizes="(min-width: 768px) 33vw, 50vw"
              />
            </div>
            {p.caption && (
              <figcaption className={cn(muted, "mt-1.5 text-center text-sm")}>
                {p.caption}
              </figcaption>
            )}
          </figure>
        </li>
      ))}
    </ul>
  );
}
