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
  countryName: string;
  region: "europe" | "americas" | "caribbean" | "asia" | "oceania" | "africa";
  officialLink: string;
  languageRequired: string;
  residencyDays: number;
  hagueConvention: boolean;
  notes: string;
  items: PaperworkTemplateItem[];
};

function tpl(
  country: string,
  countryName: string,
  region: PaperworkTemplate["region"],
  officialLink: string,
  lang: string,
  residencyDays: number,
  hague: boolean,
  notes: string,
  perPartner: Omit<PaperworkTemplateItem, "person">[],
  shared: Omit<PaperworkTemplateItem, "person">[],
): PaperworkTemplate {
  return {
    country,
    countryName,
    region,
    officialLink,
    languageRequired: lang,
    residencyDays,
    hagueConvention: hague,
    notes,
    items: [
      ...perPartner.flatMap((item) => [
        { ...item, person: "partner_a" as const },
        { ...item, person: "partner_b" as const },
      ]),
      ...shared.map((item) => ({ ...item, person: "shared" as const })),
    ],
  };
}

// ── Europe ──────────────────────────────────────────────────────────────

export const SLOVENIA_TEMPLATE = tpl(
  "SI", "Slovenia", "europe",
  "https://e-uprava.gov.si/podrocja/druzina-otroci-zakonska-zveza/sklenitev-zakonske-zveze.html",
  "Slovenian", 0, true,
  "Apply at the upravna enota (administrative unit). Interpreter required if a partner does not speak Slovenian.",
  [
    { key: "birth_certificate", title: "Extract from the register of births", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Slovenian", monthsBefore: 2 },
  ],
  [
    { key: "interpreter", title: "Interpreter at the ceremony", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the administrative unit (upravna enota)", monthsBefore: 2 },
  ],
);

const ITALY_TEMPLATE = tpl(
  "IT", "Italy", "europe",
  "https://www.esteri.it/en/servizi-consolari-e-visti/italiani-all-estero/stato-civile/",
  "Italian", 2, true,
  "Get a Nulla Osta from your embassy in Italy. Publication of banns at the Comune for 2 consecutive Sundays. Ceremony at the Comune or approved venue.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "nulla_osta", title: "Nulla Osta (declaration of no objection) from your embassy in Italy", monthsBefore: 3, maxAgeMonths: 3 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Italian", monthsBefore: 3 },
  ],
  [
    { key: "banns", title: "Publication of banns at the Comune (2 weekends)", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Comune (city hall)", monthsBefore: 4 },
  ],
);

const FRANCE_TEMPLATE = tpl(
  "FR", "France", "europe",
  "https://www.service-public.fr/particuliers/vosdroits/N142",
  "French", 0, true,
  "One partner must reside in the commune for at least 40 days. Publication of banns 10 days before ceremony. Civil ceremony at the Mairie is mandatory; religious ceremony is optional and separate.",
  [
    { key: "birth_certificate", title: "Birth certificate (acte de naissance)", monthsBefore: 4, maxAgeMonths: 3 },
    { key: "no_impediment", title: "Certificate of celibacy (certificat de célibat)", monthsBefore: 4, maxAgeMonths: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation by sworn translator (traducteur assermenté)", monthsBefore: 3 },
    { key: "residence_proof", title: "Proof of 40-day residency in the commune", monthsBefore: 2 },
  ],
  [
    { key: "banns", title: "Publication of banns at the Mairie (10 days)", monthsBefore: 1 },
    { key: "mayor_interview", title: "Pre-marital interview with the mayor", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Mairie (city hall)", monthsBefore: 3 },
  ],
);

const SPAIN_TEMPLATE = tpl(
  "ES", "Spain", "europe",
  "https://www.mjusticia.gob.es/es/ciudadania/tramites/matrimonio-civil",
  "Spanish", 0, true,
  "Open an expediente matrimonial at the Registro Civil. Judge interview required. One partner may need empadronamiento (registration on the local padron).",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 4, maxAgeMonths: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 3 },
    { key: "empadronamiento", title: "Empadronamiento (padron registration) or proof of connection to Spain", monthsBefore: 4 },
  ],
  [
    { key: "expediente", title: "Open expediente matrimonial at Registro Civil", monthsBefore: 4 },
    { key: "judge_interview", title: "Interview with the judge", monthsBefore: 2 },
    { key: "apply_registry", title: "Ceremony at Registro Civil or approved venue", monthsBefore: 3 },
  ],
);

const PORTUGAL_TEMPLATE = tpl(
  "PT", "Portugal", "europe",
  "https://justica.gov.pt/Registos/Civil/Casamento",
  "Portuguese", 0, true,
  "Apply at the Conservatória do Registo Civil. A preliminary process (processo preliminar) is required.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Portuguese", monthsBefore: 3 },
  ],
  [
    { key: "preliminary", title: "Preliminary process (processo preliminar) at Conservatória", monthsBefore: 3 },
    { key: "apply_registry", title: "Apply at Conservatória do Registo Civil", monthsBefore: 3 },
  ],
);

const GREECE_TEMPLATE = tpl(
  "GR", "Greece", "europe",
  "https://www.mfa.gr/en/",
  "Greek", 0, true,
  "Apply at the local town hall (Dimarcheio). Some municipalities require publication in a local newspaper. Two witnesses with valid passports needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Greek", monthsBefore: 2 },
  ],
  [
    { key: "witnesses", title: "Arrange 2 witnesses with valid passports", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the town hall (Dimarcheio)", monthsBefore: 3 },
  ],
);

const CROATIA_TEMPLATE = tpl(
  "HR", "Croatia", "europe",
  "https://gov.hr/hr/sklapanje-braka/827",
  "Croatian", 0, true,
  "Apply at the matični ured (registry office). Interpreter required if neither partner speaks Croatian.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Croatian by sworn court translator", monthsBefore: 2 },
  ],
  [
    { key: "interpreter", title: "Interpreter at the ceremony", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the matični ured (registry office)", monthsBefore: 2 },
  ],
);

