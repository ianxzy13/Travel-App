"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, Copy, ExternalLink, Eye, Globe, Loader2, Lock, Monitor, Pencil, Smartphone, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { saveWebsite, setPublished, setSitePassword, updateSlug } from "@/app/app/website/actions";
import { PageHeader } from "@/components/app/page-header";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isSectionEmpty, type Section, type SiteData } from "@/lib/website/content";
import type { EditorData } from "@/lib/website/load";
import { cn } from "@/lib/utils";
import { DesignPanel } from "./design-panel";
import { SectionsPanel } from "./sections-panel";
import { SitePreview } from "./site-preview";

type Props = EditorData & { weddingId: string; canEdit: boolean; fontClass: string };
type SaveState = "saved" | "pending" | "saving" | "error";

export function WebsiteEditor(props: Props) {
  const { canEdit, weddingId } = props;
  const [look, setLook] = useState<SiteData["look"]>({
    template: props.settings.template,
    accent_color: props.settings.accent_color,
    heading_font: props.settings.heading_font,
    body_font: props.settings.body_font,
    hero_path: props.settings.hero_path,
  });
  const [sections, setSections] = useState<Section[]>(props.sections);
  const [published, setPub] = useState(props.settings.published);
  const [hasPassword, setHasPassword] = useState(props.hasPassword);
  const [slug, setSlug] = useState(props.site.wedding.slug);
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  const images = useMemo(() => ({ ...props.site.images, ...localImages }), [props.site.images, localImages]);
  const addImage = useCallback((path: string, url: string) => setLocalImages((m) => ({ ...m, [path]: url })), []);

  // ---- autosave: ~1 s after the last change ----
  const [save, setSave] = useState<SaveState>("saved");
  const version = useRef(0);
  const first = useRef(true);
  const latest = useRef({ look, sections });
  latest.current = { look, sections };

  const saveNow = useCallback(async () => {
    const v = version.current;
    setSave("saving");
    const { look, sections } = latest.current;
    const r = await saveWebsite({ look, sections: sections.map((s) => ({ id: s.id, visible: s.visible, content: s.content })) }).catch(() => ({
      ok: false as const,
      error: "Couldn’t reach the server. Check your connection; we’ll keep your changes here.",
    }));
    if (!r.ok) {
      setSave("error");
      toast.error(r.error);
      return;
    }
    // more edits may have arrived while saving; they'll trigger another save
    if (v === version.current) setSave("saved");
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    version.current++;
    setSave("pending");
    const t = setTimeout(saveNow, 900);
    return () => clearTimeout(t);
  }, [look, sections, saveNow]);

  useEffect(() => {
    if (save === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const data: SiteData = {
    ...props.site,
    wedding: { ...props.site.wedding, slug },
    look,
    sections: sections.filter((s) => s.visible),
    images,
  };
  const visibleWithContent = sections.filter((s) => s.visible && !isSectionEmpty(s, data)).length;

  const common = { weddingId, images, addImage, disabled: !canEdit };
  const editPanel = (
    <Tabs defaultValue="sections">
      <TabsList className="w-full">
        <TabsTrigger value="design">Design</TabsTrigger>
        <TabsTrigger value="sections">Sections</TabsTrigger>
        <TabsTrigger value="publish">Publish</TabsTrigger>
      </TabsList>
      <TabsContent value="design" className="pt-4">
        <DesignPanel look={look} onChange={setLook} {...common} />
      </TabsContent>
      <TabsContent value="sections" className="pt-4">
        <SectionsPanel sections={sections} onChange={setSections} site={data} {...common} />
      </TabsContent>
      <TabsContent value="publish" className="pt-4">
        <PublishPanel
          slug={slug}
          onSlug={setSlug}
          published={published}
          onPublished={setPub}
          hasPassword={hasPassword}
          onPassword={setHasPassword}
          canEdit={canEdit}
        />
      </TabsContent>
    </Tabs>
  );

  return (
    <>
      <PageHeader
        title="Wedding website"
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className={cn("inline-flex items-center gap-1.5", published ? "text-success" : "")}>
              <Globe className="size-4" aria-hidden />
              {published ? "Published" : "Not published yet"}
              {hasPassword && (
                <>
                  {" "}
                  · <Lock className="size-3.5" aria-hidden /> password
                </>
              )}
            </span>
            {canEdit && <SaveBadge state={save} onRetry={saveNow} />}
          </span>
        }
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={`/w/${slug}`} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden /> {published ? "View site" : "Open preview"}
            </a>
          </Button>
        }
      />

      {!canEdit && (
        <p className="bg-muted mb-4 rounded-lg px-4 py-3 text-sm">Only owners and editors can change the website. Here&apos;s how it looks.</p>
      )}

      {/* Phones: switch between editing and the preview */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border p-1 lg:hidden" role="tablist" aria-label="View">
        {(["edit", "preview"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={mobileView === v}
            onClick={() => setMobileView(v)}
            className={cn(
              "focus-visible:ring-ring flex h-9 items-center justify-center gap-1.5 rounded-md text-sm focus-visible:ring-2 focus-visible:outline-none",
              mobileView === v ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            {v === "edit" ? <Pencil className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
            {v === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(22rem,26rem)_1fr]">
        <div className={cn("min-w-0", mobileView === "preview" && "hidden lg:block")}>{editPanel}</div>
        <div className={cn("min-w-0 lg:sticky lg:top-4 lg:self-start", mobileView === "edit" && "hidden lg:block")}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Live preview · {visibleWithContent} section{visibleWithContent === 1 ? "" : "s"} showing
            </p>
            <div className="flex rounded-lg border p-0.5" role="group" aria-label="Preview size">
              {(["desktop", "phone"] as const).map((d) => (
                <Button key={d} variant={device === d ? "secondary" : "ghost"} size="sm" onClick={() => setDevice(d)} aria-pressed={device === d}>
                  {d === "desktop" ? <Monitor aria-hidden /> : <Smartphone aria-hidden />}
                  <span className="sr-only sm:not-sr-only">{d === "desktop" ? "Desktop" : "Phone"}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="h-[calc(100dvh-12rem)] min-h-[28rem]">
            <SitePreview data={data} device={device} fontClass={props.fontClass} />
          </div>
        </div>
      </div>
    </>
  );
}

function SaveBadge({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="text-destructive inline-flex items-center gap-1 text-sm underline underline-offset-2">
        <TriangleAlert className="size-3.5" aria-hidden /> Not saved, try again
      </button>
    );
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-sm" role="status" aria-live="polite">
      {state === "saved" ? <Check className="size-3.5" aria-hidden /> : <Loader2 className="size-3.5 animate-spin" aria-hidden />}
      {state === "saved" ? "All changes saved" : "Saving…"}
    </span>
  );
}

function PublishPanel({
  slug,
  onSlug,
  published,
  onPublished,
  hasPassword,
  onPassword,
  canEdit,
}: {
  slug: string;
  onSlug: (s: string) => void;
  published: boolean;
  onPublished: (on: boolean) => void;
  hasPassword: boolean;
  onPassword: (on: boolean) => void;
  canEdit: boolean;
}) {
  const [slugDraft, setSlugDraft] = useState(slug);
  const [slugError, setSlugError] = useState<string>();
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = `${origin}/w/${slug}`;

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl">Publish</h3>
            <p className="text-muted-foreground text-sm">
              {published ? "Anyone with the link can see your website." : "Only your wedding team can see it for now."}
            </p>
          </div>
          <Switch
            checked={published}
            disabled={!canEdit || pending}
            aria-label="Publish the website"
            onCheckedChange={(on) =>
              startTransition(async () => {
                const r = await setPublished(on);
                if (!r.ok) return void toast.error(r.error);
                onPublished(on);
                toast.success(on ? "Your website is live!" : "Website unpublished");
              })
            }
          />
        </div>
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label="Website link" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="outline" size="icon" aria-label="Copy link" onClick={() => navigator.clipboard?.writeText(link).then(() => toast.success("Link copied"))}>
            <Copy aria-hidden />
          </Button>
        </div>
      </section>

      <form
        className="space-y-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSlugError(undefined);
          startTransition(async () => {
            const r = await updateSlug(slugDraft);
            if (!r.ok) return setSlugError(r.error);
            onSlug(r.data!.slug);
            setSlugDraft(r.data!.slug);
            toast.success("Web address saved");
          });
        }}
      >
        <h3 className="text-xl">Web address</h3>
        <FormField id="site-slug" label="Your address" error={slugError} hint="Changing it breaks links you've already shared (including the RSVP page).">
          {(a) => (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground shrink-0 text-sm">/w/</span>
              <Input {...a} value={slugDraft} onChange={(e) => setSlugDraft(e.target.value.toLowerCase())} maxLength={60} disabled={!canEdit} />
            </div>
          )}
        </FormField>
        <Button type="submit" size="sm" variant="secondary" disabled={!canEdit || pending || slugDraft === slug}>
          Save address
        </Button>
      </form>

      <form
        className="space-y-3 rounded-xl border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPwError(undefined);
          startTransition(async () => {
            const r = await setSitePassword(password);
            if (!r.ok) return setPwError(r.error);
            onPassword(true);
            setPassword("");
            toast.success("Password set. Guests who already entered the old one will be asked again.");
          });
        }}
      >
        <h3 className="flex items-center gap-2 text-xl">
          <Lock className="size-4" aria-hidden /> Password {hasPassword ? <span className="text-success font-sans text-sm font-normal">on</span> : <span className="text-muted-foreground font-sans text-sm font-normal">off</span>}
        </h3>
        <p className="text-muted-foreground text-sm">
          Guests type it once (it&apos;s remembered for 30 days). Your wedding team never needs it. Put it on your invitations.
        </p>
        <FormField id="site-password-new" label={hasPassword ? "New password" : "Password"} error={pwError}>
          {(a) => (
            <Input {...a} type="text" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} minLength={4} maxLength={100} disabled={!canEdit} placeholder="e.g. sunflower2027" />
          )}
        </FormField>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="secondary" disabled={!canEdit || pending || password.trim().length < 4}>
            {hasPassword ? "Change password" : "Set password"}
          </Button>
          {hasPassword && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!canEdit || pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setSitePassword(null);
                  if (!r.ok) return void toast.error(r.error);
                  onPassword(false);
                  toast.success("Password removed");
                })
              }
            >
              Remove password
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
