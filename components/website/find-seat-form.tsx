"use client";

import { useState, useTransition } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { findSeat, type SeatResult } from "@/app/w/[slug]/seat/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function FindSeatForm({ slug }: { slug: string }) {
  const t = useTranslations("site.findSeat");
  const [name, setName] = useState("");
  const [result, setResult] = useState<SeatResult | null | "not-found">(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      const r = await findSeat(slug, name.trim());
      if (r.ok) setResult(r.data ?? "not-found");
    });
  }

  function tableName(r: SeatResult) {
    if (r.tableLabel && r.tableNumber) return t("tableNamed", { label: r.tableLabel, number: r.tableNumber });
    if (r.tableLabel) return r.tableLabel;
    return t("tableName", { number: r.tableNumber ?? 1 });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">{t("label")}</label>
        <Input
          type="text"
          placeholder={t("placeholder")}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setResult(null);
          }}
          autoFocus
          autoComplete="name"
        />
        <Button type="submit" className="w-full" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("button")}
        </Button>
      </form>

      {result === "not-found" && (
        <p className="text-muted-foreground text-center text-sm">{t("notFound")}</p>
      )}

      {result && result !== "not-found" && (
        <div className="bg-accent/50 flex flex-col items-center gap-3 rounded-xl p-6 text-center">
          <MapPin className="text-primary size-8" aria-hidden />
          <p className="text-lg font-medium">{result.guestName}</p>
          <p className="text-3xl font-bold">{tableName(result)}</p>
          <p className="text-muted-foreground text-sm">{t("yourTable")}</p>
        </div>
      )}
    </div>
  );
}
