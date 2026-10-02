import type { NextRequest } from "next/server";
import { GUEST_LOCALE_COOKIE, isLocale } from "@/i18n/locales";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Tell the pages which path is being shown and which language was asked for (?lang=de),
  // so i18n/request.ts can pick the language.
  const asked = request.nextUrl.searchParams.get("lang");
  const extra: Record<string, string> = { "x-vow-path": request.nextUrl.pathname };
  if (isLocale(asked)) extra["x-vow-lang"] = asked;

  const response = await updateSession(request, extra);
  // A guest who picks a language keeps it on the other public pages.
  if (isLocale(asked)) {
    response.cookies.set(GUEST_LOCALE_COOKIE, asked, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  // Skip static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
