"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { findInvitation } from "@/app/r/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * "Find your invitation" by full name, for one wedding. Opens the RSVP page,
 * or the website's flight form when next="flights".
 */
export function FindInvitation({
  slug,
  next = "rsvp",
}: {
  slug: string;
  next?: "rsvp" | "flights";
}) {
  const t = useTranslations("rsvp.find");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await findInvitation(slug, name);
          if (result.ok)
            router.push(
              next === "flights"
                ? `/w/${slug}/flights?code=${result.data.code}`
                : `/r/${result.data.code}`,
            );
          else setError(result.error);
        });
      }}
    >
      <Label htmlFor="full-name">{t("label")}</Label>
      <div className="flex gap-2">
        <Input
          id="full-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("placeholder")}
          autoComplete="name"
          maxLength={160}
          aria-invalid={!!error}
          aria-describedby={error ? "find-err" : undefined}
        />
        <Button type="submit" disabled={pending || name.trim().length < 3}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
          {t("button")}
        </Button>
      </div>
      {error && (
        <p id="find-err" role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
