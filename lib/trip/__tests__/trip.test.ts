import { describe, expect, it } from "vitest";
import { generateIcs, googleCalendarUrl } from "../calendar";
import { buildChecklist, isEuEea } from "../checklist-data";
import { guessCountryFromLocation } from "../country-info";

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

const keys = (input: Parameters<typeof buildChecklist>[0]) =>
  buildChecklist(input).map((i) => i.key);

describe("buildChecklist", () => {
  const base = { locale: "en", timeZone: null, weddingDate: "2027-03-07" };

  it("Slovenia, EU guest: ID card, no border paperwork, no currency/plug notes", () => {
    const k = keys({ ...base, destination: "SI", guestCountry: "DE" });
    expect(k).toContain("passportEu");
    expect(k).not.toContain("ees");
    expect(k).not.toContain("etias");
    expect(k).not.toContain("currency"); // both use the euro
    expect(k).not.toContain("plug");
    expect(k).toContain("insuranceEhic");
  });

  it("Slovenia, US guest: passport, EES, ETIAS, euro, plug + voltage", () => {
    const k = keys({ ...base, destination: "SI", guestCountry: "US" });
    expect(k).toEqual(
      expect.arrayContaining([
        "passportSchengen",
        "ees",
        "etias",
        "currency",
        "plugVoltage",
        "insurance",
      ]),
    );
    expect(k).not.toContain("passportEu");
  });

  it("Dominican Republic: e-Ticket, no EU rules, pesos and US plugs", () => {
    const items = buildChecklist({ ...base, destination: "DO", guestCountry: "SI" });
    const k = items.map((i) => i.key);
    expect(k).toContain("doEticket");
    expect(k).not.toContain("ees");
    expect(k).not.toContain("etias");
    expect(k).toContain("plugVoltage");
    const currency = items.find((i) => i.key === "currency");
    expect(currency?.values?.currency).toMatch(/Dominican Peso/i);
    const entry = items.find((i) => i.key === "entryCheck");
    expect(entry?.values?.country).toBe("Dominican Republic");
  });

  it("United States: ESTA for visa-waiver guests, visa for others, nothing for Canadians", () => {
    expect(keys({ ...base, destination: "US", guestCountry: "SI" })).toContain("esta");
    expect(keys({ ...base, destination: "US", guestCountry: "IN" })).toContain("usVisa");
    const ca = keys({ ...base, destination: "US", guestCountry: "CA" });
    expect(ca).not.toContain("esta");
    expect(ca).not.toContain("usVisa");
    expect(ca).not.toContain("plug"); // same plugs and voltage
  });

  it("home guests get no travel paperwork", () => {
    expect(keys({ ...base, destination: "DO", guestCountry: "DO" })).toEqual([]);
  });

  it("unknown destination: only generic items", () => {
    const k = keys({ ...base, destination: null, guestCountry: "US" });
    expect(k).toEqual(["passportGeneric", "insurance"]);
  });

  it("shows the wedding-day time zone", () => {
    const items = buildChecklist({
      ...base,
      timeZone: "America/Santo_Domingo",
      destination: "DO",
      guestCountry: "SI",
    });
    const tz = items.find((i) => i.key === "timezone");
    expect(tz?.values?.offset).toBe("GMT-4");
  });
});

describe("guessCountryFromLocation", () => {
  it("finds the country in free text", () => {
    expect(guessCountryFromLocation("Punta Cana, Dominican Republic")).toBe("DO");
    expect(guessCountryFromLocation("Lake Bled, Slovenia")).toBe("SI");
    expect(guessCountryFromLocation("Miami, FL, USA")).toBe("US");
    expect(guessCountryFromLocation("Punta Cana")).toBe("DO");
    expect(guessCountryFromLocation("Somewhere nice")).toBeNull();
    expect(guessCountryFromLocation(null)).toBeNull();
  });
});
