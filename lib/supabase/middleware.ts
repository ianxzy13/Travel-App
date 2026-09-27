import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { isSupabaseConfigured, SUPABASE_KEY, SUPABASE_URL } from "./env";

// Pages that require being signed in.
const PROTECTED_PREFIXES = ["/app", "/onboarding", "/invite", "/print"];

/**
 * Runs on every request: refreshes the Supabase session cookie and sends
 * signed-out visitors of protected pages to /login.
 */
export async function updateSession(
  request: NextRequest,
  extraHeaders: Record<string, string> = {},
) {
  // Forward the request (with any refreshed cookies) plus extra headers to the page.
  const next = () => {
    const forwarded = new Headers(request.headers);
    for (const [k, v] of Object.entries(extraHeaders)) forwarded.set(k, v);
    return NextResponse.next({ request: { headers: forwarded } });
  };
  let response = next();
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Important: getUser() validates the token with Supabase and refreshes it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
