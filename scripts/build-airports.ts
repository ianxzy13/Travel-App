/**
 * Downloads OurAirports data (public domain) and produces a compact JSON file
 * of airports with IATA codes and scheduled passenger service.
 *
 * Run: npm run airports
 * Re-run: maybe once a year to pick up new airports / closures.
 */
import { writeFileSync } from "fs";
import { resolve } from "path";

const AIRPORTS_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";
const COUNTRIES_URL =
  "https://davidmegginson.github.io/ourairports-data/countries.csv";

type RawRow = Record<string, string>;

function parseCSV(text: string): RawRow[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row: RawRow = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

type Airport = {
  /** IATA code */
  c: string;
  /** Airport name */
  n: string;
  /** City (municipality) */
  t: string;
  /** ISO country code */
  cc: string;
  /** Country name (English) */
  co: string;
  /** Keywords / alternate names */
  k: string;
  /** Importance: 1 = large, 2 = medium, 3 = small */
  r: number;
};

async function main() {
  console.log("Downloading airports.csv...");
  const [airportsText, countriesText] = await Promise.all([
    fetch(AIRPORTS_URL).then((r) => r.text()),
    fetch(COUNTRIES_URL).then((r) => r.text()),
  ]);

  console.log("Parsing...");
  const countries = parseCSV(countriesText);
  const countryMap = new Map<string, string>();
  for (const c of countries) {
    countryMap.set(c.code, c.name);
  }

  const airports = parseCSV(airportsText);
  const kept: Airport[] = [];
  const seenCodes = new Set<string>();

  for (const a of airports) {
    const iata = (a.iata_code ?? "").trim().toUpperCase();
    if (!iata || iata.length !== 3 || !/^[A-Z]{3}$/.test(iata)) continue;
    if (seenCodes.has(iata)) continue;

    const type = a.type ?? "";
    if (type !== "large_airport" && type !== "medium_airport") continue;

    const name = (a.name ?? "").trim();
    const city = (a.municipality ?? "").trim();
    const cc = (a.iso_country ?? "").trim();
    const co = countryMap.get(cc) ?? cc;
    const keywords = (a.keywords ?? "").trim();

    const rank = type === "large_airport" ? 1 : 2;

    seenCodes.add(iata);
    kept.push({
      c: iata,
      n: name,
      t: city,
      cc,
      co,
      k: keywords,
      r: rank,
    });
  }

  kept.sort((a, b) => a.r - b.r || a.c.localeCompare(b.c));

  const outPath = resolve(__dirname, "../lib/places/airports-data.json");
  const json = JSON.stringify(kept);
  writeFileSync(outPath, json, "utf-8");

  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(0);
  console.log(`Done! ${kept.length} airports, ${sizeKB} KB → ${outPath}`);
  console.log(
    `  Large: ${kept.filter((a) => a.r === 1).length}, Medium: ${kept.filter((a) => a.r === 2).length}, Small: ${kept.filter((a) => a.r === 3).length}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
