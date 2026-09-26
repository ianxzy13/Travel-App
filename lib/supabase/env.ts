// Public Supabase settings (safe to expose to the browser: access is protected by RLS).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until .env.local (or Vercel env vars) are filled in. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
