import "server-only";
import { headers } from "next/headers";
import { canonicalSiteUrl, isProductionVercelHost } from "./canonical-url";

/**
 * The public address of the app (e.g. https://www.vowanywhere.com), used to build
 * sign-in, invite and Save the Date links. Uses the current request's host so preview
 * deployments work too, but the live site always uses the custom domain.
 */
export async function getSiteUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (isProductionVercelHost(host)) return canonicalSiteUrl();
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// usable in the browser too, so it lives in its own file
export { safeNextPath } from "./safe-next";
