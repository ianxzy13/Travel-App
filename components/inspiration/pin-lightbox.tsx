"use client";

import { useEffect, useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Loader2,
  Palette,
  Send,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  addComment,
  addPaletteColors,
  deleteComment,
  deletePin,
  updatePin,
} from "@/app/app/inspiration/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { relative } from "@/lib/i18n/format";
import { extractPalette, textOn } from "@/lib/inspiration/layout";
import type { BoardView, PinView } from "@/lib/inspiration/load";
import { cn } from "@/lib/utils";
import { STATUS_KEY } from "./pin-card";
import { PinImage, sized } from "./pin-image";

type Option = { id: string; name: string };

const NONE = "none";

/** Reads the main colours of an image in the browser (small canvas, no upload). */
async function coloursOf(src: string) {
  const res = await fetch(sized(src, 200), { mode: "cors", referrerPolicy: "no-referrer" });
  if (!res.ok) throw new Error("load");
  const bitmap = await createImageBitmap(await res.blob());
  const w = 64;
  const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  return extractPalette(ctx.getImageData(0, 0, w, h).data, 5);
}

export function PinLightbox({
  pin,
  boards,
  categories,
  vendors,
  userId,
  canEdit,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  onHeart,
  onMove,
}: {
  pin: PinView | null;
  boards: BoardView[];
  categories: Option[];
  vendors: Option[];
  userId: string;
  canEdit: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onHeart: (pin: PinView) => void;
  onMove: (pin: PinView, boardId: string) => void;
}) {
  const t = useTranslations("inspiration.lightbox");
  const i = useTranslations("inspiration");
  // Arrow keys step through pins (but not while typing).
  useEffect(() => {
    if (!pin) return;
    function key(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target.closest("input, textarea, select, [role=combobox], [role=listbox]") ||
        target.isContentEditable
      )
        return;
      // in right-to-left languages the arrows point the other way
      const rtl = document.documentElement.dir === "rtl";
      if (e.key === (rtl ? "ArrowRight" : "ArrowLeft") && hasPrev) onPrev();
      if (e.key === (rtl ? "ArrowLeft" : "ArrowRight") && hasNext) onNext();
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [pin, hasPrev, hasNext, onPrev, onNext]);

  const label = pin?.title || i("untitledPin");
  return (
    <Dialog open={!!pin} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-0 sm:max-w-5xl">
        {pin && (
          <div className="grid md:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="bg-muted/60 relative flex min-h-60 items-center justify-center md:min-h-[70dvh]">
              <PinImage
                src={pin.src}
                alt={label}
                width={pin.width}
                height={pin.height}
                size={1400}
                fit="contain"
                className="max-h-[60dvh] bg-transparent md:max-h-[85dvh]"
              />
              <div className="absolute inset-x-2 top-1/2 flex -translate-y-1/2 justify-between">
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full shadow"
                  onClick={onPrev}
                  disabled={!hasPrev}
                  aria-label={t("prev")}
                >
                  <ChevronLeft className="rtl:rotate-180" aria-hidden />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full shadow"
                  onClick={onNext}
                  disabled={!hasNext}
                  aria-label={t("next")}
                >
                  <ChevronRight className="rtl:rotate-180" aria-hidden />
                </Button>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div className="pe-8">
                <DialogTitle className="font-serif text-2xl leading-tight">{label}</DialogTitle>
                <DialogDescription className="sr-only">{t("details")}</DialogDescription>
                {pin.creditName && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {i.rich("add.credit", {
                      name: pin.creditName,
                      photographer: (c) => (
                        <a
                          href={pin.creditUrl ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {c}
                        </a>
                      ),
                      unsplash: (c) => (
                        <a
                          href={pin.sourceUrl ?? undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {c}
                        </a>
                      ),
                    })}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={pin.hearts.includes(userId) ? "default" : "outline"}
                  size="sm"
                  onClick={() => onHeart(pin)}
                  aria-pressed={pin.hearts.includes(userId)}
                >
                  <Heart
                    className={cn(pin.hearts.includes(userId) && "fill-current")}
                    aria-hidden
                  />
                  {pin.hearts.length || ""} {pin.hearts.includes(userId) ? t("loved") : t("love")}
                </Button>
                {pin.sourceUrl && !pin.creditName && (
                  <Button asChild variant="outline" size="sm">
                    <a href={pin.sourceUrl} target="_blank" rel="noreferrer">
                      <ExternalLink aria-hidden /> {t("openSource")}
                    </a>
                  </Button>
                )}
                {pin.status && <Badge variant="secondary">{i(STATUS_KEY[pin.status])}</Badge>}
              </div>

              {canEdit ? (
                <PinForm key={pin.id} pin={pin} categories={categories} vendors={vendors} />
              ) : (
                <ReadOnlyDetails pin={pin} categories={categories} vendors={vendors} />
              )}

              <Colours key={`c-${pin.id}`} pin={pin} canEdit={canEdit} />

              {canEdit && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-40 flex-1 space-y-2">
                    <Label htmlFor="pin-board">{t("board")}</Label>
                    <Select value={pin.boardId} onValueChange={(b) => onMove(pin, b)}>
                      <SelectTrigger id="pin-board" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {boards.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <ConfirmDialog
                    trigger={
                      <Button variant="outline" size="icon" aria-label={t("delete")}>
                        <Trash2 aria-hidden />
                      </Button>
                    }
                    title={t("deleteTitle")}
                    description={t("deleteText")}
                    onConfirm={async () => {
                      const r = await deletePin(pin.id);
                      if (!r.ok) {
                        toast.error(r.error);
                        return false;
                      }
                      toast.success(t("deleted"));
                      onClose();
                    }}
                  />
                </div>
              )}

              <Separator />
              <Comments key={`m-${pin.id}`} pin={pin} userId={userId} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyDetails({
  pin,
  categories,
  vendors,
}: {
  pin: PinView;
  categories: Option[];
  vendors: Option[];
}) {
  const t = useTranslations("inspiration.lightbox");
  const category = categories.find((c) => c.id === pin.budgetCategoryId);
  const vendor = vendors.find((v) => v.id === pin.vendorId);
  return (
    <div className="space-y-2 text-sm">
      {pin.note && <p className="whitespace-pre-wrap">{pin.note}</p>}
      {pin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {pin.tags.map((t) => (
            <Badge key={t} variant="outline">
              #{t}
            </Badge>
          ))}
        </div>
      )}
      {category && <p className="text-muted-foreground">{t("budget", { name: category.name })}</p>}
      {vendor && <p className="text-muted-foreground">{t("vendor", { name: vendor.name })}</p>}
    </div>
  );
}

function PinForm({
  pin,
  categories,
  vendors,
}: {
  pin: PinView;
  categories: Option[];
  vendors: Option[];
}) {
  const t = useTranslations("inspiration.lightbox");
  const i = useTranslations("inspiration");
  const [title, setTitle] = useState(pin.title ?? "");
  const [note, setNote] = useState(pin.note ?? "");
  const [tags, setTags] = useState(pin.tags.join(", "));
  const [status, setStatus] = useState<string>(pin.status ?? NONE);
  const [sourceUrl, setSourceUrl] = useState(pin.sourceUrl ?? "");
  const [category, setCategory] = useState(pin.budgetCategoryId ?? NONE);
  const [vendor, setVendor] = useState(pin.vendorId ?? NONE);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const r = await updatePin(pin.id, {
        title,
        note,
        sourceUrl: sourceUrl.trim(),
        tags: tags.split(","),
        status: status === NONE ? null : status,
        budgetCategoryId: category === NONE ? null : category,
        vendorId: vendor === NONE ? null : vendor,
      });
      if (r.ok) toast.success(t("saved"));
      else toast.error(r.error);
    });
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <FormField id="pin-title" label={t("title")}>
        {(a) => (
          <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        )}
      </FormField>
      <FormField id="pin-note" label={t("notes")}>
        {(a) => (
          <Textarea
            {...a}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t("notesPlaceholder")}
          />
        )}
      </FormField>
      <FormField id="pin-tags" label={t("tags")} hint={t("tagsHint")}>
        {(a) => <Input {...a} value={tags} onChange={(e) => setTags(e.target.value)} />}
      </FormField>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="pin-status">{t("verdict")}</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger id="pin-status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("undecided")}</SelectItem>
              <SelectItem value="love">{i("loveIt")}</SelectItem>
              <SelectItem value="maybe">{i("maybe")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="pin-category">{t("category")}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="pin-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("none")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pin-vendor">{t("vendorLabel")}</Label>
        <Select value={vendor} onValueChange={setVendor}>
          <SelectTrigger id="pin-vendor" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("none")}</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <FormField id="pin-source" label={t("link")}>
        {(a) => (
          <Input
            {...a}
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://"
          />
        )}
      </FormField>
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} {t("saveChanges")}
      </Button>
    </form>
  );
}

function Colours({ pin, canEdit }: { pin: PinView; canEdit: boolean }) {
  const t = useTranslations("inspiration.lightbox");
  const [colours, setColours] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function find() {
    if (!pin.src) return;
    setBusy(true);
    try {
      const c = await coloursOf(pin.src);
      setColours(c);
      setPicked(c);
    } catch {
      toast.error(t("noColours"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{t("colours")}</h3>
        {!colours && (
          <Button variant="outline" size="sm" onClick={find} disabled={busy || !pin.src}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Palette aria-hidden />}{" "}
            {t("findColours")}
          </Button>
        )}
      </div>
      {colours && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("inImage")}>
            {colours.map((hex) => {
              const on = picked.includes(hex);
              return (
                <button
                  key={hex}
                  type="button"
                  disabled={!canEdit}
                  aria-pressed={canEdit ? on : undefined}
                  onClick={() => setPicked((p) => (on ? p.filter((x) => x !== hex) : [...p, hex]))}
                  className={cn(
                    "focus-visible:ring-ring flex h-12 w-14 items-end justify-center rounded-lg border pb-1 font-mono text-[0.6rem] transition focus-visible:ring-2 focus-visible:outline-none",
                    canEdit && !on && "opacity-40",
                    canEdit && on && "ring-foreground ring-2 ring-offset-1",
                  )}
                  style={{ background: hex, color: textOn(hex) }}
                  aria-label={hex}
                >
                  {hex}
                </button>
              );
            })}
          </div>
          {canEdit && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!picked.length || pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await addPaletteColors(picked, pin.id);
                  if (r.ok) toast.success(t("addedToPalette"));
                  else toast.error(r.error);
                })
              }
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {t("addToPalette", { count: picked.length })}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function Comments({ pin, userId }: { pin: PinView; userId: string }) {
  const t = useTranslations("inspiration.lightbox");
  const locale = useLocale();
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">{t("commentsTitle")}</h3>
      {pin.comments.length === 0 && (
        <p className="text-muted-foreground text-sm">{t("noComments")}</p>
      )}
      <ul className="space-y-3">
        {pin.comments.map((c) => (
          <li key={c.id} className="group text-sm">
            <p>
              <span className="font-medium">{c.name}</span>{" "}
              <span className="text-muted-foreground text-xs">
                {relative(c.createdAt, locale)}
              </span>
            </p>
            <p className="whitespace-pre-wrap">{c.body}</p>
            {c.userId === userId && (
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive text-xs underline-offset-2 hover:underline"
                onClick={() =>
                  startTransition(async () => {
                    const r = await deleteComment(c.id);
                    if (!r.ok) toast.error(r.error);
                  })
                }
              >
                {t("deleteComment")}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          startTransition(async () => {
            const r = await addComment(pin.id, body);
            if (r.ok) setBody("");
            else toast.error(r.error);
          });
        }}
      >
        <Label htmlFor="pin-comment" className="sr-only">
          {t("addComment")}
        </Label>
        <Textarea
          id="pin-comment"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          maxLength={2000}
          placeholder={t("commentPlaceholder")}
          className="min-h-9"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={pending || !body.trim()}
          aria-label={t("post")}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
        </Button>
      </form>
    </div>
  );
}