const DENMARK_TEMPLATE = tpl(
  "DK", "Denmark", "europe",
  "https://www.borger.dk/",
  "Danish or English", 0, true,
  "Denmark is one of the easiest countries in Europe for foreigners to marry. No banns, no residency requirement, fast processing. Apply at the Kommune (municipality).",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of marital status", monthsBefore: 2, maxAgeMonths: 4 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
    { key: "apostille", title: "Apostille on documents (non-EU citizens)", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Kommune (municipality)", monthsBefore: 2 },
  ],
);

const MALTA_TEMPLATE = tpl(
  "MT", "Malta", "europe",
  "https://identitymalta.com/civil-status/marriage/",
  "Maltese or English", 0, true,
  "Apply at the Marriage Registry. Publication of banns 3 weeks before the ceremony. English accepted for most documents.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
  ],
  [
    { key: "banns", title: "Publication of banns (3 weeks)", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the Marriage Registry", monthsBefore: 3 },
  ],
);

const CYPRUS_TEMPLATE = tpl(
  "CY", "Cyprus", "europe",
  "https://www.moi.gov.cy/moi/crmd/crmd.nsf/index_en/index_en",
  "Greek or English", 0, true,
  "Very popular for destination weddings. Fast processing — marriage licence can be issued within days. No banns required.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 2, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the municipal authority for marriage licence", monthsBefore: 2 },
  ],
);

const GEORGIA_TEMPLATE = tpl(
  "GE", "Georgia", "europe",
  "https://sda.gov.ge/?lang=en",
  "Georgian (not required for ceremony)", 0, true,
  "One of the easiest countries in the world to marry. Both partners only need valid passports. Go to the Public Service Hall (House of Justice). Marriage can be registered same day.",
  [
    { key: "passport", title: "Valid passport", monthsBefore: 1 },
  ],
  [
    { key: "apply_registry", title: "Visit the Public Service Hall (House of Justice)", monthsBefore: 0 },
    { key: "apostille_certificate", title: "Apostille the marriage certificate for use abroad", monthsBefore: 0 },
  ],
);

const MONTENEGRO_TEMPLATE = tpl(
  "ME", "Montenegro", "europe",
  "https://www.gov.me/en/",
  "Montenegrin", 0, true,
  "Apply at the local registry office (matičar). Interpreter required if neither partner speaks Montenegrin.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Montenegrin", monthsBefore: 2 },
  ],
  [
    { key: "interpreter", title: "Interpreter at the ceremony", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the local registry office (matičar)", monthsBefore: 2 },
  ],
);

const TURKEY_TEMPLATE = tpl(
  "TR", "Turkey", "europe",
  "https://www.nvi.gov.tr/",
  "Turkish", 0, true,
  "Apply at the local marriage office (evlendirme memurluğu). Health report from a Turkish hospital required.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "health_report", title: "Health report from a Turkish hospital", monthsBefore: 1 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Turkish by sworn translator", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the marriage office (evlendirme memurluğu)", monthsBefore: 2 },
  ],
);

const IRELAND_TEMPLATE = tpl(
  "IE", "Ireland", "europe",
  "https://www.gov.ie/en/service/5636e-get-married-in-ireland/",
  "English", 0, true,
  "Must give 3 months' notice to the HSE Registrar in person in Ireland. Notification appointment must be booked well in advance.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 5, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Letter of freedom to marry", monthsBefore: 5, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 6 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 4 },
  ],
  [
    { key: "notification", title: "Give 3 months' notice to the HSE Registrar (in person)", monthsBefore: 4 },
    { key: "apply_registry", title: "Apply at the civil registration office", monthsBefore: 5 },
  ],
);

const UK_TEMPLATE = tpl(
  "GB", "United Kingdom", "europe",
  "https://www.gov.uk/marriages-civil-partnerships",
  "English", 7, true,
  "Give notice at the local register office at least 28 days before ceremony. Non-EEA nationals may need a marriage visitor visa. Notice period may be extended to 70 days.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "visa", title: "Marriage visitor visa (if non-EEA national)", monthsBefore: 3 },
  ],
  [
    { key: "notice", title: "Give notice at the register office (28+ days before)", monthsBefore: 3 },
    { key: "apply_registry", title: "Book ceremony at a registered venue", monthsBefore: 4 },
  ],
);

const AUSTRIA_TEMPLATE = tpl(
  "AT", "Austria", "europe",
  "https://www.oesterreich.gv.at/themen/familie_und_partnerschaft/heirat.html",
  "German", 0, true,
  "Apply at the Standesamt (registry office). Documents must be translated by a certified translator.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Ehefähigkeitszeugnis (certificate of eligibility to marry)", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into German", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Standesamt (registry office)", monthsBefore: 3 },
  ],
);

const SWITZERLAND_TEMPLATE = tpl(
  "CH", "Switzerland", "europe",
  "https://www.ch.ch/en/family-and-partnership/marriage/",
  "German, French, or Italian (varies by canton)", 0, true,
  "Apply at the Zivilstandsamt (civil registry office). Preparatory procedure (Vorbereitungsverfahren) takes up to 10 days. Requirements vary by canton.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into the canton's official language", monthsBefore: 3 },
    { key: "residence_proof", title: "Proof of legal entry or residence", monthsBefore: 3 },
  ],
  [
    { key: "preparatory", title: "Preparatory procedure (Vorbereitungsverfahren)", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the Zivilstandsamt (civil registry)", monthsBefore: 4 },
  ],
);

const GERMANY_TEMPLATE = tpl(
  "DE", "Germany", "europe",
  "https://www.germany.info/us-en/service/04-FamilyLaw/marriage-in-germany/953376",
  "German", 0, true,
  "Apply at the Standesamt (registry office). Must be registered (Anmeldung) at a local address. Requirements vary by Standesamt.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Ehefähigkeitszeugnis (certificate of eligibility to marry)", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into German", monthsBefore: 3 },
    { key: "anmeldung", title: "Registration at a local address (Anmeldung)", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Standesamt (registry office)", monthsBefore: 4 },
  ],
);

