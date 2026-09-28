"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { unlockSite } from "@/app/w/[slug]/actions";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { SiteData } from "@/lib/website/content";
import { siteVars } from "@/lib/website/templates";

/** Shown instead of the site when it has a password and the visitor hasn't entered it yet. */
export function PasswordGate({
  slug,
  couple,
  look,
  languages,
}: {
  slug: string;
  couple: string;
  look: SiteData["look"];
  languages: string[];
}) {
  const t = useTranslations("site.password");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div
      style={siteVars(look)}
      className="flex min-h-dvh items-center justify-center bg-[var(--site-bg)] px-5 font-[family-name:var(--site-body)] text-[var(--site-fg)] [color-scheme:light]"
    >
      <LanguageSwitcher offered={languages} className="absolute end-4 top-4" />
      <main className="w-full max-w-sm text-center">
        <Lock className="mx-auto size-6 text-[var(--site-accent)]" aria-hidden />
        <h1 className="mt-4 font-[family-name:var(--site-heading)] text-4xl">{couple}</h1>
        <p className="mt-2 text-[var(--site-muted)]">{t("intro")}</p>
        <form
          className="mt-8 space-y-3 text-start"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const r = await unlockSite(slug, password);
              if (r.ok) router.refresh();
              else setError(r.error);
            });
          }}
        >
          <label htmlFor="site-password" className="text-sm font-medium">
            {t("label")}
          </label>
          <input
            id="site-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "site-password-error" : undefined}
            className="h-11 w-full rounded-md border border-[var(--site-line)] bg-white px-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--site-accent)]"
            required
          />
          {error && (
            <p id="site-password-error" role="alert" className="text-sm text-[#a94f45]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--site-accent)] font-medium text-[var(--site-on-accent)] disabled:opacity-70"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("enter")}
          </button>
        </form>
      </main>
    </div>
  );
}
