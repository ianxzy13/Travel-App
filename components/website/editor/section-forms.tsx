"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { safeUrl, type Section, type SectionContent } from "@/lib/website/content";
import { IMAGE_TYPES, ImageSlot, uploadSiteImage, useImageErrors } from "./image-slot";

type Images = Record<string, string>;
type Common = {
  weddingId: string;
  images: Images;
  addImage: (path: string, url: string) => void;
  disabled: boolean;
};

const newId = () => crypto.randomUUID();

/** The form for one section; `onChange` receives the section's new content. */
export function SectionForm({
  section,
  onChange,
  eventCount,
  hotelCount,
  ...common
}: Common & {
  section: Section;
  onChange: (content: Section["content"]) => void;
  eventCount: number;
  hotelCount: number;
}) {
  const t = useTranslations("websiteEditor.forms");
  const link = (href: string) => {
    const L = (c: React.ReactNode) => (
      <Link href={href} className="underline underline-offset-2">
        {c}
      </Link>
    );
    return L;
  };
  const id = section.kind;
  switch (section.kind) {
    case "home": {
      const c = section.content;
      return (
        <div className="space-y-3">
          <FormField id={`${id}-tagline`} label={t("tagline")} hint={t("taglineHint")}>
            {(a) => (
              <Input
                {...a}
                value={c.tagline}
                maxLength={120}
                disabled={common.disabled}
                onChange={(e) => onChange({ ...c, tagline: e.target.value })}
              />
            )}
          </FormField>
          <p className="text-muted-foreground text-sm">
            {t.rich("homeNote", { link: link("/app/settings") })}
          </p>
        </div>
      );
    }
    case "story": {
      const c = section.content;
      return (
        <div className="space-y-4">
          <FormField id={`${id}-intro`} label={t("began")}>
            {(a) => (
              <Textarea
                {...a}
                rows={4}
                value={c.intro}
                maxLength={3000}
                disabled={common.disabled}
                placeholder={t("beganPlaceholder")}
                onChange={(e) => onChange({ ...c, intro: e.target.value })}
              />
            )}
          </FormField>
          <ListEditor
            label={t("milestones")}
            addLabel={t("addMilestone")}
            items={c.milestones}
            disabled={common.disabled}
            onChange={(milestones) => onChange({ ...c, milestones })}
            create={() => ({ id: newId(), date: "", title: "", text: "", photo: null })}
            max={30}
            render={(m, set) => (
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-2">
                  <div className="grid grid-cols-[7rem_1fr] gap-2">
                    <Input
                      aria-label={t("when")}
                      placeholder={t("whenPlaceholder")}
                      value={m.date}
                      maxLength={40}
                      disabled={common.disabled}
                      onChange={(e) => set({ ...m, date: e.target.value })}
                    />
                    <Input
                      aria-label={t("title")}
                      placeholder={t("titlePlaceholder")}
                      value={m.title}
                      maxLength={120}
                      disabled={common.disabled}
                      onChange={(e) => set({ ...m, title: e.target.value })}
                    />
                  </div>
                  <Textarea
                    aria-label={t("happened")}
                    rows={2}
                    value={m.text}
                    maxLength={1500}
                    disabled={common.disabled}
                    onChange={(e) => set({ ...m, text: e.target.value })}
                  />
                </div>
                <ImageSlot
                  weddingId={common.weddingId}
                  path={m.photo}
                  url={m.photo ? common.images[m.photo] : null}
                  label={t("photo")}
                  aspect="aspect-[4/3]"
                  disabled={common.disabled}
                  onChange={(img) => {
                    if (img) common.addImage(img.path, img.url);
                    set({ ...m, photo: img?.path ?? null });
                  }}
                />
              </div>
            )}
          />
        </div>
      );
    }
    case "events":
      return (
        <div className="space-y-3">
          <FormField id={`${id}-intro`} label={t("intro")}>
            {(a) => (
              <Textarea
                {...a}
                rows={2}
                value={section.content.intro}
                maxLength={1000}
                disabled={common.disabled}
                onChange={(e) => onChange({ intro: e.target.value })}
              />
            )}
          </FormField>
          <p className="text-muted-foreground text-sm">
            {t.rich("eventsNote", { count: eventCount, link: link("/app/settings#events") })}
          </p>
        </div>
      );
    case "travel": {
      const c = section.content;
      return (
        <div className="space-y-3">
          <FormField id={`${id}-intro`} label={t("intro")}>
            {(a) => (
              <Textarea
                {...a}
                rows={2}
                value={c.intro}
                maxLength={1500}
                disabled={common.disabled}
                onChange={(e) => onChange({ ...c, intro: e.target.value })}
              />
            )}
          </FormField>
          <p className="text-muted-foreground text-sm">
            {t.rich("travelNote", {
              count: hotelCount,
              hotels: link("/app/hotels"),
              travel: link("/app/travel"),
            })}
          </p>
          <FormField id={`${id}-notes`} label={t("gettingAround")} hint={t("gettingAroundHint")}>
            {(a) => (
              <Textarea
                {...a}
                rows={4}
                value={c.notes}
                maxLength={3000}
                disabled={common.disabled}
                onChange={(e) => onChange({ ...c, notes: e.target.value })}
              />
            )}
          </FormField>
          <FormField id={`${id}-transport`} label={t("transport")} hint={t("transportHint")}>
            {(a) => (
              <Textarea
                {...a}
                rows={3}
                value={c.transport}
                maxLength={3000}
                disabled={common.disabled}
                onChange={(e) => onChange({ ...c, transport: e.target.value })}
              />
            )}
          </FormField>
          <FormField id={`${id}-visa`} label={t("visa")} hint={t("visaHint")}>
            {(a) => (
              <Textarea
                {...a}
                rows={3}
                value={c.visa}
                maxLength={3000}
                disabled={common.disabled}
                onChange={(e) => onChange({ ...c, visa: e.target.value })}
              />
            )}
          </FormField>
          <FormField id={`${id}-currency`} label={t("currency")} hint={t("currencyHint")}>
            {(a) => (
              <Textarea
                {...a}
                rows={2}
                value={c.currency}
                maxLength={2000}
                disabled={common.disabled}
                onChange={(e) => onChange({ ...c, currency: e.target.value })}
              />
            )}
          </FormField>
        </div>
      );
    }
    case "rsvp":
      return (
        <div className="space-y-3">
          <FormField id={`${id}-intro`} label={t("rsvpMessage")}>
            {(a) => (
              <Textarea
                {...a}
                rows={3}
                value={section.content.intro}
                maxLength={1000}
                disabled={common.disabled}
                onChange={(e) => onChange({ intro: e.target.value })}
              />
            )}
          </FormField>
          <p className="text-muted-foreground text-sm">
            {t.rich("rsvpNote", { link: link("/app/rsvp") })}
          </p>
        </div>
      );
    case "party": {
      const c = section.content;
      return (
        <ListEditor
          label={t("people")}
          addLabel={t("addPerson")}
          items={c.people}
          disabled={common.disabled}
          onChange={(people) => onChange({ people })}
          create={() => ({ id: newId(), name: "", role: "", bio: "", photo: null })}
          max={40}
          render={(p, set) => (
            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <ImageSlot
                weddingId={common.weddingId}
                path={p.photo}
                url={p.photo ? common.images[p.photo] : null}
                label={t("photo")}
                aspect="aspect-square"
                disabled={common.disabled}
                onChange={(img) => {
                  if (img) common.addImage(img.path, img.url);
                  set({ ...p, photo: img?.path ?? null });
                }}
              />
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    aria-label={t("name")}
                    placeholder={t("name")}
                    value={p.name}
                    maxLength={80}
                    disabled={common.disabled}
                    onChange={(e) => set({ ...p, name: e.target.value })}
                  />
                  <Input
                    aria-label={t("role")}
                    placeholder={t("rolePlaceholder")}
                    value={p.role}
                    maxLength={80}
                    disabled={common.disabled}
                    onChange={(e) => set({ ...p, role: e.target.value })}
                  />
                </div>
                <Textarea
                  aria-label={t("fewWords")}
                  placeholder={t("fewWordsPlaceholder")}
                  rows={2}
                  value={p.bio}
                  maxLength={500}
                  disabled={common.disabled}
                  onChange={(e) => set({ ...p, bio: e.target.value })}
                />
              </div>
            </div>
          )}
        />
      );
    }
    case "registry": {
      const c = section.content;
      return (
        <div className="space-y-4">
          <FormField id={`${id}-intro`} label={t("intro")} hint={t("registryHint")}>
            {(a) => (
              <Textarea
                {...a}
                rows={2}
                value={c.intro}
                maxLength={1500}
                disabled={common.disabled}
                onChange={(e) => onChange({ ...c, intro: e.target.value })}
              />
            )}
          </FormField>
          <ListEditor
            label={t("links")}
            addLabel={t("addLink")}
            items={c.links}
            disabled={common.disabled}
            onChange={(links) => onChange({ ...c, links })}
            create={() => ({ id: newId(), label: "", url: "", note: "" })}
            max={20}
            render={(l, set) => (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    aria-label={t("name")}
                    placeholder={t("linkNamePlaceholder")}
                    value={l.label}
                    maxLength={100}
                    disabled={common.disabled}
                    onChange={(e) => set({ ...l, label: e.target.value })}
                  />
                  <Input
                    aria-label={t("webAddress")}
                    placeholder="https://…"
                    value={l.url}
                    maxLength={500}
                    inputMode="url"
                    disabled={common.disabled}
                    aria-invalid={!!l.url.trim() && !safeUrl(l.url)}
                    onChange={(e) => set({ ...l, url: e.target.value })}
                  />
                </div>
                {!!l.url.trim() && !safeUrl(l.url) && (
                  <p className="text-destructive text-xs">{t("badUrl")}</p>
                )}
                <Input
                  aria-label={t("note")}
                  placeholder={t("notePlaceholder")}
                  value={l.note}
                  maxLength={300}
                  disabled={common.disabled}
                  onChange={(e) => set({ ...l, note: e.target.value })}
                />
              </div>
            )}
          />
        </div>
      );
    }
    case "faq": {
      const c = section.content;
      return (
        <ListEditor
          label={t("questions")}
          addLabel={t("addQuestion")}
          hint={t("questionsHint")}
          items={c.items}
          disabled={common.disabled}
          onChange={(items) => onChange({ items })}
          create={() => ({ id: newId(), question: "", answer: "" })}
          max={40}
          render={(q, set) => (
            <div className="space-y-2">
              <Input
                aria-label={t("question")}
                placeholder={t("question")}
                value={q.question}
                maxLength={200}
                disabled={common.disabled}
                onChange={(e) => set({ ...q, question: e.target.value })}
              />
              <Textarea
                aria-label={t("answer")}
                placeholder={t("answer")}
                rows={2}
                value={q.answer}
                maxLength={2000}
                disabled={common.disabled}
                onChange={(e) => set({ ...q, answer: e.target.value })}
              />
            </div>
          )}
        />
      );
    }
    case "gallery":
      return <GalleryForm content={section.content} onChange={onChange} {...common} />;
  }
}

