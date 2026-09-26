import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { ImportWizard } from "@/components/guests/import-wizard";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";

export const metadata: Metadata = { title: "Import guests" };

export default async function ImportGuestsPage() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) redirect("/app/guests");

  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("name")
    .eq("wedding_id", wedding.id)
    .order("sort_order");

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/app/guests">
          <ArrowLeft aria-hidden /> Back to guests
        </Link>
      </Button>
      <PageHeader
        title="Import guests"
        description="Bring in the spreadsheet you've already started. Nothing is saved until the last step."
      />
      <ImportWizard
        names={{ a: wedding.partner_a_name, b: wedding.partner_b_name }}
        eventNames={(events ?? []).map((e) => e.name)}
      />
    </>
  );
}
