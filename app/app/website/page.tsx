import type { Metadata } from "next";
import { WebsiteEditor } from "@/components/website/editor/website-editor";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";
import { siteFontVariables } from "@/lib/website/fonts";
import { loadEditor } from "@/lib/website/load";

export const metadata: Metadata = { title: "Wedding website" };

export default async function WebsitePage() {
  const { wedding, role } = await requireWedding();
  const data = await loadEditor(await createClient(), wedding);
  if (!data) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed p-8 text-center">
        The website tables aren&apos;t set up yet. Run the phase 8 migration (see README), then reload this page.
      </p>
    );
  }
  return <WebsiteEditor {...data} weddingId={wedding.id} canEdit={canEdit(role)} fontClass={siteFontVariables} />;
}
