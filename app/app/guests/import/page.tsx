import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/app/page-header";
import { ImportWizard } from "@/components/guests/import-wizard";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("guests.import"))("title") };
}

export default async function ImportGuestsPage() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) redirect("/app/guests");

  const supabase = await createClient();
  const t = await getTranslations("guests.import");
  const { data: events } = await supabase
    .from("events")
    .select("name")
    .eq("wedding_id", wedding.id)
    .order("sort_order");

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ms-2 mb-4">
        <Link href="/app/guests">
          <ArrowLeft className="rtl:rotate-180" aria-hidden /> {t("back")}
        </Link>
      </Button>
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <ImportWizard
        names={{ a: wedding.partner_a_name, b: wedding.partner_b_name }}
        eventNames={(events ?? []).map((e) => e.name)}
      />
    </>
  );
}
