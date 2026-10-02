import "server-only";
import type { SiteSectionKind, Translations, WebsiteSettingsRow } from "@/lib/database.types";
import { EVENT_TEXT_FIELDS, localizeContent, localized } from "@/lib/i18n/content";
import { contentLocale } from "@/lib/i18n/content-locale";
import { starterContent, starterTexts } from "@/lib/i18n/defaults";
import { signPaths } from "@/lib/inspiration/load";
import type { createClient } from "@/lib/supabase/server";
import {
  parseContent,
  sitePaths,
  type Section,
  type SiteData,
  type SiteEvent,
  type SiteHotel,
} from "./content";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** A section in the editor, with its texts in the other languages. */
export type EditorSection = Section & { sortOrder: number; translations: Translations };

/** An event with its per-language texts (for previews in other languages). */
export type TranslatableEvent = SiteEvent & { translations: Translations };

export type EditorData = {
  settings: Pick<
    WebsiteSettingsRow,
    "template" | "accent_color" | "heading_font" | "body_font" | "hero_path" | "published"
  >;
  sections: EditorSection[];
  hasPassword: boolean;
  site: Omit<SiteData, "look" | "sections" | "events"> & { events: TranslatableEvent[] };
  weddingTranslations: Translations;
};

const toSection = (row: {
  id: string;
  kind: SiteSectionKind;
  visible: boolean;
  content: unknown;
}) =>
  ({
    id: row.id,
    kind: row.kind,
    visible: row.visible,
    content: parseContent(row.kind, row.content),
  }) as Section;

/** Everything the website editor needs (members only; RLS applies). */
export async function loadEditor(
  sb: Supabase,
  wedding: {
    id: string;
    slug: string;
    partner_a_name: string;
    partner_b_name: string;
    wedding_date: string | null;
    location: string | null;
    destination_airport: string | null;
    rsvp_deadline: string | null;
    currency: string;
    languages: string[];
    time_zone: string | null;
    translations: Translations;
  },
): Promise<EditorData | null> {
  const [
    { data: settings },
    { data: rows },
    { data: hasPassword },
    { data: events },
    { data: hotels },
  ] = await Promise.all([
    sb.from("website_settings").select("*").eq("wedding_id", wedding.id).maybeSingle(),
    sb.from("website_sections").select("*").eq("wedding_id", wedding.id).order("sort_order"),
    sb.rpc("site_has_password", { p_wedding_id: wedding.id }),
    sb
      .from("events")
      .select(
        "id, name, event_date, start_time, end_time, venue_name, address, dress_code, description, translations",
      )
      .eq("wedding_id", wedding.id)
      .order("event_date", { nullsFirst: false })
      .order("start_time", { nullsFirst: false })
      .order("sort_order"),
    sb
      .from("hotels")
      .select(
        "id, name, address, distance, website, booking_url, price_per_night, discount_code, cutoff_date",
      )
      .eq("wedding_id", wedding.id)
      .eq("show_on_website", true)
      .order("name"),
  ]);
  if (!settings || !rows) return null;

  // starter texts nobody has changed, in the couple's language
  const shown = await starterTexts(contentLocale(wedding));
  const sections = rows.map((r) => {
    const section = toSection(r);
    return {
      ...section,
      content: starterContent(section.kind, section.content as Record<string, unknown>, shown),
      sortOrder: r.sort_order,
      translations: r.translations ?? {},
    } as EditorSection;
  });
  const signed = await signPaths(sb, sitePaths(settings.hero_path, sections));

  return {
    settings: {
      template: settings.template,
      accent_color: settings.accent_color,
      heading_font: settings.heading_font,
      body_font: settings.body_font,
      hero_path: settings.hero_path,
      published: settings.published,
    },
    sections,
    hasPassword: !!hasPassword,
    weddingTranslations: wedding.translations ?? {},
    site: {
      wedding: {
        slug: wedding.slug,
        partner_a_name: wedding.partner_a_name,
        partner_b_name: wedding.partner_b_name,
        wedding_date: wedding.wedding_date,
        location: wedding.location,
        destination_airport: wedding.destination_airport,
        rsvp_deadline: wedding.rsvp_deadline,
        languages: wedding.languages,
        time_zone: wedding.time_zone,
      },
      events: (events ?? []).map((e) => ({ ...e, name: shown(e.name) })) as TranslatableEvent[],
      hotels: (hotels ?? []) as SiteHotel[],
      currency: wedding.currency,
      images: Object.fromEntries(signed),
    },
  };
}

type PublicSiteJson =
  | { locked: true; couple: string; languages: string[]; settings: SiteData["look"] }
  | {
      locked: false;
      published: boolean;
      has_password: boolean;
      wedding: SiteData["wedding"] & { translations: Translations };
      settings: SiteData["look"];
      sections: { kind: SiteSectionKind; content: unknown; translations: Translations }[];
      events: TranslatableEvent[];
      hotels: SiteHotel[];
      currency: string;
    };

export type PublicSite =
  | { locked: true; couple: string; languages: string[]; look: SiteData["look"] }
  | { locked: false; published: boolean; hasPassword: boolean; data: SiteData };

/** The public website in one language (null = no such site, or not published). */
export async function loadPublicSite(
  sb: Supabase,
  slug: string,
  token: string | null,
  locale: string,
): Promise<PublicSite | null> {
  const { data, error } = await sb.rpc("get_public_site", { p_slug: slug, p_token: token });
  if (error) console.error("[loadPublicSite]", error);
  const json = data as PublicSiteJson | null;
  if (!json) return null;
  if (json.locked) {
    return {
      locked: true,
      couple: json.couple,
      languages: json.languages ?? [],
      look: { ...json.settings, hero_path: null },
    };
  }

  // The couple's texts in this language, falling back to the main language
  // (starter texts nobody has changed are shown in this language too).
  const shown = await starterTexts(locale);
  const sections = json.sections.map((s, i) => {
    const section = toSection({
      id: `${s.kind}-${i}`,
      kind: s.kind,
      visible: true,
      content: s.content,
    });
    return {
      ...section,
      content: starterContent(
        s.kind,
        localizeContent(s.kind, section.content, s.translations?.[locale]),
        shown,
      ),
    } as Section;
  });
  const signed = await signPaths(sb, sitePaths(json.settings.hero_path, sections));
  const { translations: weddingTr, ...wedding } = json.wedding;
  return {
    locked: false,
    published: json.published,
    hasPassword: json.has_password,
    data: {
      wedding: localized(
        // older databases (before the phase 11 update) have no languages yet
        {
          ...wedding,
          languages: wedding.languages ?? ["en"],
          time_zone: wedding.time_zone ?? null,
          translations: weddingTr,
        },
        locale,
        ["location"],
      ),
      look: json.settings,
      sections,
      events: json.events.map((e) => {
        const ev = localized(e, locale, [...EVENT_TEXT_FIELDS]);
        return { ...ev, name: shown(ev.name) };
      }),
      hotels: json.hotels,
      currency: json.currency,
      images: Object.fromEntries(signed),
    },
  };
}
