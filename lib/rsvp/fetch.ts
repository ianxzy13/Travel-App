import "server-only";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { CODE_PATTERN, normalizeCode, type RsvpData } from "./types";

/** One household's RSVP via the secure get_rsvp() function (null if the code is wrong), once per request. */
export const fetchRsvp = cache(async (rawCode: string): Promise<RsvpData | null> => {
  const code = normalizeCode(decodeURIComponent(rawCode));
  if (!CODE_PATTERN.test(code) || !isSupabaseConfigured) return null;
  const { data, error } = await (await createClient()).rpc("get_rsvp", { p_code: code });
  if (error) console.error("[get_rsvp]", error);
  return (data as RsvpData | null) ?? null;
});
