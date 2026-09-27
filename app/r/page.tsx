import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CodeForm } from "@/components/rsvp/code-form";
import { RsvpFrame } from "@/components/rsvp/rsvp-frame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rsvp");
  return { title: t("title"), robots: { index: false } };
}

/** /r — type the code from your invitation. */
export default async function RsvpCodePage() {
  const t = await getTranslations("rsvp");
  return (
    <RsvpFrame>
      <div className="bg-card mx-auto mt-10 max-w-md rounded-2xl border p-8 shadow-sm">
        <h1 className="text-center text-4xl">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 mb-6 text-center">{t("enterCode")}</p>
        <CodeForm />
      </div>
    </RsvpFrame>
  );
}