const CZECHIA_TEMPLATE = tpl(
  "CZ", "Czech Republic", "europe",
  "https://www.mvcr.cz/",
  "Czech", 0, true,
  "Apply at the matriční úřad (registry office). Interpreter required if neither partner speaks Czech.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Czech by sworn translator", monthsBefore: 2 },
  ],
  [
    { key: "interpreter", title: "Interpreter at the ceremony", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the matriční úřad (registry office)", monthsBefore: 3 },
  ],
);

const SWEDEN_TEMPLATE = tpl(
  "SE", "Sweden", "europe",
  "https://www.skatteverket.se/",
  "Swedish or English", 0, true,
  "Certificate of no impediment (hindersprövning) from the Swedish Tax Agency or from home country.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment (hindersprövning)", monthsBefore: 3, maxAgeMonths: 4 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents (non-EU)", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply to the Swedish Tax Agency for marriage clearance", monthsBefore: 3 },
  ],
);

const NORWAY_TEMPLATE = tpl(
  "NO", "Norway", "europe",
  "https://www.skatteetaten.no/en/person/national-registry/marriage-and-cohabitation/marriage/",
  "Norwegian or English", 0, true,
  "Apply to the Folkeregisteret (population registry) for prøvingsattest (certificate of no impediment).",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 4 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply to the Folkeregisteret for prøvingsattest", monthsBefore: 3 },
  ],
);

const NETHERLANDS_TEMPLATE = tpl(
  "NL", "Netherlands", "europe",
  "https://www.government.nl/topics/marriages-registered-partnerships-and-cohabitation-agreements/getting-married",
  "Dutch or English", 0, true,
  "Must give notice to the gemeente (municipality) at least 14 days before the ceremony. Wedding must take place within 1 year of notice.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Dutch or English", monthsBefore: 2 },
  ],
  [
    { key: "notice", title: "Give notice at the gemeente (municipality, 14+ days before)", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the gemeente (municipality)", monthsBefore: 3 },
  ],
);

const POLAND_TEMPLATE = tpl(
  "PL", "Poland", "europe",
  "https://www.gov.pl/web/gov/zglos-zamiar-zawarcia-malzenstwa-przed-kierownikiem-usc",
  "Polish", 0, true,
  "Apply at the Urząd Stanu Cywilnego (civil registry office). Interpreter required if neither partner speaks Polish.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Polish by sworn translator", monthsBefore: 2 },
  ],
  [
    { key: "interpreter", title: "Interpreter at the ceremony", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the Urząd Stanu Cywilnego (civil registry)", monthsBefore: 3 },
  ],
);

const HUNGARY_TEMPLATE = tpl(
  "HU", "Hungary", "europe",
  "https://kormany.hu/",
  "Hungarian", 0, true,
  "Apply at the anyakönyvi hivatal (civil registry). 30-day waiting period after application.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Hungarian", monthsBefore: 3 },
  ],
  [
    { key: "waiting_period", title: "30-day waiting period after application", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the anyakönyvi hivatal (civil registry)", monthsBefore: 3 },
  ],
);

const FINLAND_TEMPLATE = tpl(
  "FI", "Finland", "europe",
  "https://dvv.fi/en/getting-married",
  "Finnish or English", 0, true,
  "Examination of impediments by the Digital and Population Data Services Agency (DVV).",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 4 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
  ],
  [
    { key: "impediment_exam", title: "Request examination of impediments from DVV", monthsBefore: 3 },
    { key: "apply_registry", title: "Apply at the Digital and Population Data Services Agency", monthsBefore: 3 },
  ],
);

const ICELAND_TEMPLATE = tpl(
  "IS", "Iceland", "europe",
  "https://www.syslumenn.is/en",
  "Icelandic or English", 0, true,
  "Apply at the Sýslumaður (District Commissioner). Documents in English accepted.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 4 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Sýslumaður (District Commissioner)", monthsBefore: 3 },
  ],
);

// ── Caribbean ───────────────────────────────────────────────────────────

const DOMINICAN_REPUBLIC_TEMPLATE = tpl(
  "DO", "Dominican Republic", "caribbean",
  "https://www.jce.gob.do/",
  "Spanish", 0, true,
  "Hire a local Dominican lawyer (abogado) who processes everything through the Procuraduría General. Ceremony at the Oficialía del Estado Civil or at your venue. Two witnesses required. Apostille the marriage certificate afterward for recognition abroad.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment / single status affidavit", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport (at least 6 months validity)", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on all foreign documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 3 },
    { key: "passport_copies", title: "Certified passport copies", monthsBefore: 3 },
  ],
  [
    { key: "local_lawyer", title: "Hire a local Dominican lawyer (abogado)", monthsBefore: 4 },
    { key: "procuraduria", title: "Lawyer submits documents to Procuraduría General", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Ceremony at the Oficialía del Estado Civil", monthsBefore: 2 },
    { key: "apostille_certificate", title: "Apostille the marriage certificate for use abroad", monthsBefore: 0 },
  ],
);

const JAMAICA_TEMPLATE = tpl(
  "JM", "Jamaica", "caribbean",
  "https://rgd.gov.jm/",
  "English", 1, false,
  "Must be on the island for at least 24 hours before applying. Jamaica is NOT a Hague Convention member — documents need full legalization/consular authentication, not apostille.",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized, not apostille)", monthsBefore: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "no_impediment", title: "Statutory declaration of single status", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for marriage licence at the Ministry of Justice", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
  ],
);

