"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { safeUrl, type Section, type SectionContent } from "@/lib/website/content";
import { IMAGE_TYPES, ImageSlot, uploadSiteImage } from "./image-slot";

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
  const id = section.kind;
  switch (section.kind) {
    case "home": {
      const c = section.content;
      return (
        <div className="space-y-3">
          <FormField id={`${id}-tagline`} label="Tagline" hint="A short line above your names.">
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
            Names, date and place come from{" "}
            <Link href="/app/settings" className="underline underline-offset-2">
              Settings
            </Link>
            . The hero photo is under Design.
          </p>
        </div>
      );
    }
    case "story": {
      const c = section.content;
      return (
        <div className="space-y-4">
          <FormField id={`${id}-intro`} label="How it all began">
            {(a) => (
              <Textarea
                {...a}
                rows={4}
                value={c.intro}
                maxLength={3000}
                disabled={common.disabled}
                placeholder="We met at…"
                onChange={(e) => onChange({ ...c, intro: e.target.value })}
              />
            )}
          </FormField>
          <ListEditor
            label="Milestones"
            addLabel="Add milestone"
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
                      aria-label="When"
                      placeholder="e.g. June 2019"
                      value={m.date}
                      maxLength={40}
                      disabled={common.disabled}
                      onChange={(e) => set({ ...m, date: e.target.value })}
                    />
                    <Input
                      aria-label="Title"
                      placeholder="First date"
                      value={m.title}
                      maxLength={120}
                      disabled={common.disabled}
                      onChange={(e) => set({ ...m, title: e.target.value })}
                    />
                  </div>
                  <Textarea
                    aria-label="What happened"
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
                  label="Photo"
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
          <FormField id={`${id}-intro`} label="Introduction (optional)">
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
            {eventCount} event{eventCount === 1 ? "" : "s"} from{" "}
            <Link href="/app/settings#events" className="underline underline-offset-2">
              Settings → Events
            </Link>{" "}
            (times, places, dress code, with a map link).
          </p>
        </div>
      );
    case "travel": {
      const c = section.content;
      return (
        <div className="space-y-3">
          <FormField id={`${id}-intro`} label="Introduction (optional)">
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
            {hotelCount} hotel{hotelCount === 1 ? "" : "s"} shown (tick “Show on website” in{" "}
            <Link href="/app/hotels" className="underline underline-offset-2">
              Hotels
            </Link>
            ). The nearest airport comes from{" "}
            <Link href="/app/travel" className="underline underline-offset-2">
              Travel
            </Link>
            .
          </p>
          <FormField
            id={`${id}-notes`}
            label="Getting around"
            hint="Taxis, parking, shuttles, weather…"
          >
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
        </div>
      );
    }
    case "rsvp":
      return (
        <div className="space-y-3">
          <FormField id={`${id}-intro`} label="Message above the form">
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
            Guests find their invitation by name or code. The deadline and meals are set in{" "}
            <Link href="/app/rsvp" className="underline underline-offset-2">
              RSVPs
            </Link>
            .
          </p>
        </div>
      );
    case "party": {
      const c = section.content;
      return (
        <ListEditor
          label="People"
          addLabel="Add person"
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
                label="Photo"
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
                    aria-label="Name"
                    placeholder="Name"
                    value={p.name}
                    maxLength={80}
                    disabled={common.disabled}
                    onChange={(e) => set({ ...p, name: e.target.value })}
                  />
                  <Input
                    aria-label="Role"
                    placeholder="Maid of honour"
                    value={p.role}
                    maxLength={80}
                    disabled={common.disabled}
                    onChange={(e) => set({ ...p, role: e.target.value })}
                  />
                </div>
                <Textarea
                  aria-label="A few words"
                  placeholder="A few words (optional)"
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
          <FormField
            id={`${id}-intro`}
            label="Introduction (optional)"
            hint="e.g. “Your presence is the best gift, but if you'd like…”"
          >
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
            label="Links"
            addLabel="Add link"
            items={c.links}
            disabled={common.disabled}
            onChange={(links) => onChange({ ...c, links })}
            create={() => ({ id: newId(), label: "", url: "", note: "" })}
            max={20}
            render={(l, set) => (
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    aria-label="Name"
                    placeholder="Honeymoon fund"
                    value={l.label}
                    maxLength={100}
                    disabled={common.disabled}
                    onChange={(e) => set({ ...l, label: e.target.value })}
                  />
                  <Input
                    aria-label="Web address"
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
                  <p className="text-destructive text-xs">
                    That doesn&apos;t look like a web address.
                  </p>
                )}
                <Input
                  aria-label="Note"
                  placeholder="Note (optional)"
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
          label="Questions"
          addLabel="Add question"
          hint="Questions without an answer are hidden on the site."
          items={c.items}
          disabled={common.disabled}
          onChange={(items) => onChange({ items })}
          create={() => ({ id: newId(), question: "", answer: "" })}
          max={40}
          render={(q, set) => (
            <div className="space-y-2">
              <Input
                aria-label="Question"
                placeholder="Question"
                value={q.question}
                maxLength={200}
                disabled={common.disabled}
                onChange={(e) => set({ ...q, question: e.target.value })}
              />
              <Textarea
                aria-label="Answer"
                placeholder="Answer"
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
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function add(files: File[]) {
    const room = 60 - content.photos.length;
    const list = files.slice(0, room);
    const added: SectionContent["gallery"]["photos"] = [];
    for (let i = 0; i < list.length; i++) {
      setBusy(`Uploading ${i + 1} of ${list.length}…`);
      const r = await uploadSiteImage(weddingId, list[i]);
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
      label="Photos"
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
            aria-label="Add photos"
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
            {busy ?? "Add photos"}
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
            aria-label="Caption"
            placeholder="Caption (optional)"
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
                  aria-label={`Move item ${i + 1} up`}
                >
                  <ArrowUp aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === items.length - 1}
                  onClick={() => move(i, 1)}
                  aria-label={`Move item ${i + 1} down`}
                >
                  <ArrowDown aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                  aria-label={`Remove item ${i + 1}`}
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
