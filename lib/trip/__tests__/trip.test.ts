import { describe, expect, it } from "vitest";
import { generateIcs, googleCalendarUrl } from "../calendar";
import { filterChecklist, isEuEea, SLOVENIA_CHECKLIST } from "../checklist-data";

describe("generateIcs", () => {
  it("produces valid .ics for a timed event", () => {
    const ics = generateIcs({
      title: "Wedding Ceremony",
      date: "2027-06-20",
      startTime: "14:00",
      endTime: "15:30",
      timeZone: "Europe/Ljubljana",
      location: "Castle, Slovenia",
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("DTSTART;TZID=Europe/Ljubljana:20270620T140000");
    expect(ics).toContain("DTEND;TZID=Europe/Ljubljana:20270620T153000");
    expect(ics).toContain("SUMMARY:Wedding Ceremony");
    expect(ics).toContain("LOCATION:Castle\\, Slovenia");
  });

  it("produces all-day event when no start time given", () => {
    const ics = generateIcs({
      title: "Welcome Dinner",
      date: "2027-06-19",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20270619");
    expect(ics).toContain("DTEND;VALUE=DATE:20270620");
  });

  it("folds long lines at 75 characters", () => {
    const ics = generateIcs({
      title: "A".repeat(100),
      date: "2027-06-20",
      startTime: "10:00",
    });
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("escapes special characters", () => {
    const ics = generateIcs({
      title: "Tom & Jerry; friends, forever",
      date: "2027-06-20",
    });
    expect(ics).toContain("Tom & Jerry\\; friends\\, forever");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a valid Google Calendar URL with timezone", () => {
    const url = googleCalendarUrl({
      title: "Reception",
      date: "2027-06-20",
      startTime: "18:00",
      endTime: "23:00",
      timeZone: "Europe/Ljubljana",
      location: "Grand Hotel",
    });
    expect(url).toContain("google.com/calendar/render");
    expect(url).toContain("text=Reception");
    expect(url).toContain("dates=20270620T180000%2F20270620T230000");
    expect(url).toContain("ctz=Europe%2FLjubljana");
    expect(url).toContain("location=Grand+Hotel");
  });

  it("creates all-day event URL when no times", () => {
    const url = googleCalendarUrl({
      title: "Free Day",
      date: "2027-06-21",
    });
    expect(url).toContain("dates=20270621%2F20270622");
  });
});

describe("isEuEea", () => {
  it("returns true for EU countries", () => {
    expect(isEuEea("DE")).toBe(true);
    expect(isEuEea("SI")).toBe(true);
    expect(isEuEea("FR")).toBe(true);
  });

  it("returns true for EEA countries", () => {
    expect(isEuEea("NO")).toBe(true);
    expect(isEuEea("IS")).toBe(true);
    expect(isEuEea("CH")).toBe(true);
  });

  it("returns false for non-EU/EEA countries", () => {
    expect(isEuEea("US")).toBe(false);
    expect(isEuEea("BR")).toBe(false);
    expect(isEuEea("JP")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isEuEea(null)).toBe(false);
    expect(isEuEea(undefined)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isEuEea("de")).toBe(true);
    expect(isEuEea("si")).toBe(true);
  });
});

describe("filterChecklist", () => {
  it("returns only EU items for EU guest", () => {
    const items = filterChecklist(SLOVENIA_CHECKLIST, "DE");
    const keys = items.map((i) => i.key);
    expect(keys).toContain("passport-eu");
    expect(keys).not.toContain("passport");
    expect(keys).not.toContain("ees");
    expect(keys).not.toContain("etias");
    expect(keys).toContain("currency");
  });

  it("returns non-EU items for non-EU guest", () => {
    const items = filterChecklist(SLOVENIA_CHECKLIST, "US");
    const keys = items.map((i) => i.key);
    expect(keys).toContain("passport");
    expect(keys).not.toContain("passport-eu");
    expect(keys).toContain("ees");
    expect(keys).toContain("etias");
    expect(keys).toContain("currency");
  });

  it("returns all universal items regardless of country", () => {
    const euItems = filterChecklist(SLOVENIA_CHECKLIST, "DE");
    const nonEuItems = filterChecklist(SLOVENIA_CHECKLIST, "US");
    const universalKeys = ["currency", "plug", "timezone", "emergency", "insurance"];
    for (const key of universalKeys) {
      expect(euItems.map((i) => i.key)).toContain(key);
      expect(nonEuItems.map((i) => i.key)).toContain(key);
    }
  });

  it("treats null country as non-EU", () => {
    const items = filterChecklist(SLOVENIA_CHECKLIST, null);
    const keys = items.map((i) => i.key);
    expect(keys).toContain("passport");
    expect(keys).not.toContain("passport-eu");
  });
});