const BAHAMAS_TEMPLATE = tpl(
  "BS", "Bahamas", "caribbean",
  "https://www.bahamas.gov.bs/",
  "English", 1, true,
  "Must be in the Bahamas for at least 1 day. Apply for marriage licence at the Registrar General's office. Licence valid for 3 months.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for marriage licence at the Registrar General", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const BARBADOS_TEMPLATE = tpl(
  "BB", "Barbados", "caribbean",
  "https://www.gov.bb/",
  "English", 0, true,
  "Apply for a marriage licence at the Ministry of Home Affairs. No waiting period. One of the easiest Caribbean destinations.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for marriage licence at the Ministry of Home Affairs", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const ST_LUCIA_TEMPLATE = tpl(
  "LC", "St. Lucia", "caribbean",
  "https://www.govt.lc/",
  "English", 0, true,
  "If on island less than 2 days, need a governor's special licence. Apply at the Attorney General's office.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for marriage licence at the Attorney General's office", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const ARUBA_TEMPLATE = tpl(
  "AW", "Aruba", "caribbean",
  "https://www.government.aw/",
  "Dutch or Papiamento", 0, true,
  "Apply at the Bureau Burgerlijke Stand. Documents must be apostilled (through Netherlands/Hague Convention).",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign public documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Dutch", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Bureau Burgerlijke Stand", monthsBefore: 3 },
  ],
);

const ANTIGUA_TEMPLATE = tpl(
  "AG", "Antigua and Barbuda", "caribbean",
  "https://ab.gov.ag/",
  "English", 1, true,
  "Apply for a special marriage licence. Must be on the island for at least 1 day.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for a special marriage licence", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const TRINIDAD_TEMPLATE = tpl(
  "TT", "Trinidad and Tobago", "caribbean",
  "https://www.ttconnect.gov.tt/",
  "English", 3, true,
  "Must be on the island for 3 days before applying. Apply for a Special Marriage licence at the Registrar General.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for Special Marriage licence at the Registrar General", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

// ── Americas ────────────────────────────────────────────────────────────

const MEXICO_TEMPLATE = tpl(
  "MX", "Mexico", "americas",
  "https://www.gob.mx/tramites/ficha/matrimonio-civil/SEGOB186",
  "Spanish", 0, true,
  "Requirements vary by state. Apply at the Registro Civil. Four witnesses needed. Some states require blood test. Tourist permit (FMM) needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment / single status letter", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "tourist_permit", title: "Tourist permit (FMM)", monthsBefore: 1 },
    { key: "apostille", title: "Apostille on all foreign documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 2 },
    { key: "blood_test", title: "Blood test (required in some states, check locally)", monthsBefore: 1 },
  ],
  [
    { key: "witnesses", title: "Arrange 4 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Registro Civil", monthsBefore: 3 },
  ],
);

const USA_TEMPLATE = tpl(
  "US", "United States", "americas",
  "https://www.usa.gov/get-married",
  "English", 0, true,
  "Requirements vary by state. Obtain a marriage licence from the county clerk's office. Some states have waiting periods (1–5 days). No apostille needed for domestic ceremony.",
  [
    { key: "passport", title: "Valid passport or government-issued ID", monthsBefore: 2 },
    { key: "birth_certificate", title: "Birth certificate (if required by state)", monthsBefore: 2 },
    { key: "no_impediment", title: "Proof of single status (if foreign national)", monthsBefore: 2, maxAgeMonths: 6 },
  ],
  [
    { key: "marriage_licence", title: "Obtain marriage licence from county clerk's office", monthsBefore: 1 },
    { key: "officiant", title: "Book officiant (religious or secular)", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange witnesses (required in most states)", monthsBefore: 1 },
  ],
);

const CANADA_TEMPLATE = tpl(
  "CA", "Canada", "americas",
  "https://www.canada.ca/en/services/benefits/family/marriage.html",
  "English or French", 0, true,
  "Requirements vary by province. Obtain a marriage licence from the provincial vital statistics office. No residency requirement in most provinces.",
  [
    { key: "passport", title: "Valid passport or government-issued ID", monthsBefore: 2 },
    { key: "birth_certificate", title: "Birth certificate (if required by province)", monthsBefore: 2 },
    { key: "no_impediment", title: "Statutory declaration of single status (if foreign national)", monthsBefore: 2 },
  ],
  [
    { key: "marriage_licence", title: "Obtain marriage licence from the provincial office", monthsBefore: 1 },
    { key: "officiant", title: "Book licensed officiant", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const COSTA_RICA_TEMPLATE = tpl(
  "CR", "Costa Rica", "americas",
  "https://www.tse.go.cr/",
  "Spanish", 0, true,
  "Very popular destination. Hire a local lawyer who handles the Registro Civil. Two witnesses needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 2 },
  ],
  [
    { key: "local_lawyer", title: "Hire a local lawyer to handle the Registro Civil", monthsBefore: 3 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
    { key: "apply_registry", title: "Ceremony and registration at Registro Civil", monthsBefore: 2 },
  ],
);

const COLOMBIA_TEMPLATE = tpl(
  "CO", "Colombia", "americas",
  "https://www.registraduria.gov.co/",
  "Spanish", 0, true,
  "Apply at a Notaría (notary public). Two witnesses needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment / single status", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 2 },
  ],
  [
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at a Notaría (notary public)", monthsBefore: 3 },
  ],
);

const BRAZIL_TEMPLATE = tpl(
  "BR", "Brazil", "americas",
  "https://www.gov.br/pt-br",
  "Portuguese", 0, true,
  "Apply at the Cartório de Registro Civil. Publication of banns (proclamas) for 15 days. Two witnesses needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 4, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Portuguese by sworn translator", monthsBefore: 3 },
  ],
  [
    { key: "banns", title: "Publication of banns (proclamas, 15 days)", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Cartório de Registro Civil", monthsBefore: 4 },
  ],
);

const ARGENTINA_TEMPLATE = tpl(
  "AR", "Argentina", "americas",
  "https://www.argentina.gob.ar/",
  "Spanish", 0, true,
  "Apply at the Registro Civil. Pre-marital blood test within 15 days of ceremony. Two witnesses needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "blood_test", title: "Pre-marital blood test (within 15 days of ceremony)", monthsBefore: 1 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 2 },
  ],
  [
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Registro Civil", monthsBefore: 3 },
  ],
);

const PERU_TEMPLATE = tpl(
  "PE", "Peru", "americas",
  "https://www.gob.pe/",
  "Spanish", 0, true,
  "Apply at the Municipalidad (municipality). Publication of edictos for 8 days. Two witnesses needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 2 },
  ],
  [
    { key: "edictos", title: "Publication of edictos (8 days)", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Municipalidad (municipality)", monthsBefore: 3 },
  ],
);

const CHILE_TEMPLATE = tpl(
  "CL", "Chile", "americas",
  "https://www.registrocivil.cl/",
  "Spanish", 0, true,
  "Apply at the Registro Civil. Two witnesses needed.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Spanish", monthsBefore: 2 },
  ],
  [
    { key: "witnesses", title: "Arrange 2 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Registro Civil", monthsBefore: 3 },
  ],
);

