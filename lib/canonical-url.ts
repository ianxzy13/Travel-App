/**
 * The address guests should see in links: the custom domain, not a *.vercel.app one.
 * NEXT_PUBLIC_SITE_URL wins when it is set to a real domain.
 */
const DEFAULT_DOMAIN = "https://travel-app-teal-omega.vercel.app";

export function canonicalSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (env && !/localhost/.test(env)) return env;
  return DEFAULT_DOMAIN;
}

/**
 * True on the live site when it was opened through a *.vercel.app address.
 * Preview deployments keep their own address so they can still be tested.
 */
export function isProductionVercelHost(host: string | null) {
  return process.env.VERCEL_ENV === "production" && !!host && host.endsWith(".vercel.app");
}
