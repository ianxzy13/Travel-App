import { z } from "zod";
import type { BodyFont, HeadingFont, SiteSectionKind, SiteTemplate } from "@/lib/database.types";

// What each website section stores in `website_sections.content`.
// Parsing is forgiving (missing fields get defaults) so old rows never break
// the site; saving uses the same schemas, so limits are enforced.
// (Part 2 will add translations: one of these objects per language.)

const text = (max: number) => z.string().max(max, `Please keep this under ${max} characters`).catch("");
const id = z.string().min(1).max(64);
const photo = z.string().max(500).nullable().catch(null);

export const sectionSchemas = {
  home: z.object({ tagline: text(120) }),
  story: z.object({
    intro: text(3000),
    milestones: z
      .array(z.object({ id, date: text(40), title: text(120), text: text(1500), photo }))
      .max(30)
      .catch([]),
  }),
  events: z.object({ intro: text(1000) }),
  travel: z.object({ intro: text(1500), notes: text(3000) }),
  rsvp: z.object({ intro: text(1000) }),
  party: z.object({
    people: z
      .array(z.object({ id, name: text(80), role: text(80), bio: text(500), photo }))
      .max(40)
      .catch([]),
  }),
  registry: z.object({
    intro: text(1500),
    links: z
      .array(z.object({ id, label: text(100), url: text(500), note: text(300) }))
      .max(20)
      .catch([]),
  }),
  faq: z.object({
    items: z.array(z.object({ id, question: text(200), answer: text(2000) })).max(40).catch([]),
  }),
  gallery: z.object({
    photos: z.array(z.object({ id, path: z.string().max(500), caption: text(200) })).max(60).catch([]),
  }),
} satisfies Record<SiteSectionKind, z.ZodType>;

export type SectionContent = { [K in SiteSectionKind]: z.infer<(typeof sectionSchemas)[K]> };

/** A section with its content typed by kind. */
export type Section = {
  [K in SiteSectionKind]: { id: string; kind: K; visible: boolean; content: SectionContent[K] };
}[SiteSectionKind];

export function parseContent<K extends SiteSectionKind>(kind: K, raw: unknown): SectionContent[K] {
  const r = sectionSchemas[kind].safeParse(raw ?? {});
  return (r.success ? r.data : sectionSchemas[kind].parse({})) as SectionContent[K];
}

export const SECTION_LABEL: Record<SiteSectionKind, string> = {
  home: "Home",
  story: "Our story",
  events: "Schedule",
  travel: "Travel & stay",
  rsvp: "RSVP",
  party: "Wedding party",
  registry: "Registry",
  faq: "Q & A",
  gallery: "Gallery",
};

export const SECTION_HINT: Record<SiteSectionKind, string> = {
  home: "Your names, date, countdown and hero photo.",
  story: "How you met, with a timeline of milestones.",
  events: "Comes from Settings → Events: times, places, dress code.",
  travel: "Hotels marked “Show on website” plus your own tips.",
  rsvp: "Guests find their invitation by name or code.",
  party: "Bridesmaids, groomsmen, officiant… with photos.",
  registry: "Links to your gift lists or honeymoon fund.",
  faq: "Answers to the questions guests always ask.",
  gallery: "Your favourite photos.",
};

/** Only http(s) links are ever shown (blocks javascript: and friends). */
export function safeUrl(raw: string | null | undefined) {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Every storage path used by the site (hero + section photos). */
export function sitePaths(heroPath: string | null, sections: { kind: SiteSectionKind; content: unknown }[]) {
  const paths = new Set<string>();
  if (heroPath) paths.add(heroPath);
  for (const s of sections) {
    const c = parseContent(s.kind, s.content) as Record<string, unknown>;
    if (s.kind === "story") for (const m of (c as SectionContent["story"]).milestones) if (m.photo) paths.add(m.photo);
    if (s.kind === "party") for (const p of (c as SectionContent["party"]).people) if (p.photo) paths.add(p.photo);
    if (s.kind === "gallery") for (const p of (c as SectionContent["gallery"]).photos) paths.add(p.path);
  }
  return [...paths];
}

export type SiteEvent = {
  id: string;
  name: string;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  address: string | null;
  dress_code: string | null;
  description: string | null;
};

export type SiteHotel = {
  id: string;
  name: string;
  address: string | null;
  distance: string | null;
  website: string | null;
  booking_url: string | null;
  price_per_night: number | string | null;
  discount_code: string | null;
  cutoff_date: string | null;
};

/** Everything a template needs to draw the site (public page and editor preview). */
export type SiteData = {
  wedding: {
    slug: string;
    partner_a_name: string;
    partner_b_name: string;
    wedding_date: string | null;
    location: string | null;
    destination_airport: string | null;
    rsvp_deadline: string | null;
  };
  look: {
    template: SiteTemplate;
    accent_color: string | null;
    heading_font: HeadingFont | null;
    body_font: BodyFont | null;
    hero_path: string | null;
  };
  /** visible sections, in order */
  sections: Section[];
  events: SiteEvent[];
  hotels: SiteHotel[];
  currency: string;
  /** storage path → temporary image link */
  images: Record<string, string>;
};

/** Sections with nothing to show are left out of the public site. */
export function isSectionEmpty(s: Section, data: Pick<SiteData, "events" | "hotels" | "wedding">) {
  switch (s.kind) {
    case "home":
    case "rsvp":
      return false;
    case "story":
      return !s.content.intro.trim() && s.content.milestones.length === 0;
    case "events":
      return data.events.length === 0;
    case "travel":
      return data.hotels.length === 0 && !s.content.intro.trim() && !s.content.notes.trim() && !data.wedding.destination_airport;
    case "party":
      return !s.content.people.some((p) => p.name.trim());
    case "registry":
      return !s.content.links.some((l) => safeUrl(l.url));
    case "faq":
      return !s.content.items.some((i) => i.question.trim() && i.answer.trim());
    case "gallery":
      return s.content.photos.length === 0;
  }
}
