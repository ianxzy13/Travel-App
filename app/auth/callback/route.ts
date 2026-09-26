import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

/**
 * Where magic links and Google send the user back to.
 * Supports both `?code=` (PKCE flow, the default) and `?token_hash=&type=`
 * (if you customise Supabase's email template).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback] code exchange failed", error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error("[auth/callback] OTP verification failed", error);
  }

  return NextResponse.redirect(
    new URL(`/login?error=link&next=${encodeURIComponent(next)}`, origin),
  );
}