function GalleryForm({
  content,
  onChange,
  weddingId,
  images,
  addImage,
  disabled,
}: Common & {
  content: SectionContent["gallery"];
  onChange: (c: SectionContent["gallery"]) => void;
}) {
  const t = useTranslations("websiteEditor.forms");
  const errors = useImageErrors();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function add(files: File[]) {
    const room = 60 - content.photos.length;
    const list = files.slice(0, room);
    const added: SectionContent["gallery"]["photos"] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy(t("uploading", { n: i + 1, total: list.length }));
      const r = await uploadSiteImage(weddingId, list[i], errors);
      if (r) {
        addImage(r.path, r.url);
        added.push({ id: newId(), path: r.path, caption: "" });
      }
    }
    setBusy(null);
    if (added.length) onChange({ photos: [...content.photos, ...added] });
  }

  return (
    <ListEditor
      label={t("photos")}
      items={content.photos}
      disabled={disabled}
      onChange={(photos) => onChange({ photos })}
      max={60}
      footer={
        <>
          <input
            ref={input}
            type="file"
            multiple
            accept={IMAGE_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-label={t("addPhotos")}
            onChange={(e) => {
              const f = [...(e.target.files ?? [])];
              e.target.value = "";
              void add(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !!busy || content.photos.length >= 60}
            onClick={() => input.current?.click()}
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}{" "}
            {busy ?? t("addPhotos")}
          </Button>
        </>
      }
      render={(p, set) => (
        <div className="grid grid-cols-[4.5rem_1fr] items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- private preview link */}
          <img
            src={images[p.path]}
            alt=""
            className="bg-muted aspect-square w-full rounded-md object-cover"
          />
          <Input
            aria-label={t("caption")}
            placeholder={t("captionPlaceholder")}
            value={p.caption}
            maxLength={200}
            disabled={disabled}
            onChange={(e) => set({ ...p, caption: e.target.value })}
          />
        </div>
      )}
    />
  );
}

/** Add / remove / move items of a list (milestones, people, links, questions, photos). */
function ListEditor<T extends { id: string }>({
  label,
  addLabel,
  hint,
  items,
  onChange,
  create,
  render,
  max,
  disabled,
  footer,
}: {
  label: string;
  addLabel?: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  create?: () => T;
  render: (item: T, set: (next: T) => void) => React.ReactNode;
  max: number;
  disabled: boolean;
  footer?: React.ReactNode;
}) {
  const t = useTranslations("websiteEditor.forms");
  const move = (i: number, d: number) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <p className="text-muted-foreground -mt-1 text-xs">{hint}</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={item.id} className="bg-card rounded-lg border p-3">
            {render(item, (next) => onChange(items.map((x) => (x.id === item.id ? next : x))))}
            {!disabled && (
              <div className="mt-2 flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  aria-label={t("moveUp", { n: i + 1 })}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={t("moveDown", { n: i + 1 })}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                  aria-label={t("remove", { n: i + 1 })}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {!disabled && create && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={items.length >= max}
          onClick={() => onChange([...items, create()])}
        >
          <Plus aria-hidden /> {addLabel}
        </Button>
      )}
      {!disabled && footer}
    </fieldset>
  );
}
