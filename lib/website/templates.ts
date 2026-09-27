import type { BodyFont, HeadingFont, SiteTemplate } from "@/lib/database.types";

// name: the font's own name; style: a key in messages "websiteEditor.design.fontStyles"
type FontInfo = { name: string; style: string; css: string };

export const HEADING_FONTS: Record<HeadingFont, FontInfo> = {
  cormorant: {
    name: "Cormorant",
    style: "elegantSerif",
    css: "var(--font-cormorant), Georgia, serif",
  },
  playfair: { name: "Playfair", style: "classicSerif", css: "var(--font-playfair), Georgia, serif" },
  fraunces: { name: "Fraunces", style: "softSerif", css: "var(--font-fraunces), Georgia, serif" },
  josefin: { name: "Josefin", style: "airySans", css: "var(--font-josefin), system-ui, sans-serif" },
  inter: { name: "Inter", style: "boldModern", css: "var(--font-inter), system-ui, sans-serif" },
  "great-vibes": { name: "Great Vibes", style: "script", css: "var(--font-great-vibes), cursive" },
};

export const BODY_FONTS: Record<BodyFont, FontInfo> = {
  inter: { name: "Inter", style: "cleanSans", css: "var(--font-inter), system-ui, sans-serif" },
  lora: { name: "Lora", style: "bookSerif", css: "var(--font-lora), Georgia, serif" },
  nunito: {
    name: "Nunito Sans",
    style: "friendlySans",
    css: "var(--font-nunito), system-ui, sans-serif",
  },
  josefin: { name: "Josefin", style: "airySans", css: "var(--font-josefin), system-ui, sans-serif" },
};

export type TemplateStyle = {
  label: string;
  description: string;
  heading: HeadingFont;
  body: BodyFont;
  colors: {
    bg: string;
    fg: string;
    muted: string;
    /** background of cards and alternate sections */
    card: string;
    line: string;
    accent: string;
  };
};

/**
 * The five looks. Colours and default fonts live here; layout differences
 * (hero shape, headings, ornaments) are in components/website/site.tsx.
 */
export const TEMPLATES: Record<SiteTemplate, TemplateStyle> = {
  classic: {
    label: "Classic",
    description: "Ivory, gold and serif type, centred and timeless.",
    heading: "cormorant",
    body: "lora",
    colors: {
      bg: "#fbf8f1",
      fg: "#2d2621",
      muted: "#6e635a",
      card: "#f4eee2",
      line: "#dcd0bb",
      accent: "#806129",
    },
  },
  modern: {
    label: "Modern Minimal",
    description: "Big bold type, black and white, lots of space.",
    heading: "inter",
    body: "inter",
    colors: {
      bg: "#ffffff",
      fg: "#0b0b0b",
      muted: "#5f5f5f",
      card: "#f3f3f3",
      line: "#0b0b0b",
      accent: "#0b0b0b",
    },
  },
  garden: {
    label: "Garden",
    description: "Sage greens, soft paper and botanical sprigs.",
    heading: "playfair",
    body: "nunito",
    colors: {
      bg: "#f3f5ee",
      fg: "#27332a",
      muted: "#5d6b5c",
      card: "#e6ecdf",
      line: "#c5d1bc",
      accent: "#46683f",
    },
  },
  boho: {
    label: "Boho",
    description: "Warm terracotta, sand and arches.",
    heading: "fraunces",
    body: "nunito",
    colors: {
      bg: "#f7eee4",
      fg: "#43291f",
      muted: "#765445",
      card: "#efdfcf",
      line: "#dcc0a8",
      accent: "#9a4424",
    },
  },
  beach: {
    label: "Beach",
    description: "Light blues, airy type and gentle waves.",
    heading: "josefin",
    body: "nunito",
    colors: {
      bg: "#f4f9fc",
      fg: "#1c3a4c",
      muted: "#4a6779",
      card: "#e3f0f7",
      line: "#c3dcea",
      accent: "#246a8c",
    },
  },
};

/** Colour suggestions shown in the editor (plus a custom picker). */
export const ACCENT_SWATCHES = [
  "#806129",
  "#9a4424",
  "#a8505f",
  "#8f4f63",
  "#46683f",
  "#56684a",
  "#246a8c",
  "#3e5a8a",
  "#6b4f8a",
  "#0b0b0b",
];

/** Readable text colour on the accent (for buttons). */
export function onAccent(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // whichever of near-black (luminance about 0.01) or white has more contrast
  const darkContrast = (lum + 0.05) / 0.06;
  const whiteContrast = 1.05 / (lum + 0.05);
  return darkContrast >= whiteContrast ? "#111111" : "#ffffff";
}

/** The CSS variables a site uses; `look` values override the template's. */
export function siteVars(look: {
  template: SiteTemplate;
  accent_color: string | null;
  heading_font: HeadingFont | null;
  body_font: BodyFont | null;
}) {
  const t = TEMPLATES[look.template] ?? TEMPLATES.classic;
  const accent = look.accent_color ?? t.colors.accent;
  return {
    "--site-bg": t.colors.bg,
    "--site-fg": t.colors.fg,
    "--site-muted": t.colors.muted,
    "--site-card": t.colors.card,
    "--site-line": t.colors.line,
    "--site-accent": accent,
    "--site-on-accent": onAccent(accent),
    "--site-heading": HEADING_FONTS[look.heading_font ?? t.heading].css,
    "--site-body": BODY_FONTS[look.body_font ?? t.body].css,
  } as React.CSSProperties;
}
