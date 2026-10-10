type RawAirport = {
  c: string;   // IATA code
  n: string;   // name
  t: string;   // city
  cc: string;  // country code
  co: string;  // country name
  k?: string;  // keywords
  r: number;   // rank (1=large, 2=medium)
};

export type Airport = {
  code: string;
  name: string;
  city: string;
  countryCode: string;
  country: string;
  rank: number;
};

type IndexedAirport = Airport & {
  _code: string;
  _name: string;
  _city: string;
  _country: string;
  _keywords: string;
  _all: string;
};

let index: IndexedAirport[] | null = null;
let byCode: Map<string, Airport> | null = null;

const SPECIAL_CHARS: Record<string, string> = {
  ø: "o", ł: "l", ß: "ss", đ: "d", Ø: "O", Ł: "L", Đ: "D",
};

function normalize(s: string): string {
  let out = s.toLowerCase();
  for (const [from, to] of Object.entries(SPECIAL_CHARS)) {
    out = out.replaceAll(from, to);
  }
  return out.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function ensureIndex(): Promise<IndexedAirport[]> {
  if (index) return index;
  const raw: RawAirport[] = (await import("./airports-data.json")).default;
  const map = new Map<string, Airport>();
  index = raw.map((a) => {
    const airport: Airport = {
      code: a.c,
      name: a.n,
      city: a.t,
      countryCode: a.cc,
      country: a.co,
      rank: a.r,
    };
    map.set(a.c, airport);
    const _code = a.c.toLowerCase();
    const _name = normalize(a.n);
    const _city = normalize(a.t);
    const _country = normalize(a.co);
    const _keywords = normalize(a.k ?? "");
    return {
      ...airport,
      _code,
      _name,
      _city,
      _country,
      _keywords,
      _all: `${_code} ${_name} ${_city} ${_country} ${_keywords}`,
    };
  });
  byCode = map;
  return index;
}

export async function searchAirports(
  query: string,
  opts: { limit?: number } = {},
): Promise<Airport[]> {
  const q = normalize(query.trim());
  if (q.length < 2) return [];
  const limit = opts.limit ?? 8;
  const idx = await ensureIndex();

  const words = q.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  type Scored = { airport: IndexedAirport; score: number };
  const results: Scored[] = [];

  for (const a of idx) {
    // Every word must appear somewhere
    if (!words.every((w) => a._all.includes(w))) continue;

    let score = 0;

    // Exact code match
    if (a._code === q) {
      score = 100;
    }
    // Code starts with query
    else if (a._code.startsWith(q)) {
      score = 90;
    }
    // City starts with first word
    else if (a._city.startsWith(words[0])) {
      score = 80;
    }
    // Name starts with first word
    else if (a._name.startsWith(words[0])) {
      score = 70;
    }
    // A word in city/name starts with a query word
    else if (
      wordStartsWith(a._city, words[0]) ||
      wordStartsWith(a._name, words[0])
    ) {
      score = 60;
    }
    // Keywords match
    else if (words.some((w) => a._keywords.includes(w))) {
      score = 50;
    }
    // Country match
    else if (a._country.includes(words[0])) {
      score = 40;
    }
    // Contains match
    else {
      score = 30;
    }

    // Rank bonus (large airports first)
    score += a.rank === 1 ? 5 : 0;

    results.push({ airport: a, score });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.airport.rank !== b.airport.rank) return a.airport.rank - b.airport.rank;
    return a.airport.city.localeCompare(b.airport.city);
  });

  return results.slice(0, limit).map(({ airport }) => ({
    code: airport.code,
    name: airport.name,
    city: airport.city,
    countryCode: airport.countryCode,
    country: airport.country,
    rank: airport.rank,
  }));
}

function wordStartsWith(text: string, prefix: string): boolean {
  if (text.startsWith(prefix)) return true;
  const words = text.split(/[\s\-,.'()/]+/);
  return words.some((w) => w.startsWith(prefix));
}

export async function airportByCode(
  code: string,
): Promise<Airport | undefined> {
  await ensureIndex();
  return byCode!.get(code.toUpperCase());
}
