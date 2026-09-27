import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/*
 * Fetching a web page that a user pasted is risky: someone could paste
 * "http://169.254.169.254/…" to make OUR server read internal addresses
 * ("SSRF"). So we only fetch public http(s) addresses, re-check every
 * redirect, and limit time and size.
 */

/** True for private, loopback, link-local and other non-public IP addresses. */
export function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local (cloud metadata)
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast / reserved
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7)); // IPv4-mapped
  return (
    v6 === "::" ||
    v6 === "::1" ||
    v6.startsWith("fc") ||
    v6.startsWith("fd") || // unique local
    v6.startsWith("fe8") ||
    v6.startsWith("fe9") ||
    v6.startsWith("fea") ||
    v6.startsWith("feb") || // link-local
    v6.startsWith("ff") // multicast
  );
}

async function assertPublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error("Only http and https links work.");
  if (url.username || url.password) throw new Error("Links with passwords aren't supported.");
  if (url.port && !["80", "443"].includes(url.port))
    throw new Error("That link uses an unusual port.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateIp))
    throw new Error("That address can't be reached.");
  return url;
}

const MAX_BYTES = 1_500_000;

/** GET a public URL safely: manual redirects (max 3), 8 s timeout, size limit. */
async function safeFetch(raw: string) {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; VowBot/1.0; +link preview)",
        accept: "text/html,image/*;q=0.9,*/*;q=0.5",
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok) throw new Error(`The site answered with an error (${res.status}).`);
    return { res, url };
  }
  throw new Error("Too many redirects.");
}

async function readText(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.length;
  }
  await reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

/** Reads og:image / twitter:image / <title> from page HTML (pure; unit-tested). */
export function parseOpenGraph(html: string, base: string) {
  const head = html.slice(0, 200_000);
  const meta = (names: string[]) => {
    for (const name of names) {
      const re = new RegExp(
        `<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${name}["']`,
        "i",
      );
      const m = head.match(re);
      if (m) return decode(m[1] ?? m[2]);
    }
    return null;
  };
  const rawImage = meta([
    "og:image:secure_url",
    "og:image",
    "og:image:url",
    "twitter:image",
    "twitter:image:src",
  ]);
  let image: string | null = null;
  if (rawImage) {
    try {
      image = new URL(rawImage, base).toString();
    } catch {
      image = null;
    }
  }
  const title =
    meta(["og:title", "twitter:title"]) ??
    head.match(/<title[^>]*>([^<]{1,300})<\/title>/i)?.[1] ??
    null;
  return { image, title: title ? decode(title).slice(0, 200) : null };
}

export type LinkPreview = { imageUrl: string; title: string | null; sourceUrl: string | null };

/** Image link → itself; page link → its preview image and title. */
export async function getLinkPreview(raw: string): Promise<LinkPreview> {
  const { res, url } = await safeFetch(raw.trim());
  const type = res.headers.get("content-type") ?? "";
  if (type.startsWith("image/")) {
    await res.body?.cancel().catch(() => {});
    return { imageUrl: url.toString(), title: null, sourceUrl: null };
  }
  if (!type.includes("html")) throw new Error("That link isn't an image or a web page.");
  const { image, title } = parseOpenGraph(await readText(res), url.toString());
  if (!image)
    throw new Error(
      "We couldn't find an image on that page. Try right-clicking the image and copying its address.",
    );
  return { imageUrl: image, title, sourceUrl: url.toString() };
}