const BELIZE_TEMPLATE = tpl(
  "BZ", "Belize", "americas",
  "https://www.belize.gov.bz/",
  "English", 3, false,
  "Must be in Belize for at least 3 days before applying. Belize is NOT a Hague Convention member. Apply at the General Registry.",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized, not apostille)", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for marriage licence at the General Registry", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

// ── Asia ────────────────────────────────────────────────────────────────

const THAILAND_TEMPLATE = tpl(
  "TH", "Thailand", "asia",
  "https://www.mfa.go.th/en/",
  "Thai", 0, false,
  "Get an affidavit of freedom to marry from your embassy in Bangkok. Certified by Thailand's Ministry of Foreign Affairs. Apply at the local Amphur (district office). NOT a Hague Convention member.",
  [
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
    { key: "affidavit_embassy", title: "Affidavit of freedom to marry from your embassy in Bangkok", monthsBefore: 2 },
    { key: "mfa_certification", title: "Certification of affidavit by Ministry of Foreign Affairs", monthsBefore: 1 },
    { key: "translation", title: "Certified translation into Thai", monthsBefore: 1 },
  ],
  [
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
    { key: "apply_registry", title: "Register marriage at the local Amphur (district office)", monthsBefore: 1 },
  ],
);

const INDONESIA_TEMPLATE = tpl(
  "ID", "Indonesia (Bali)", "asia",
  "https://www.dukcapil.kemendagri.go.id/",
  "Bahasa Indonesia", 0, false,
  "Indonesia does NOT accept apostille. Documents need full legalization through Indonesian embassy. For non-Muslim ceremonies: apply at Kantor Catatan Sipil (civil registry).",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized through Indonesian embassy)", monthsBefore: 3 },
    { key: "no_impediment", title: "Certificate of single status from your embassy", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "embassy_letter", title: "Letter of introduction from your embassy", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Bahasa Indonesia", monthsBefore: 2 },
    { key: "passport_photos", title: "Passport-size photos (4×6 cm)", monthsBefore: 1 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Kantor Catatan Sipil (civil registry)", monthsBefore: 2 },
  ],
);

const PHILIPPINES_TEMPLATE = tpl(
  "PH", "Philippines", "asia",
  "https://psa.gov.ph/",
  "Filipino or English", 0, false,
  "Pre-marriage counseling seminar required. Marriage licence has a 10-day posting period. NOT a Hague Convention member.",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized, not apostille)", monthsBefore: 3 },
    { key: "no_impediment", title: "Certificate of legal capacity to marry from your embassy", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
  ],
  [
    { key: "counseling", title: "Complete pre-marriage counseling seminar", monthsBefore: 2 },
    { key: "marriage_licence", title: "Apply for marriage licence (10-day posting period)", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
    { key: "apply_registry", title: "Register at the local civil registrar", monthsBefore: 2 },
  ],
);

const JAPAN_TEMPLATE = tpl(
  "JP", "Japan", "asia",
  "https://www.moj.go.jp/EN/MINJI/minji15.html",
  "Japanese", 0, true,
  "Purely a paper process — no ceremony required. Get an affidavit of competency to marry from your embassy. Submit the marriage registration form (kon'in todoke) at the local ward/city office.",
  [
    { key: "passport", title: "Valid passport", monthsBefore: 2 },
    { key: "affidavit_embassy", title: "Affidavit of competency to marry from your embassy in Japan", monthsBefore: 2 },
    { key: "birth_certificate", title: "Birth certificate (for some embassies)", monthsBefore: 2 },
    { key: "translation", title: "Japanese translation of all foreign documents", monthsBefore: 1 },
  ],
  [
    { key: "witnesses", title: "Arrange 2 witnesses (can be anyone)", monthsBefore: 1 },
    { key: "apply_registry", title: "Submit kon'in todoke at the local ward/city office", monthsBefore: 1 },
  ],
);

const SOUTH_KOREA_TEMPLATE = tpl(
  "KR", "South Korea", "asia",
  "https://www.gov.kr/",
  "Korean", 0, true,
  "Get an affidavit of eligibility to marry from your embassy. Submit at the local Gu office (district office).",
  [
    { key: "passport", title: "Valid passport", monthsBefore: 2 },
    { key: "affidavit_embassy", title: "Affidavit of eligibility to marry from your embassy", monthsBefore: 2 },
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "translation", title: "Certified translation into Korean by notarized translator", monthsBefore: 1 },
  ],
  [
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
    { key: "apply_registry", title: "Submit at the local Gu office (district office)", monthsBefore: 1 },
  ],
);

