import { describe, expect, it } from "vitest";
import {
  dueDateFromWedding,
  isDocumentExpired,
  SLOVENIA_TEMPLATE,
  TEMPLATES,
  COUNTRY_LIST,
  REGIONS,
} from "../templates";

describe("dueDateFromWedding", () => {
  it("subtracts months from wedding date", () => {
    expect(dueDateFromWedding("2027-06-15", 3)).toBe("2027-03-15");
  });

  it("handles year boundary", () => {
    expect(dueDateFromWedding("2027-02-10", 3)).toBe("2026-11-10");
  });

  it("handles 0 months", () => {
    expect(dueDateFromWedding("2027-06-15", 0)).toBe("2027-06-15");
  });
});

describe("isDocumentExpired", () => {
  it("returns false when document is fresh", () => {
    expect(isDocumentExpired("2027-01-01", 6, "2027-05-01")).toBe(false);
  });

  it("returns true when document is expired", () => {
    expect(isDocumentExpired("2027-01-01", 6, "2027-08-01")).toBe(true);
  });

  it("returns false on the last valid day", () => {
    expect(isDocumentExpired("2027-01-01", 6, "2027-07-01")).toBe(false);
  });

  it("returns true the day after expiry", () => {
    expect(isDocumentExpired("2027-01-01", 6, "2027-07-02")).toBe(true);
  });
});

describe("SLOVENIA_TEMPLATE", () => {
  it("exists in TEMPLATES under SI", () => {
    expect(TEMPLATES["SI"]).toBeDefined();
    expect(TEMPLATES["SI"]).toBe(SLOVENIA_TEMPLATE);
  });

  it("has items for both partners", () => {
    const personA = SLOVENIA_TEMPLATE.items.filter(
      (i) => i.person === "partner_a",
    );
    const personB = SLOVENIA_TEMPLATE.items.filter(
      (i) => i.person === "partner_b",
    );
    expect(personA.length).toBeGreaterThan(0);
    expect(personB.length).toBeGreaterThan(0);
    expect(personA.length).toBe(personB.length);
  });

  it("has shared items", () => {
    const shared = SLOVENIA_TEMPLATE.items.filter(
      (i) => i.person === "shared",
    );
    expect(shared.length).toBeGreaterThan(0);
  });

  it("includes key documents", () => {
    const keys = SLOVENIA_TEMPLATE.items.map((i) => i.key);
    expect(keys).toContain("birth_certificate");
    expect(keys).toContain("no_impediment");
    expect(keys).toContain("passport");
    expect(keys).toContain("apostille");
    expect(keys).toContain("translation");
    expect(keys).toContain("interpreter");
    expect(keys).toContain("apply_registry");
  });

  it("all items have positive monthsBefore", () => {
    for (const item of SLOVENIA_TEMPLATE.items) {
      expect(item.monthsBefore).toBeGreaterThan(0);
    }
  });

  it("items with maxAgeMonths have positive values", () => {
    for (const item of SLOVENIA_TEMPLATE.items) {
      if (item.maxAgeMonths !== undefined) {
        expect(item.maxAgeMonths).toBeGreaterThan(0);
      }
    }
  });
});

describe("TEMPLATES index", () => {
  it("has 64 country templates", () => {
    expect(Object.keys(TEMPLATES).length).toBe(64);
  });

  it("every template has items", () => {
    for (const [code, tpl] of Object.entries(TEMPLATES)) {
      expect(tpl.items.length, `${code} has no items`).toBeGreaterThan(0);
    }
  });

  it("every template has metadata", () => {
    for (const [code, tpl] of Object.entries(TEMPLATES)) {
      expect(tpl.countryName, `${code} missing countryName`).toBeTruthy();
      expect(tpl.region, `${code} missing region`).toBeTruthy();
      expect(tpl.officialLink, `${code} missing officialLink`).toBeTruthy();
      expect(tpl.languageRequired, `${code} missing languageRequired`).toBeTruthy();
      expect(tpl.notes, `${code} missing notes`).toBeTruthy();
    }
  });

  it("Dominican Republic template has local lawyer item", () => {
    const dr = TEMPLATES["DO"];
    expect(dr).toBeDefined();
    const keys = dr.items.map((i) => i.key);
    expect(keys).toContain("local_lawyer");
    expect(keys).toContain("procuraduria");
  });

  it("Georgia template is minimal (passport only)", () => {
    const ge = TEMPLATES["GE"];
    expect(ge).toBeDefined();
    const perPartner = ge.items.filter((i) => i.person === "partner_a");
    expect(perPartner.length).toBe(1);
    expect(perPartner[0].key).toBe("passport");
  });
});

describe("COUNTRY_LIST", () => {
  it("matches TEMPLATES count", () => {
    expect(COUNTRY_LIST.length).toBe(Object.keys(TEMPLATES).length);
  });

  it("every country has a valid region", () => {
    const regionKeys = REGIONS.map((r) => r.key);
    for (const c of COUNTRY_LIST) {
      expect(regionKeys, `${c.code} has invalid region ${c.region}`).toContain(c.region);
    }
  });
});
