"use client";

import { useState, useTransition } from "react";
import {
  BedDouble,
  Check,
  ExternalLink,
  Heart,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Star,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addHotelFromLink,
  saveShortlistDetails,
  setHotelShortlisted,
} from "@/app/app/hotels/shortlist-actions";
import { MoneyInput } from "@/components/budget/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/budget/money";
import { cn } from "@/lib/utils";
import type { HotelItem } from "./hotels-page";

/**
 * Hotels the couple is comparing (in the app only): paste a link to add one,
 * then compare photos, prices for the stay, stars and review scores.
 */
export function HotelShortlist({
  hotels,
  currency,
  canEdit,
  onOpen,
}: {
  hotels: HotelItem[];
  currency: string;
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("hotelShortlist");
  const [nights, setNights] = useState(3);
  const list = hotels.filter((h) => h.shortlisted);
  const priced = list.filter((h) => h.price_per_night != null);
  const cheapest =
    priced.length > 1
      ? priced.reduce((a, b) => (b.price_per_night! < a.price_per_night! ? b : a)).id
      : null;
  const rated = list.filter((h) => h.review_score != null);
  const bestRated =
    rated.length > 1
      ? rated.reduce((a, b) => (b.review_score! > a.review_score! ? b : a)).id
      : null;

  return (
    <section className="space-y-4" aria-labelledby="shortlist-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="shortlist-title" className="text-3xl">
            {t("title")}
          </h2>
          <p className="text-muted-foreground text-sm">{t("intro")}</p>
        </div>
        {list.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="sl-nights" className="text-sm">
              {t("nights")}
            </Label>
            <Input
              id="sl-nights"
              type="number"
              min={1}
              max={30}
              value={nights}
              onChange={(e) => setNights(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20"
            />
          </div>
        )}
      </div>

      {canEdit && <QuickAdd currency={currency} />}

      {list.length === 0 ? (
        <p className="text-muted-foreground bg-card rounded-xl border border-dashed p-6 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4">
          {list.map((h) => (
            <ShortlistCard
              key={`${h.id}-${h.updated_at}`}
              hotel={h}
              nights={nights}
              currency={currency}
              canEdit={canEdit}
              cheapest={h.id === cheapest}
              bestRated={h.id === bestRated}
              onOpen={() => onOpen(h.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function QuickAdd({ currency }: { currency: string }) {
  const t = useTranslations("hotelShortlist");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="bg-card space-y-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await addHotelFromLink(url, price);
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          if (r.data.fetched) toast.success(t("added", { name: r.data.name }));
          else toast.warning(t("fetchFailed"));
          setUrl("");
          setPrice(null);
        });
      }}
    >
      <div>
        <p className="flex items-center gap-2 font-medium">
          <Link2 className="size-4" aria-hidden /> {t("quickAdd")}
        </p>
        <p className="text-muted-foreground text-xs">{t("quickAddHint")}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
        <Input
          type="url"
          inputMode="url"
          aria-label={t("quickAdd")}
          placeholder={t("linkPlaceholder")}
          value={url}
          maxLength={500}
          dir="ltr"
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <MoneyInput
          aria-label={t("price")}
          placeholder={t("price")}
          currency={currency}
          allowEmpty
          value={price}
          onChange={setPrice}
        />
        <Button type="submit" disabled={pending || !url.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          {t("add")}
        </Button>
      </div>
    </form>
  );
}

function ShortlistCard({
  hotel: h,
  nights,
  currency,
  canEdit,
  cheapest,
  bestRated,
  onOpen,
}: {
  hotel: HotelItem;
  nights: number;
  currency: string;
  canEdit: boolean;
  cheapest: boolean;
  bestRated: boolean;
  onOpen: () => void;
}) {
  const t = useTranslations("hotelShortlist");
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState(h.price_per_night);
  const [stars, setStars] = useState(h.stars?.toString() ?? "");
  const [score, setScore] = useState(h.review_score?.toString() ?? "");
  const [image, setImage] = useState(h.image_url ?? "");
  const [pending, startTransition] = useTransition();
  const link = h.booking_url ?? h.website;

  const save = () =>
    startTransition(async () => {
      const r = await saveShortlistDetails(h.id, {
        pricePerNight: price,
        stars: stars ? Number(stars) : null,
        reviewScore: score ? Number(score.replace(",", ".")) : null,
        imageUrl: image.trim(),
      });
      if (!r.ok) toast.error(r.error);
      else setEditing(false);
    });

  const remove = () =>
    startTransition(async () => {
      const r = await setHotelShortlisted(h.id, false);
      if (!r.ok) toast.error(r.error);
      else toast.success(t("removed"));
    });

  return (
    <li className="bg-card flex flex-col overflow-hidden rounded-xl border">
      <div className="bg-muted relative aspect-[4/3]">
        {h.image_url ? (
          // photos come from any hotel site, so a plain <img> (no image optimiser)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={h.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <BedDouble
            className="text-muted-foreground absolute inset-0 m-auto size-10"
            aria-hidden
          />
        )}
        <div className="absolute start-2 top-2 flex flex-wrap gap-1">
          {cheapest && (
            <span className="bg-success rounded-full px-2 py-0.5 text-xs font-medium text-white">
              {t("cheapest")}
            </span>
          )}
          {bestRated && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-medium">
              {t("bestRated")}
            </span>
          )}
        </div>
        {canEdit && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute end-2 top-2 rounded-full"
            aria-label={t("unsave")}
            title={t("unsave")}
            disabled={pending}
            onClick={remove}
          >
            <Heart className="fill-current text-rose-600" aria-hidden />
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-serif text-xl leading-tight font-medium">{h.name}</p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {h.stars != null && (
            <span
              className="inline-flex items-center gap-0.5"
              title={t("stars", { count: h.stars })}
            >
              {Array.from({ length: h.stars }, (_, i) => (
                <Star key={i} className="size-3.5 fill-current text-amber-500" aria-hidden />
              ))}
              <span className="sr-only">{t("stars", { count: h.stars })}</span>
            </span>
          )}
          {h.review_score != null && (
            <span className="bg-muted text-foreground rounded px-1.5 py-0.5 text-xs font-medium">
              {t("score", { score: h.review_score })}
            </span>
          )}
          {h.distance && <span>{h.distance}</span>}
        </div>
        {h.address && <p className="text-muted-foreground text-xs">{h.address}</p>}

        {editing ? (
          <div className="space-y-2 border-t pt-3">
            <div className="space-y-1">
              <Label htmlFor={`p-${h.id}`} className="text-xs">
                {t("price")}
              </Label>
              <MoneyInput
                id={`p-${h.id}`}
                currency={currency}
                allowEmpty
                value={price}
                onChange={setPrice}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`s-${h.id}`} className="text-xs">
                  {t("starsLabel")}
                </Label>
                <Input
                  id={`s-${h.id}`}
                  type="number"
                  min={1}
                  max={5}
                  value={stars}
                  onChange={(e) => setStars(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`r-${h.id}`} className="text-xs">
                  {t("scoreLabel")}
                </Label>
                <Input
                  id={`r-${h.id}`}
                  inputMode="decimal"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`i-${h.id}`} className="text-xs">
                {t("photoLabel")}
              </Label>
              <Input
                id={`i-${h.id}`}
                type="url"
                dir="ltr"
                value={image}
                onChange={(e) => setImage(e.target.value)}
              />
            </div>
            <Button size="sm" className="w-full" onClick={save} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />}
              {t("saveDetails")}
            </Button>
          </div>
        ) : (
          <div className="mt-auto pt-2">
            {h.price_per_night != null ? (
              <>
                <p className="text-lg font-medium tabular-nums">
                  {formatMoney(h.price_per_night, currency)}{" "}
                  <span className="text-muted-foreground text-sm font-normal">{t("perNight")}</span>
                </p>
                <p className="text-muted-foreground text-sm tabular-nums">
                  {t("total", { nights, price: formatMoney(h.price_per_night * nights, currency) })}
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{t("noPrice")}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-t p-2">
        {link && (
          <Button asChild variant="ghost" size="sm">
            <a href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden /> {t("open")}
            </a>
          </Button>
        )}
        {canEdit && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden /> {t("edit")}
          </Button>
        )}
        <Button variant="ghost" size="sm" className={cn("ms-auto")} onClick={onOpen}>
          {t("details")}
        </Button>
      </div>
    </li>
  );
}

/** Heart button for a hotel card: puts it on (or takes it off) the shortlist. */
export function ShortlistHeart({ hotel }: { hotel: HotelItem }) {
  const t = useTranslations("hotelShortlist");
  const [pending, startTransition] = useTransition();
  const on = hotel.shortlisted;
  return (
    <Button
      variant="ghost"
      size="icon"
      className="absolute end-2 top-2 rounded-full"
      aria-label={on ? t("unsave") : t("save")}
      aria-pressed={on}
      title={on ? t("unsave") : t("save")}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await setHotelShortlisted(hotel.id, !on);
          if (!r.ok) toast.error(r.error);
        })
      }
    >
      <Heart className={cn(on && "fill-current text-rose-600")} aria-hidden />
    </Button>
  );
}
