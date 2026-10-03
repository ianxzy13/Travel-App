export type ChecklistItem = {
  key: string;
  titleKey: string;
  descriptionKey: string;
  link?: string;
  appliesTo: "all" | "eu" | "non-eu" | "visa-free-non-eu";
};

export type DestinationChecklist = {
  destination: string;
  items: ChecklistItem[];
};

const EU_EEA_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO", "CH",
]);

export function isEuEea(countryCode: string | null | undefined): boolean {
  return !!countryCode && EU_EEA_COUNTRIES.has(countryCode.toUpperCase());
}

export function filterChecklist(
  checklist: DestinationChecklist,
  guestCountry: string | null | undefined,
): ChecklistItem[] {
  const eu = isEuEea(guestCountry);
  return checklist.items.filter((item) => {
    switch (item.appliesTo) {
      case "all":
        return true;
      case "eu":
        return eu;
      case "non-eu":
        return !eu;
      case "visa-free-non-eu":
        return !eu;
      default:
        return true;
    }
  });
}

export const SLOVENIA_CHECKLIST: DestinationChecklist = {
  destination: "SI",
  items: [
    {
      key: "passport",
      titleKey: "checklist.passport",
      descriptionKey: "checklist.passportDesc",
      appliesTo: "non-eu",
    },
    {
      key: "passport-eu",
      titleKey: "checklist.passportEu",
      descriptionKey: "checklist.passportEuDesc",
      appliesTo: "eu",
    },
    {
      key: "ees",
      titleKey: "checklist.ees",
      descriptionKey: "checklist.eesDesc",
      link: "https://travel-europe.europa.eu/ees_en",
      appliesTo: "non-eu",
    },
    {
      key: "etias",
      titleKey: "checklist.etias",
      descriptionKey: "checklist.etiasDesc",
      link: "https://travel-europe.europa.eu/etias_en",
      appliesTo: "visa-free-non-eu",
    },
    {
      key: "currency",
      titleKey: "checklist.currency",
      descriptionKey: "checklist.currencyDesc",
      appliesTo: "all",
    },
    {
      key: "plug",
      titleKey: "checklist.plug",
      descriptionKey: "checklist.plugDesc",
      appliesTo: "all",
    },
    {
      key: "timezone",
      titleKey: "checklist.timezone",
      descriptionKey: "checklist.timezoneDesc",
      appliesTo: "all",
    },
    {
      key: "emergency",
      titleKey: "checklist.emergency",
      descriptionKey: "checklist.emergencyDesc",
      appliesTo: "all",
    },
    {
      key: "insurance",
      titleKey: "checklist.insurance",
      descriptionKey: "checklist.insuranceDesc",
      link: "https://europa.eu/youreurope/citizens/health/unplanned-healthcare/temporary-stays/index_en.htm",
      appliesTo: "all",
    },
  ],
};
