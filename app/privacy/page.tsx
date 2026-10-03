import type { Metadata } from "next";
import { readFile } from "fs/promises";
import { join } from "path";
import { getLocale } from "next-intl/server";
import { LegalPage } from "@/components/legal/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function Privacy() {
  const locale = await getLocale();
  const lang = locale === "sl" ? "sl" : "en";
  const md = await readFile(join(process.cwd(), `content/privacy-${lang}.md`), "utf-8");
  return <LegalPage content={md} />;
}
