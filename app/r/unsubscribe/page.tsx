import { createAdminClient } from "@/lib/supabase/admin";
import { LegalPage } from "@/components/legal/legal-page";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage(props: {
  searchParams: Promise<{ code?: string; guest?: string }>;
}) {
  const { code, guest } = await props.searchParams;

  if (!code || !guest) {
    return <LegalPage content="# Unsubscribe\n\nInvalid unsubscribe link." />;
  }

  const admin = createAdminClient();
  if (!admin) {
    return <LegalPage content="# Unsubscribe\n\nSomething went wrong. Please try again later." />;
  }

  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const { data: household } = await admin
    .from("households")
    .select("id")
    .eq("rsvp_code", clean)
    .single();

  if (!household) {
    return <LegalPage content="# Unsubscribe\n\nInvalid unsubscribe link." />;
  }

  const { error } = await admin
    .from("guests")
    .update({ email_unsubscribed: true })
    .eq("id", guest)
    .eq("household_id", household.id);

  if (error) {
    return <LegalPage content="# Unsubscribe\n\nSomething went wrong. Please try again later." />;
  }

  return (
    <LegalPage
      content={
        "# Unsubscribed\n\nYou've been unsubscribed from future emails about this wedding.\n\nYou can still access your RSVP using your original link."
      }
    />
  );
}
