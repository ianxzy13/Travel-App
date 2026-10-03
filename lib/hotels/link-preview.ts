// Reads what it can about a hotel from its web page (Booking.com, Airbnb,
// Google Maps, the hotel's own site): name, photo, address, stars, review
// score and sometimes a price. Pure functions here; the fetching lives in
// fetch-link-preview.ts (server only).

export type HotelPreview = {
  name: string;
  imageUrl: string | null;
  address: string | null;
  stars: number | null;
  /** out of 10 */
  reviewScore: number | null;
  pricePerNight: number | null;
};

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();

/** <meta property="og:title" content="…"> in either attribute order. */
function meta(html: string, key: string): string | null {
  const k = key.replace(/[.:]/g, "\\$&");
  const a = new RegExp(
    `<meta[^>]+(?:property|name)=["']${k}["'][^>]*content=["']([^"']*)["']`,
    "i",
  ).exec(html);
  const b = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${k}["']`,
    "i",
  ).exec(html);
  const v = (a ?? b)?.[1];
  return v ? decode(v) || null : null;
}

/** Hotel-like objects from <script type="application/ld+json"> blocks. */
function jsonLdHotels(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      const walk = (v: unknown) => {
        if (Array.isArray(v)) return v.forEach(walk);
        if (!v || typeof v !== "object") return;
        const o = v as Record<string, unknown>;
        const type = ([] as unknown[]).concat(o["@type"] ?? []).map(String);
        if (
          type.some((t) =>
            /^(Hotel|LodgingBusiness|Resort|BedAndBreakfast|Hostel|Motel|VacationRental|Apartment|House|Accommodation)$/.test(
              t,
            ),
          )
        )
          out.push(o);
        if (o["@graph"]) walk(o["@graph"]);
      };
      walk(JSON.parse(m[1]));
    } catch {
      // broken JSON-LD: ignore it
    }
  }
  return out;
}

const num = (v: unknown): number | null => {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** "Grand Hotel Union, Ljubljana – Updated 2027 Prices" → "Grand Hotel Union, Ljubljana". */
export function cleanTitle(title: string): string {
  return title
    .split(
      /\s+[–—|·]\s+|\s+-\s+(?=Updated|Booking|Prices|Hotel deals|Tripadvisor|Airbnb|Google)/i,
    )[0]
    .replace(/\s*\((?:updated )?\d{4}(?: prices)?\)\s*$/i, "")
    .trim();
}

/** A readable name from the link itself, when the page can't be read. */
export function nameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const slug = (parts.at(-1) ?? "")
      .replace(/\.(?:[a-z-]+\.)?html?$/i, "")
      .replace(/\.[a-z]{2}(?:-[a-z]{2})?$/i, "");
    const words = decodeURIComponent(slug)
      .replace(/[-_+]+/g, " ")
      .replace(/\b\d{5,}\b/g, "")
      .trim();
    if (words && /[a-z]/i.test(words) && !/^(rooms?|hotel|place)$/i.test(words)) {
      return words.replace(/\b\p{L}/gu, (c) => c.toUpperCase()).slice(0, 120);
    }
    return u.hostname.replace(/^www\./, "").slice(0, 120);
  } catch {
    return url.slice(0, 120);
  }
}

/** Everything we can read from the page's HTML; null fields when unknown. */
export function parseHotelPage(html: string, url: string): HotelPreview {
  const ld = jsonLdHotels(html)[0] ?? {};
  const ldAddress = ld.address as Record<string, unknown> | string | undefined;
  const address =
    typeof ldAddress === "string"
      ? ldAddress
      : ldAddress
        ? [
            ldAddress.streetAddress,
            ldAddress.postalCode,
            ldAddress.addressLocality,
            ldAddress.addressCountry,
          ]
            .map((x) => (typeof x === "object" && x ? (x as { name?: string }).name : x))
            .filter((x) => typeof x === "string" && x.trim())
            .join(", ")
        : null;
  const image = ([] as unknown[]).concat(ld.image ?? [])[0];
  const imageUrl =
    meta(html, "og:image") ??
    (typeof image === "string" ? image : ((image as { url?: string } | undefined)?.url ?? null));

  const rating = ld.aggregateRating as Record<string, unknown> | undefined;
  let reviewScore: number | null = null;
  const value = num(rating?.ratingValue);
  if (value != null) {
    const best = num(rating?.bestRating) ?? (value <= 5 ? 5 : 10);
    reviewScore = Math.round((value / best) * 100) / 10;
  }
  const starRating = ld.starRating as Record<string, unknown> | undefined;
  const stars = num(starRating?.ratingValue);

  // a single price ("€120") counts; ranges like "€80 - €200" don't
  const priceText =
    meta(html, "product:price:amount") ??
    meta(html, "og:price:amount") ??
    (typeof ld.priceRange === "string" && !/[-–]/.test(ld.priceRange) ? ld.priceRange : null);
  const price = priceText ? num(priceText.replace(/[^\d.,]/g, "")) : null;

  const title =
    (typeof ld.name === "string" && ld.name.trim()) ||
    meta(html, "og:title") ||
    meta(html, "twitter:title") ||
    decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "");
  const name = cleanTitle(decode(title)) || nameFromUrl(url);

  const safeImage = imageUrl && /^https:\/\//i.test(imageUrl) ? imageUrl.slice(0, 1000) : null;
  return {
    name: name.slice(0, 120),
    imageUrl: safeImage,
    address: address ? decode(address).slice(0, 300) || null : null,
    stars: stars != null && stars >= 1 && stars <= 5 ? Math.round(stars) : null,
    reviewScore: reviewScore != null && reviewScore >= 0 && reviewScore <= 10 ? reviewScore : null,
    pricePerNight: price != null && price > 0 && price < 100000 ? price : null,
  };
}

/** True for addresses on the open internet (blocks localhost, private and link-local ranges). */
export function isPublicAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return !(
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") ||
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb")
  );
}
