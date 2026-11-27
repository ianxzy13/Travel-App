import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { RsvpHome } from "./link";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Do this wedding's RSVP links open the couple's website? (published, no password) */
export async function rsvpHome(
  sb: Supabase,
  wedding: { id: string; slug: string },
): Promise<RsvpHome> {
  const [{ data: settings }, { data: hasPassword }] = await Promise.all([
    sb.from("website_settings").select("published").eq("wedding_id", wedding.id).maybeSingle(),
    sb.rpc("site_has_password", { p_wedding_id: wedding.id }),
  ]);
  return { slug: wedding.slug, website: Boolean(settings?.published) && !hasPassword };
}
