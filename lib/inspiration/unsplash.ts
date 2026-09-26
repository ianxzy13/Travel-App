import "server-only";

// Unsplash API (free; needs UNSPLASH_ACCESS_KEY). Their guidelines require:
// - hotlinking the image URLs they return (no re-hosting),
// - crediting the photographer and Unsplash with links (+ utm parameters),
// - calling the photo's "download_location" when someone saves/uses it.

export const isUnsplashConfigured = Boolean(process.env.UNSPLASH_ACCESS_KEY);
const APP = "vow_wedding_planner";
const utm = (url: string) => `${url}${url.includes("?") ? "&" : "?"}utm_source=${APP}&utm_medium=referral`;
export const UNSPLASH_HOME = utm("https://unsplash.com/");

export type UnsplashPhoto = {
  id: string;
  thumb: string;
  full: string;
  width: number;
  height: number;
  alt: string | null;
  color: string | null;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
};

type ApiPhoto = {
  id: string;
  width: number;
  height: number;
  color: string | null;
  alt_description: string | null;
  urls: { small: string; regular: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
};

function toPhoto(p: ApiPhoto): UnsplashPhoto {
  return {
    id: p.id,
    thumb: p.urls.small,
    full: p.urls.regular,
    width: p.width,
    height: p.height,
    alt: p.alt_description,
    color: p.color,
    photographer: p.user.name,
    photographerUrl: utm(p.user.links.html),
    pageUrl: utm(p.links.html),
  };
}

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.unsplash.com${path}`, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`, "Accept-Version": "v1" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 }, // cache searches for an hour (the free tier allows 50 requests/hour)
  });
  if (res.status === 403 || res.status === 429) throw new Error("Unsplash's hourly limit was reached. Try again later.");
  if (!res.ok) throw new Error("Unsplash isn't responding right now.");
  return res.json() as Promise<T>;
}

/** Wedding photo search; "wedding" is always added to the query. */
export async function searchPhotos(query: string, page: number) {
  const q = `wedding ${query}`.trim().slice(0, 100);
  const data = await api<{ results: ApiPhoto[]; total_pages: number }>(
    `/search/photos?query=${encodeURIComponent(q)}&page=${page}&per_page=24&content_filter=high`,
  );
  return { photos: data.results.map(toPhoto), hasMore: page < data.total_pages };
}

/** One photo by id, and tell Unsplash it was used (required by their API terms). */
export async function getPhotoForSaving(id: string) {
  const p = await api<ApiPhoto>(`/photos/${encodeURIComponent(id)}`);
  await fetch(p.links.download_location, {
    headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` },
  }).catch(() => {});
  return toPhoto(p);
}
