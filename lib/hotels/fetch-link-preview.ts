import "server-only";
import { lookup } from "node:dns/promises";
import { isPublicAddress, nameFromUrl, parseHotelPage, type HotelPreview } from "./link-preview";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 7000;

async function assertPublicHost(url: URL) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("protocol");
  if (url.username || url.password) throw new Error("credentials");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("port");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || !addresses.every((a) => isPublicAddress(a.address))) {
    throw new Error("private address");
  }
}

/**
 * Fetches a hotel page and reads what it can. Never throws: when the page
 * can't be read (blocked, too slow, not HTML) it returns a name made from the
 * link and fetched=false.
 */
export async function fetchHotelPreview(
  rawUrl: string,
): Promise<{ preview: HotelPreview; fetched: boolean }> {
  const fallback = {
    preview: {
      name: nameFromUrl(rawUrl),
      imageUrl: null,
      address: null,
      stars: null,
      reviewScore: null,
      pricePerNight: null,
    },
    fetched: false,
  };
  try {
    let url = new URL(rawUrl);
    let res: Response | null = null;
    // follow up to 3 redirects by hand, checking every hop
    for (let hop = 0; hop < 4; hop++) {
      await assertPublicHost(url);
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; VowWeddingPlanner/1.0; link preview)",
          accept: "text/html,application/xhtml+xml",
          "accept-language": "en",
        },
      });
      const next = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && next) {
        url = new URL(next, url);
        continue;
      }
      break;
    }
    if (!res || !res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
      return fallback;
    }

    // read at most MAX_BYTES
    const reader = res.body?.getReader();
    if (!reader) return fallback;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    const html = new TextDecoder().decode(Buffer.concat(chunks));
    return { preview: parseHotelPage(html, rawUrl), fetched: true };
  } catch (e) {
    console.warn("[fetchHotelPreview]", rawUrl, e instanceof Error ? e.message : e);
    return fallback;
  }
}
