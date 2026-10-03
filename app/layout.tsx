import type { Metadata, Viewport } from "next";
import { EB_Garamond, Jost } from "next/font/google";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { isRtl } from "@/i18n/locales";
import { GUEST_NAMESPACES } from "@/i18n/messages";
import { isGuestPath } from "@/i18n/request";
import { greatVibes } from "@/lib/website/fonts";
import "./globals.css";

// Fonts of the theme (see app/theme.css): body, headings and the script accent.
const jost = Jost({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-jost",
  display: "swap",
});
// EB Garamond rather than Cormorant Garamond: Cormorant's accents (š, č, ê…)
// float away from their letters in Chrome and Edge.
const garamond = EB_Garamond({
  subsets: ["latin", "latin-ext", "cyrillic", "greek", "vietnamese"],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Vow", template: "%s · Vow" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1f1a17" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  // guests' pages only need their own texts in the browser
  const guest = isGuestPath((await headers()).get("x-vow-path") ?? "");
  const clientMessages = guest
    ? Object.fromEntries(GUEST_NAMESPACES.map((ns) => [ns, messages[ns]]))
    : messages;
  return (
    // suppressHydrationWarning: next-themes sets the class before React loads
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={`${jost.variable} ${garamond.variable} ${greatVibes.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={clientMessages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
