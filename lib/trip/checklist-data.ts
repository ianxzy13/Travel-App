import { COUNTRY_INFO, EU_EEA_CH, SCHENGEN_ENTRY, US_VISA_WAIVER } from "./country-info";

/** One line of the guest's travel checklist. Texts live under rsvp.trip.checklist.* */
export type ChecklistItem = {
  /** Stable id, saved when the guest ticks it off. */
  key: string;
  titleKey: string;
  descriptionKey: string;
  /** Values for the message placeholders ({country}, {currency}…). */
  values?: Record<string, string>;
  link?: string;
};

export function isEuEea(countryCode: string | null | undefined): boolean {
  return !!countryCode && EU_EEA_CH.has(countryCode.toUpperCase());
}

type Input = {
  /** Where the wedding is (ISO 3166 code), null if unknown. */
  destination: string | null | undefined;
  /** Where the guest's household lives, null if unknown. */
  guestCountry: string | null | undefined;
  /** The wedding's IANA time zone, e.g. "America/Santo_Domingo". */
  timeZone?: string | null;
  /** Wedding date (YYYY-MM-DD), to show the right summer/winter offset. */
  weddingDate?: string | null;
  /** The guest's language, for country and currency names. */
  locale: string;
};

function item(key: string, values?: Record<string, string>, link?: string): ChecklistItem {
  return {
    key,
    titleKey: `checklist.${key}`,
    descriptionKey: `checklist.${key}Desc`,
    ...(values ? { values } : {}),
    ...(link ? { link } : {}),
  };
}

function displayName(locale: string, type: "region" | "currency", code: string): string {
  try {
    return new Intl.DisplayNames([locale], { type }).of(code) ?? code;
  } catch {
    return new Intl.DisplayNames(["en"], { type }).of(code) ?? code;
  }
}

function currencySymbol(locale: string, currency: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(1);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** "Atlantic Standard Time" + "GMT-4" for the wedding day, in the guest's language. */
function timeZoneLabel(locale: string, timeZone: string, date: Date) {
  const pick = (style: "long" | "shortOffset") => {
    try {
      return (
        new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style })
          .formatToParts(date)
          .find((p) => p.type === "timeZoneName")?.value ?? null
      );
    } catch {
      return null;
    }
  };
  return { name: pick("long"), offset: pick("shortOffset") };
}

/** Entry documents for someone from `guest` travelling to `dest`. */
function entryItems(dest: string, guest: string | null): ChecklistItem[] {
  const country = dest;
  const euTrip = !!guest && EU_EEA_CH.has(guest) && EU_EEA_CH.has(dest);
  if (euTrip) return [item("passportEu")];

  const items: ChecklistItem[] = [];
  items.push(item(SCHENGEN_ENTRY.has(dest) ? "passportSchengen" : "passport", { country }));

  if (SCHENGEN_ENTRY.has(dest)) {
    items.push(item("ees", undefined, "https://travel-europe.europa.eu/ees_en"));
    items.push(item("etias", undefined, "https://travel-europe.europa.eu/etias_en"));
    return items;
  }

  switch (dest) {
    case "US":
      if (guest === "CA" || guest === "BM") return items;
      if (!guest || US_VISA_WAIVER.has(guest)) {
        items.push(item("esta", undefined, "https://esta.cbp.dhs.gov/"));
      } else {
        items.push(
          item(
            "usVisa",
            undefined,
            "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visitor.html",
          ),
        );
      }
      return items;
    case "GB":
      if (guest === "IE") return items;
      items.push(item("ukEta", undefined, "https://www.gov.uk/eta"));
      return items;
    case "CA":
      if (guest === "US") return items;
      items.push(
        item(
          "caEta",
          undefined,
          "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html",
        ),
      );
      return items;
    case "AU":
      if (guest === "NZ") return items;
      items.push(
        item(
          "auEta",
          undefined,
          "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-finder/visit",
        ),
      );
      return items;
    case "DO":
      items.push(item("doEticket", undefined, "https://eticket.migracion.gob.do/"));
      items.push(item("entryCheck", { country }));
      return items;
    default:
      items.push(item("entryCheck", { country }));
      return items;
  }
}

/**
 * The guest's travel checklist for this wedding: entry documents for their
 * country → the destination, then money, plugs, time, emergency and insurance.
 */
export function buildChecklist({
  destination,
  guestCountry,
  timeZone,
  weddingDate,
  locale,
}: Input): ChecklistItem[] {
  const dest = destination?.toUpperCase() ?? null;
  const guest = guestCountry?.toUpperCase() ?? null;
  const items: ChecklistItem[] = [];
  const home = !!dest && dest === guest;

  if (dest && !home) {
    const named = entryItems(dest, guest).map((i) =>
      i.values?.country
        ? { ...i, values: { ...i.values, country: displayName(locale, "region", dest) } }
        : i,
    );
    items.push(...named);
  } else if (!dest) {
    items.push(item("passportGeneric"));
  }

  const info = dest ? COUNTRY_INFO[dest] : undefined;
  const homeInfo = guest ? COUNTRY_INFO[guest] : undefined;

  if (info && !home && homeInfo?.currency !== info.currency) {
    items.push(
      item("currency", {
        currency: displayName(locale, "currency", info.currency),
        symbol: currencySymbol(locale, info.currency),
      }),
    );
  }

  const samePlugs =
    !!homeInfo &&
    !!info &&
    homeInfo.volts === info.volts &&
    info.plugs.every((p) => homeInfo.plugs.includes(p));
  if (info && !home && !samePlugs) {
    items.push(
      item(homeInfo && Math.abs(homeInfo.volts - info.volts) > 40 ? "plugVoltage" : "plug", {
        types: info.plugs.join(", "),
        volts: String(info.volts),
        homeVolts: String(homeInfo?.volts ?? ""),
      }),
    );
  }

  if (timeZone && !home) {
    const day = weddingDate ? new Date(`${weddingDate}T12:00:00Z`) : new Date();
    const { name, offset } = timeZoneLabel(locale, timeZone, day);
    if (name && offset) items.push(item("timezone", { zone: name, offset }));
  }

  if (info?.emergency && !home) {
    items.push(item("emergency", { number: info.emergency }));
  }

  if (!home) {
    const ehic = !!guest && !!dest && EU_EEA_CH.has(guest) && EU_EEA_CH.has(dest);
    items.push(
      ehic
        ? item(
            "insuranceEhic",
            undefined,
            "https://europa.eu/youreurope/citizens/health/unplanned-healthcare/temporary-stays/index_en.htm",
          )
        : item("insurance"),
    );
  }

  return items;
}
