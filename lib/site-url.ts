import "server-only";
import { headers } from "next/headers";

/**
 * The public address of the app (e.g. https://vow.vercel.app), used to build
 * sign-in and invite links. Uses the current request's host so preview
 * deployments work too, falling back to NEXT_PUBLIC_SITE_URL.
 */
export async function getSiteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Only allow redirects to paths on our own site (blocks `//evil.com`). */
export function safeNextPath(next: string | null | undefined, fallback = "/app") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
