export type PaperworkTemplatePerson = "partner_a" | "partner_b" | "shared";

export type PaperworkTemplateItem = {
  key: string;
  title: string;
  person: PaperworkTemplatePerson;
  monthsBefore: number;
  maxAgeMonths?: number;
};

export type PaperworkTemplate = {
  country: string;
  officialLink: string;
  items: PaperworkTemplateItem[];
};

export const SLOVENIA_TEMPLATE: PaperworkTemplate = {
  country: "SI",
  officialLink:
    "https://e-uprava.gov.si/podrocja/druzina-otroci-zakonska-zveza/sklenitev-zakonske-zveze.html",
  items: [
    {
      key: "birth_extract",
      title: "Extract from the register of births",
      person: "partner_a",
      monthsBefore: 3,
      maxAgeMonths: 6,
    },
    {
      key: "birth_extract",
      title: "Extract from the register of births",
      person: "partner_b",
      monthsBefore: 3,
      maxAgeMonths: 6,
    },
    {
      key: "no_impediment",
      title: "Certificate of no impediment to marriage",
      person: "partner_a",
      monthsBefore: 3,
      maxAgeMonths: 6,
    },
    {
      key: "no_impediment",
      title: "Certificate of no impediment to marriage",
      person: "partner_b",
      monthsBefore: 3,
      maxAgeMonths: 6,
    },
    {
      key: "passport",
      title: "Valid passport",
      person: "partner_a",
      monthsBefore: 4,
    },
    {
      key: "passport",
      title: "Valid passport",
      person: "partner_b",
      monthsBefore: 4,
    },
    {
      key: "apostille",
      title: "Apostille on foreign public documents",
      person: "partner_a",
      monthsBefore: 2,
    },
    {
      key: "apostille",
      title: "Apostille on foreign public documents",
      person: "partner_b",
      monthsBefore: 2,
    },
    {
      key: "translation",
      title: "Certified translation into Slovenian",
      person: "partner_a",
      monthsBefore: 2,
    },
    {
      key: "translation",
      title: "Certified translation into Slovenian",
      person: "partner_b",
      monthsBefore: 2,
    },
    {
      key: "interpreter",
      title: "Interpreter at the ceremony",
      person: "shared",
      monthsBefore: 2,
    },
    {
      key: "apply_admin_unit",
      title: "Apply at the administrative unit (upravna enota)",
      person: "shared",
      monthsBefore: 2,
    },
  ],
};

export const TEMPLATES: Record<string, PaperworkTemplate> = {
  SI: SLOVENIA_TEMPLATE,
};

export function dueDateFromWedding(
  weddingDate: string,
  monthsBefore: number,
): string {
  const d = new Date(`${weddingDate}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - monthsBefore);
  return d.toISOString().slice(0, 10);
}

export function isDocumentExpired(
  issueDate: string,
  maxAgeMonths: number,
  referenceDate: string,
): boolean {
  const issue = new Date(`${issueDate}T00:00:00Z`);
  issue.setUTCMonth(issue.getUTCMonth() + maxAgeMonths);
  return issue.toISOString().slice(0, 10) < referenceDate;
}
