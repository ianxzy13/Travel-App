import { describe, expect, it } from "vitest";
import {
  isSectionEmpty,
  parseContent,
  safeUrl,
  sectionSchemas,
  sitePaths,
  type Section,
} from "../content";
import { onAccent, siteVars } from "../templates";

const site = {
  events: [],
  hotels: [],
  wedding: {
    slug: "a-and-b",
    partner_a_name: "A",
    partner_b_name: "B",
    wedding_date: null,
    location: null,
    destination_airport: null,
    rsvp_deadline: null,
    languages: ["en"],
    time_zone: null,
  },
};
const section = <K extends Section["kind"]>(kind: K, content: unknown) =>
  ({ id: kind, kind, visible: true, content: parseContent(kind, content) }) as Section;

describe("safeUrl", () => {
  it("adds https:// to bare domains", () => {
    expect(safeUrl("example.com/list")).toBe("https://example.com/list");
  });
  it("keeps http(s) links", () => {
    expect(safeUrl("http://x.org")).toBe("http://x.org/");
  });
  it("blocks other schemes and junk", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("   ")).toBeNull();
    expect(safeUrl("not a url")).toBeNull();
  });
});

describe("parseContent", () => {
  it("fills in defaults for missing or broken content", () => {
    expect(parseContent("faq", null)).toEqual({ items: [] });
    expect(parseContent("story", { intro: 5, milestones: "x" })).toEqual({
      intro: "",
      milestones: [],
    });
  });
  it("never stores over-long text (the editor also caps every field)", () => {
    const r = sectionSchemas.home.safeParse({ tagline: "x".repeat(121) });
    expect(r.success && r.data.tagline).toBe("");
  });
});

describe("isSectionEmpty", () => {
  it("hides FAQ questions without answers", () => {
    expect(
      isSectionEmpty(section("faq", { items: [{ id: "1", question: "Kids?", answer: "" }] }), site),
    ).toBe(true);
    expect(
      isSectionEmpty(
        section("faq", { items: [{ id: "1", question: "Kids?", answer: "Yes" }] }),
        site,
      ),
    ).toBe(false);
  });
  it("hides a registry with only invalid links", () => {
    expect(
      isSectionEmpty(
        section("registry", {
          intro: "",
          links: [{ id: "1", label: "x", url: "javascript:x", note: "" }],
        }),
        site,
      ),
    ).toBe(true);
  });
  it("shows travel when an airport is known", () => {
    expect(isSectionEmpty(section("travel", {}), site)).toBe(true);
    expect(
      isSectionEmpty(section("travel", {}), {
        ...site,
        wedding: { ...site.wedding, destination_airport: "LIS" },
      }),
    ).toBe(false);
  });
  it("always shows home and RSVP", () => {
    expect(isSectionEmpty(section("home", {}), site)).toBe(false);
    expect(isSectionEmpty(section("rsvp", {}), site)).toBe(false);
  });
});

describe("sitePaths", () => {
  it("collects hero, story, party and gallery pictures once", () => {
    const paths = sitePaths("w/website/hero.jpg", [
      { kind: "story", content: { milestones: [{ id: "1", photo: "w/website/a.jpg" }] } },
      { kind: "party", content: { people: [{ id: "1", name: "S", photo: "w/website/a.jpg" }] } },
      { kind: "gallery", content: { photos: [{ id: "1", path: "w/website/g.jpg" }] } },
    ]);
    expect(paths.sort()).toEqual(["w/website/a.jpg", "w/website/g.jpg", "w/website/hero.jpg"]);
  });
});

describe("templates", () => {
  it("uses the template colour unless the couple picked one", () => {
    const base = {
      template: "boho" as const,
      accent_color: null,
      heading_font: null,
      body_font: null,
    };
    expect((siteVars(base) as Record<string, string>)["--site-accent"]).toBe("#9a4424");
    expect(
      (siteVars({ ...base, accent_color: "#123456" }) as Record<string, string>)["--site-accent"],
    ).toBe("#123456");
  });
  it("picks readable button text", () => {
    expect(onAccent("#0b0b0b")).toBe("#ffffff");
    expect(onAccent("#f5e6a8")).toBe("#111111");
  });
});
