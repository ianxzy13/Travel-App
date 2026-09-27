import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WebsiteEditor } from "@/components/website/editor/website-editor";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";
import { siteFontVariables } from "@/lib/website/fonts";
import { loadEditor } from "@/lib/website/load";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("app.nav"))("website") };
}

export default async function WebsitePage() {
  const { wedding, role } = await requireWedding();
  const data = await loadEditor(await createClient(), wedding);
  if (!data) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        {(await getTranslations("websiteEditor"))("notSetUp")}
      </p>
    );
  }
  return (
    <WebsiteEditor
      {...data}
      weddingId={wedding.id}
      canEdit={canEdit(role)}
      fontClass={siteFontVariables}
    />
  );
}
