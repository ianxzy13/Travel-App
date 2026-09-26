import "server-only";
import type { SiteSectionKind, WebsiteSettingsRow } from "@/lib/database.types";
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

export type EditorSection = Section & { sortOrder: number };

export type EditorData = {
  settings: Pick<WebsiteSettingsRow, "template" | "accent_color" | "heading_font" | "body_font" | "hero_path" | "published">;
  sections: EditorSection[];
  hasPassword: boolean;
  site: Omit<SiteData, "look" | "sections">;
};

const toSection = (row: { id: string; kind: SiteSectionKind; visible: boolean; content: unknown }) =>
  ({ id: row.id, kind: row.kind, visible: row.visible, content: parseContent(row.kind, row.content) }) as Section;

/** Everything the website editor needs (members only; RLS applies). */
export async function loadEditor(
  sb: Supabase,
  wedding: { id: string; slug: string; partner_a_name: string; partner_b_name: string; wedding_date: string | null; location: string | null; destination_airport: string | null; rsvp_deadline: string | null; currency: string },
): Promise<EditorData | null> {
  const [{ data: settings }, { data: rows }, { data: hasPassword }, { data: events }, { data: hotels }] = await Promise.all([
    sb.from("website_settings").select("*").eq("wedding_id", wedding.id).maybeSingle(),
    sb.from("website_sections").select("*").eq("wedding_id", wedding.id).order("sort_order"),
    sb.rpc("site_has_password", { p_wedding_id: wedding.id }),
    sb
      .from("events")
      .select("id, name, event_date, start_time, end_time, venue_name, address, dress_code, description")
      .eq("wedding_id", wedding.id)
      .order("event_date", { nullsFirst: false })
      .order("start_time", { nullsFirst: false })
      .order("sort_order"),
    sb
      .from("hotels")
      .select("id, name, address, distance, website, booking_url, price_per_night, discount_code, cutoff_date")
      .eq("wedding_id", wedding.id)
      .eq("show_on_website", true)
      .order("name"),
  ]);
  if (!settings || !rows) return null;

  const sections = rows.map((r) => ({ ...toSection(r), sortOrder: r.sort_order }) as EditorSection);
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
    site: {
      wedding: {
        slug: wedding.slug,
        partner_a_name: wedding.partner_a_name,
        partner_b_name: wedding.partner_b_name,
        wedding_date: wedding.wedding_date,
        location: wedding.location,
        destination_airport: wedding.destination_airport,
        rsvp_deadline: wedding.rsvp_deadline,
      },
      events: (events ?? []) as SiteEvent[],
      hotels: (hotels ?? []) as SiteHotel[],
      currency: wedding.currency,
      images: Object.fromEntries(signed),
    },
  };
}

type PublicSiteJson =
  | { locked: true; couple: string; settings: SiteData["look"] }
  | {
      locked: false;
      published: boolean;
      has_password: boolean;
      wedding: SiteData["wedding"];
      settings: SiteData["look"];
      sections: { kind: SiteSectionKind; content: unknown }[];
      events: SiteEvent[];
      hotels: SiteHotel[];
      currency: string;
    };

export type PublicSite =
  | { locked: true; couple: string; look: SiteData["look"] }
  | { locked: false; published: boolean; hasPassword: boolean; data: SiteData };

/** The public website (null = no such site, or not published). */
export async function loadPublicSite(sb: Supabase, slug: string, token: string | null): Promise<PublicSite | null> {
  const { data, error } = await sb.rpc("get_public_site", { p_slug: slug, p_token: token });
  if (error) console.error("[loadPublicSite]", error);
  const json = data as PublicSiteJson | null;
  if (!json) return null;
  if (json.locked) return { locked: true, couple: json.couple, look: { ...json.settings, hero_path: null } };

  const sections = json.sections.map((s, i) => toSection({ id: `${s.kind}-${i}`, kind: s.kind, visible: true, content: s.content }));
  const signed = await signPaths(sb, sitePaths(json.settings.hero_path, sections));
  return {
    locked: false,
    published: json.published,
    hasPassword: json.has_password,
    data: {
      wedding: json.wedding,
      look: json.settings,
      sections,
      events: json.events,
      hotels: json.hotels,
      currency: json.currency,
      images: Object.fromEntries(signed),
    },
  };
}
