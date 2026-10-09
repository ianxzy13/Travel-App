export type StdTemplate = "elegant" | "modern" | "playful";

export type TemplateStyle = {
  name: string;
  bg: string;
  fg: string;
  accent: string;
  muted: string;
  card: string;
  border: string;
};

export const STD_TEMPLATES: Record<StdTemplate, TemplateStyle> = {
  elegant: {
    name: "Elegant",
    bg: "#FFFAF5",
    fg: "#3D2B2F",
    accent: "#C4A265",
    muted: "#8B7D72",
    card: "#FFF5EB",
    border: "#E8D5C0",
  },
  modern: {
    name: "Modern",
    bg: "#FFFFFF",
    fg: "#1A1A1A",
    accent: "#2D2D2D",
    muted: "#6B6B6B",
    card: "#F8F8F8",
    border: "#E0E0E0",
  },
  playful: {
    name: "Playful",
    bg: "#FFF8F0",
    fg: "#2D3436",
    accent: "#C67A56",
    muted: "#6B8F71",
    card: "#FEF3E8",
    border: "#E8CDB5",
  },
};
