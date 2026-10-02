"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { finishLinkSignIn } from "@/app/login/actions";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Where sign-in links from the email land. The sign-in comes in the part of
 * the address after "#" (browsers never send it to the server), so this page
 * reads it and asks the server to save the session. Works in any browser,
 * including the one built into email apps.
 */
export default function ConfirmSignIn() {
  const t = useTranslations("ui");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const next = safeNextPath(query.get("next"));
    const failed = () =>
      window.location.replace(`/login?error=link&next=${encodeURIComponent(next)}`);

    // keep the tokens out of the address bar and the browser history
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (access_token && refresh_token) {
      finishLinkSignIn({ access_token, refresh_token })
        .then((res) => (res.ok ? window.location.replace(next) : failed()))
        .catch(failed);
      return;
    }
    // links in the older formats (?code= or ?token_hash=) are handled on the server
    if (query.get("code") || query.get("token_hash")) {
      window.location.replace(`/auth/callback${window.location.search}`);
      return;
    }
    failed();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <p role="status" className="text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t("loading")}
      </p>
    </main>
  );
}
