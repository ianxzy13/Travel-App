import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Translations: i18n/request.ts picks the language, messages/*.json hold the texts.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Hide the floating "N" dev badge (it covers the mobile tab bar). Errors still show.
  devIndicators: false,
  experimental: {
    // CSV imports send up to 2000 guests in one request (default limit is 1 MB).
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    // Supabase Storage (added in later phases) and Google profile photos
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default withNextIntl(nextConfig);