const INDIA_TEMPLATE = tpl(
  "IN", "India", "asia",
  "https://www.india.gov.in/",
  "English or Hindi", 30, true,
  "Under the Special Marriage Act: 30-day notice period at the Sub-Divisional Magistrate's office. Must be in the district for 30 days. Three witnesses required.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "no_impediment", title: "Affidavit of single status", monthsBefore: 3 },
    { key: "address_proof", title: "Proof of address", monthsBefore: 3 },
    { key: "passport_photos", title: "Passport-size photos", monthsBefore: 1 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 3 },
  ],
  [
    { key: "notice_period", title: "30-day notice period at the Sub-Divisional Magistrate's office", monthsBefore: 3 },
    { key: "witnesses", title: "Arrange 3 witnesses with valid ID", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply under Special Marriage Act", monthsBefore: 4 },
  ],
);

const SRI_LANKA_TEMPLATE = tpl(
  "LK", "Sri Lanka", "asia",
  "https://www.gov.lk/",
  "Sinhala, Tamil, or English", 4, false,
  "Apply at the local Registrar of Marriages. 14-day notice period. Must be in Sri Lanka for 4 days. NOT a Hague Convention member.",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized, not apostille)", monthsBefore: 3 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
  ],
  [
    { key: "notice_period", title: "14-day notice period at the Registrar", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the local Registrar of Marriages", monthsBefore: 2 },
  ],
);

const MALDIVES_TEMPLATE = tpl(
  "MV", "Maldives", "asia",
  "https://www.gov.mv/",
  "Dhivehi or English", 0, false,
  "Legal marriages for foreigners performed as Islamic ceremonies. Most resorts handle all paperwork. Many couples do symbolic ceremonies and legalize at home.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 2, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "resort_coordinator", title: "Coordinate with resort wedding planner (they handle applications)", monthsBefore: 3 },
  ],
);

const UAE_TEMPLATE = tpl(
  "AE", "United Arab Emirates (Dubai)", "asia",
  "https://www.mohre.gov.ae/",
  "Arabic or English", 0, false,
  "UAE does NOT use apostille — documents need embassy attestation + UAE MoFA attestation. Medical fitness test required.",
  [
    { key: "birth_certificate", title: "Birth certificate (attested by UAE embassy + MoFA)", monthsBefore: 3 },
    { key: "no_impediment", title: "Certificate of no impediment / single status", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "medical_test", title: "Medical fitness test (HIV, hepatitis)", monthsBefore: 1 },
    { key: "salary_certificate", title: "Salary certificate / proof of income", monthsBefore: 2 },
    { key: "passport_photos", title: "Passport-size photos", monthsBefore: 1 },
    { key: "attestation", title: "Embassy attestation + UAE MoFA attestation on all documents", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply at Dubai Courts or Abu Dhabi Courts", monthsBefore: 2 },
  ],
);

// ── Oceania ─────────────────────────────────────────────────────────────

const AUSTRALIA_TEMPLATE = tpl(
  "AU", "Australia", "oceania",
  "https://www.ag.gov.au/families-and-marriage/marriage",
  "English", 0, true,
  "File a Notice of Intended Marriage (NOIM) at least 1 month before ceremony. Both parties must sign the NOIM in front of an authorized celebrant.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
  ],
  [
    { key: "noim", title: "File Notice of Intended Marriage (NOIM) with celebrant", monthsBefore: 2 },
    { key: "celebrant", title: "Book an authorized marriage celebrant", monthsBefore: 3 },
    { key: "witnesses", title: "Arrange 2 witnesses (18+)", monthsBefore: 1 },
  ],
);

