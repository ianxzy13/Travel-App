import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SUPABASE_URL } from "./env";

/**
 * A Supabase client with the SECRET key. It bypasses Row Level Security, so
 * only use it on the server for jobs that have no signed-in user (webhooks,
 * emailing the couple about a reply). Returns null if the key isn't set;
 * those optional features then simply switch off.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
