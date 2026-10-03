const KNOT_DOMAINS: Record<string, string> = {
  US: "theknot.com",
  MX: "bodas.com.mx",
  ES: "bodas.net",
  CO: "bodas.com.co",
  CL: "matrimonios.cl",
  PE: "matrimonio.com.pe",
  AR: "casamientos.com.ar",
  BR: "casamentos.com.br",
  IT: "matrimonio.com",
  FR: "mariages.net",
  DE: "hochzeitsplaza.de",
  IN: "weddingwire.in",
  CA: "weddingwire.ca",
  GB: "hitched.co.uk",
  PT: "casamentos.pt",
};

const CATEGORY_MAP: Record<string, string> = {
  venue: "reception-venues",
  photography: "wedding-photographers",
  videography: "wedding-videographers",
  catering: "wedding-caterers",
  florist: "wedding-florists",
  music: "wedding-djs",
  dj: "wedding-djs",
  "hair & makeup": "beauty",
  dress: "wedding-dresses",
  cake: "wedding-cakes",
  invitations: "wedding-invitations",
  transportation: "transportation",
  officiant: "wedding-officiants",
  planner: "wedding-planners",
  decor: "wedding-decorations",
  rentals: "wedding-rentals",
};

export type VendorSearchLinks = {
  google: string;
  theKnot: string | null;
  tripAdvisor: string | null;
};

export function vendorSearchLinks(
  category: string,
  location: string,
  countryCode?: string,
): VendorSearchLinks {
  const q = encodeURIComponent(`${category} ${location}`);
  const cc = countryCode?.toUpperCase() ?? "";

  const slug = CATEGORY_MAP[category.toLowerCase()] ?? null;
  const knotDomain = KNOT_DOMAINS[cc] ?? KNOT_DOMAINS["US"];
  const theKnot = slug ? `https://www.${knotDomain}/marketplace/${slug}` : null;

  const isFood = /cater|restaurant|food/i.test(category);
  const tripAdvisor = isFood
    ? `https://www.tripadvisor.com/Search?q=${q}`
    : null;

  return {
    google: `https://www.google.com/maps/search/${q}`,
    theKnot,
    tripAdvisor,
  };
}

export function bookingSearch(query: string, affiliateId?: string): string {
  const aid = affiliateId ?? process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID ?? "";
  const url = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`;
  return aid ? `${url}&aid=${encodeURIComponent(aid)}` : url;
}

export function hasAnyAffiliate(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID ||
    process.env.NEXT_PUBLIC_SKYSCANNER_AFFILIATE_URL_PREFIX ||
    process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER
  );
}