const NEW_ZEALAND_TEMPLATE = tpl(
  "NZ", "New Zealand", "oceania",
  "https://www.govt.nz/browse/family-and-whanau/getting-married/",
  "English", 0, true,
  "Apply for a marriage licence at any Births, Deaths and Marriages office. 3-day waiting period. Licence valid for 3 months.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
    { key: "no_impediment", title: "Statutory declaration of no impediment", monthsBefore: 2 },
  ],
  [
    { key: "marriage_licence", title: "Apply for marriage licence (3-day waiting period)", monthsBefore: 2 },
    { key: "celebrant", title: "Book a licensed celebrant", monthsBefore: 3 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const FIJI_TEMPLATE = tpl(
  "FJ", "Fiji", "oceania",
  "https://www.fiji.gov.fj/",
  "English or Fijian", 0, false,
  "Apply for a special marriage licence at the local Registrar. No waiting period with a special licence. NOT a Hague Convention member.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply for special marriage licence at the Registrar", monthsBefore: 1 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const TAHITI_TEMPLATE = tpl(
  "PF", "French Polynesia (Tahiti)", "oceania",
  "https://www.service-public.pf/",
  "French", 30, true,
  "Same requirements as France — one partner must reside for at least 30 days. Publication of banns required. Hague Convention member through France.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 3 },
    { key: "no_impediment", title: "Certificate of celibacy", monthsBefore: 4, maxAgeMonths: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into French", monthsBefore: 3 },
    { key: "residence_proof", title: "Proof of 30-day residency", monthsBefore: 2 },
  ],
  [
    { key: "banns", title: "Publication of banns at the Mairie", monthsBefore: 1 },
    { key: "apply_registry", title: "Apply at the Mairie (city hall)", monthsBefore: 3 },
  ],
);

// ── Africa ──────────────────────────────────────────────────────────────

const SOUTH_AFRICA_TEMPLATE = tpl(
  "ZA", "South Africa", "africa",
  "https://www.dha.gov.za/",
  "English", 0, true,
  "Apply at the Department of Home Affairs for a marriage licence. Letter of no impediment from your embassy if you are a foreign national.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 3 },
    { key: "no_impediment", title: "Letter of no impediment from your embassy", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Department of Home Affairs", monthsBefore: 3 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const MOROCCO_TEMPLATE = tpl(
  "MA", "Morocco", "africa",
  "https://www.justice.gov.ma/",
  "Arabic or French", 0, true,
  "Marriage performed by two adouls (Islamic notaries). Non-Muslim men must convert to marry a Muslim woman. For two non-Muslims, a civil ceremony at the consulate is possible.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 4, maxAgeMonths: 3 },
    { key: "no_impediment", title: "Certificate of celibacy (certificat de célibat)", monthsBefore: 4, maxAgeMonths: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 5 },
    { key: "medical_certificate", title: "Medical certificate", monthsBefore: 1 },
    { key: "criminal_record", title: "Criminal record extract", monthsBefore: 3, maxAgeMonths: 3 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 3 },
    { key: "translation", title: "Certified translation into Arabic or French", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply through two adouls (Islamic notaries)", monthsBefore: 3 },
  ],
);

const KENYA_TEMPLATE = tpl(
  "KE", "Kenya", "africa",
  "https://www.ecitizen.go.ke/",
  "English or Swahili", 0, false,
  "Apply at the Registrar of Marriages. 21-day notice period for regular licence. NOT a Hague Convention member.",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized, not apostille)", monthsBefore: 3 },
    { key: "no_impediment", title: "Affidavit of single status", monthsBefore: 3 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
  ],
  [
    { key: "notice_period", title: "21-day notice period (or apply for special licence)", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the Registrar of Marriages", monthsBefore: 3 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const TANZANIA_TEMPLATE = tpl(
  "TZ", "Tanzania (Zanzibar)", "africa",
  "https://www.tanzania.go.tz/",
  "Swahili or English", 0, false,
  "Apply at the local Registrar of Marriages. 21-day notice period (special licence available). Popular for Zanzibar beach weddings.",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized, not apostille)", monthsBefore: 3 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
  ],
  [
    { key: "notice_period", title: "21-day notice period (or special licence)", monthsBefore: 2 },
    { key: "apply_registry", title: "Apply at the local Registrar of Marriages", monthsBefore: 2 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const MAURITIUS_TEMPLATE = tpl(
  "MU", "Mauritius", "africa",
  "https://civilstatus.govmu.org/",
  "English or French", 1, true,
  "Apply at the Civil Status Office at least 10 working days before the ceremony. Must be on the island at time of filing.",
  [
    { key: "birth_certificate", title: "Birth certificate", monthsBefore: 2, maxAgeMonths: 6 },
    { key: "no_impediment", title: "Certificate of no impediment (if available)", monthsBefore: 2, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
    { key: "apostille", title: "Apostille on foreign documents", monthsBefore: 2 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Civil Status Office (10+ working days before)", monthsBefore: 1 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const SEYCHELLES_TEMPLATE = tpl(
  "SC", "Seychelles", "africa",
  "https://www.gov.sc/",
  "English, French, or Creole", 3, false,
  "Apply at the Civil Status Office at least 11 days before the ceremony. Must be in the Seychelles for 3 days. NOT a Hague Convention member.",
  [
    { key: "birth_certificate", title: "Birth certificate (legalized, not apostille)", monthsBefore: 2 },
    { key: "no_impediment", title: "Certificate of no impediment or statutory declaration", monthsBefore: 2, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply at the Civil Status Office (11+ days before)", monthsBefore: 1 },
    { key: "witnesses", title: "Arrange 2 witnesses", monthsBefore: 1 },
  ],
);

const EGYPT_TEMPLATE = tpl(
  "EG", "Egypt", "africa",
  "https://www.justice.gov.eg/",
  "Arabic", 0, false,
  "Documents must be authenticated by Egyptian embassy and translated to Arabic. NOT a Hague Convention member.",
  [
    { key: "birth_certificate", title: "Birth certificate (authenticated by Egyptian embassy)", monthsBefore: 3 },
    { key: "no_impediment", title: "Certificate of no impediment to marriage", monthsBefore: 3, maxAgeMonths: 6 },
    { key: "passport", title: "Valid passport", monthsBefore: 4 },
    { key: "hiv_test", title: "HIV test", monthsBefore: 1 },
    { key: "authentication", title: "Authentication by Egyptian embassy + translation to Arabic", monthsBefore: 3 },
  ],
  [
    { key: "apply_registry", title: "Apply at the marriage court or through a ma'zun", monthsBefore: 2 },
  ],
);

// ── Template index ──────────────────────────────────────────────────────

export const TEMPLATES: Record<string, PaperworkTemplate> = {
  SI: SLOVENIA_TEMPLATE, IT: ITALY_TEMPLATE, FR: FRANCE_TEMPLATE,
  ES: SPAIN_TEMPLATE, PT: PORTUGAL_TEMPLATE, GR: GREECE_TEMPLATE,
  HR: CROATIA_TEMPLATE, DK: DENMARK_TEMPLATE, MT: MALTA_TEMPLATE,
  CY: CYPRUS_TEMPLATE, GE: GEORGIA_TEMPLATE, ME: MONTENEGRO_TEMPLATE,
  TR: TURKEY_TEMPLATE, IE: IRELAND_TEMPLATE, GB: UK_TEMPLATE,
  AT: AUSTRIA_TEMPLATE, CH: SWITZERLAND_TEMPLATE, DE: GERMANY_TEMPLATE,
  CZ: CZECHIA_TEMPLATE, SE: SWEDEN_TEMPLATE, NO: NORWAY_TEMPLATE,
  NL: NETHERLANDS_TEMPLATE, PL: POLAND_TEMPLATE, HU: HUNGARY_TEMPLATE,
  FI: FINLAND_TEMPLATE, IS: ICELAND_TEMPLATE,
  DO: DOMINICAN_REPUBLIC_TEMPLATE, JM: JAMAICA_TEMPLATE,
  BS: BAHAMAS_TEMPLATE, BB: BARBADOS_TEMPLATE, LC: ST_LUCIA_TEMPLATE,
  AW: ARUBA_TEMPLATE, AG: ANTIGUA_TEMPLATE, TT: TRINIDAD_TEMPLATE,
  MX: MEXICO_TEMPLATE, US: USA_TEMPLATE, CA: CANADA_TEMPLATE,
  CR: COSTA_RICA_TEMPLATE, CO: COLOMBIA_TEMPLATE, BR: BRAZIL_TEMPLATE,
  AR: ARGENTINA_TEMPLATE, PE: PERU_TEMPLATE, CL: CHILE_TEMPLATE,
  BZ: BELIZE_TEMPLATE,
  TH: THAILAND_TEMPLATE, ID: INDONESIA_TEMPLATE, PH: PHILIPPINES_TEMPLATE,
  JP: JAPAN_TEMPLATE, KR: SOUTH_KOREA_TEMPLATE, IN: INDIA_TEMPLATE,
  LK: SRI_LANKA_TEMPLATE, MV: MALDIVES_TEMPLATE, AE: UAE_TEMPLATE,
  AU: AUSTRALIA_TEMPLATE, NZ: NEW_ZEALAND_TEMPLATE, FJ: FIJI_TEMPLATE,
  PF: TAHITI_TEMPLATE,
  ZA: SOUTH_AFRICA_TEMPLATE, MA: MOROCCO_TEMPLATE, KE: KENYA_TEMPLATE,
  TZ: TANZANIA_TEMPLATE, MU: MAURITIUS_TEMPLATE, SC: SEYCHELLES_TEMPLATE,
  EG: EGYPT_TEMPLATE,
};

export const COUNTRY_LIST = Object.values(TEMPLATES).map((tp) => ({
  code: tp.country,
  name: tp.countryName,
  region: tp.region,
}));

export const REGIONS: { key: PaperworkTemplate["region"]; label: string }[] = [
  { key: "europe", label: "Europe" },
  { key: "caribbean", label: "Caribbean" },
  { key: "americas", label: "Americas" },
  { key: "asia", label: "Asia & Middle East" },
  { key: "oceania", label: "Pacific & Oceania" },
  { key: "africa", label: "Africa" },
];

// ── Nationalities ──────────────────────────────────────────────────────

export type NationalityInfo = { code: string; name: string; hague: boolean };

const EXTRA_NATIONALITIES: NationalityInfo[] = [
  { code: "RO", name: "Romania", hague: true },
  { code: "BG", name: "Bulgaria", hague: true },
  { code: "RS", name: "Serbia", hague: true },
  { code: "BA", name: "Bosnia and Herzegovina", hague: true },
  { code: "MK", name: "North Macedonia", hague: true },
  { code: "AL", name: "Albania", hague: true },
  { code: "XK", name: "Kosovo", hague: false },
  { code: "SK", name: "Slovakia", hague: true },
  { code: "LT", name: "Lithuania", hague: true },
  { code: "LV", name: "Latvia", hague: true },
  { code: "EE", name: "Estonia", hague: true },
  { code: "RU", name: "Russia", hague: true },
  { code: "UA", name: "Ukraine", hague: true },
  { code: "BY", name: "Belarus", hague: true },
  { code: "MD", name: "Moldova", hague: true },
  { code: "AM", name: "Armenia", hague: true },
  { code: "AZ", name: "Azerbaijan", hague: true },
  { code: "KZ", name: "Kazakhstan", hague: true },
  { code: "UZ", name: "Uzbekistan", hague: true },
  { code: "CN", name: "China", hague: true },
  { code: "TW", name: "Taiwan", hague: false },
  { code: "HK", name: "Hong Kong", hague: true },
  { code: "SG", name: "Singapore", hague: false },
  { code: "MY", name: "Malaysia", hague: false },
  { code: "VN", name: "Vietnam", hague: false },
  { code: "PK", name: "Pakistan", hague: false },
  { code: "BD", name: "Bangladesh", hague: false },
  { code: "NP", name: "Nepal", hague: false },
  { code: "NG", name: "Nigeria", hague: false },
  { code: "GH", name: "Ghana", hague: false },
  { code: "ET", name: "Ethiopia", hague: false },
  { code: "DZ", name: "Algeria", hague: false },
  { code: "TN", name: "Tunisia", hague: true },
  { code: "LU", name: "Luxembourg", hague: true },
  { code: "BE", name: "Belgium", hague: true },
  { code: "IL", name: "Israel", hague: true },
  { code: "LB", name: "Lebanon", hague: false },
  { code: "JO", name: "Jordan", hague: false },
  { code: "SA", name: "Saudi Arabia", hague: false },
  { code: "QA", name: "Qatar", hague: false },
  { code: "KW", name: "Kuwait", hague: false },
  { code: "BH", name: "Bahrain", hague: false },
  { code: "OM", name: "Oman", hague: true },
  { code: "IR", name: "Iran", hague: false },
  { code: "EC", name: "Ecuador", hague: true },
  { code: "VE", name: "Venezuela", hague: true },
  { code: "UY", name: "Uruguay", hague: true },
  { code: "PY", name: "Paraguay", hague: true },
  { code: "BO", name: "Bolivia", hague: true },
  { code: "PA", name: "Panama", hague: true },
  { code: "CU", name: "Cuba", hague: false },
  { code: "DO_NAT", name: "Dominican (nationality)", hague: true },
];

const templateNats: NationalityInfo[] = Object.values(TEMPLATES).map((t) => ({
  code: t.country,
  name: t.countryName,
  hague: t.hagueConvention,
}));

const seen = new Set<string>();
export const NATIONALITIES: NationalityInfo[] = [...templateNats, ...EXTRA_NATIONALITIES]
  .filter((n) => {
    if (seen.has(n.code)) return false;
    seen.add(n.code);
    return true;
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function getNationalityName(code: string): string {
  return NATIONALITIES.find((n) => n.code === code)?.name ?? code;
}

export function getNationalityHague(code: string): boolean {
  return NATIONALITIES.find((n) => n.code === code)?.hague ?? false;
}

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
