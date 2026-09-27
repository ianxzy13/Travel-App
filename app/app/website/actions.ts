"use server";

import { z } from "zod";
import { fail, type ActionResult } from "@/lib/action-result";
import { isOwnFile, removeFiles } from "@/lib/files";
import { createClient } from "@/lib/supabase/server";
import { canEdit, requireWedding } from "@/lib/wedding";
import { sanitizeTranslation } from "@/lib/i18n/content";
import { sectionSchemas, sitePaths } from "@/lib/website/content";

const NO_PERMISSION = {
  ok: false as const,
  error: "You don't have permission to change the website.",
};

async function editor() {
  const { wedding, role } = await requireWedding();
  if (!canEdit(role)) return null;
  return { wedding, sb: await createClient() };
}

const saveSchema = z.object({
  look: z.object({
    template: z.enum(["classic", "modern", "garden", "boho", "beach"]),
    accent_color: z
      .string()
      .regex(/^#[0-9a-f]{6}$/)
      .nullable(),
    heading_font: z
      .enum(["cormorant", "playfair", "fraunces", "josefin", "inter", "great-vibes"])
      .nullable(),
    body_font: z.enum(["inter", "lora", "nunito", "josefin"]).nullable(),
    hero_path: z.string().max(500).nullable(),
  }),
  // in display order
  sections: z
    .array(
      z.object({
        id: z.uuid(),
        visible: z.boolean(),
        content: z.unknown(),
        // { "<language>": { …texts } }; cleaned below
        translations: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .max(20),
});

/** Saves the whole website (look + sections) in one go. Called by autosave. */
export async function saveWebsite(input: unknown): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: "Something in the website looks wrong. Please reload the page." };
  const { look, sections } = parsed.data;
  const wid = ctx.wedding.id;

  const [{ data: before }, { data: rows }] = await Promise.all([
    ctx.sb.from("website_settings").select("hero_path").eq("wedding_id", wid).single(),
    ctx.sb.from("website_sections").select("id, kind, content").eq("wedding_id", wid),
  ]);
  if (!rows) return fail("saveWebsite", "no sections");
  const kindOf = new Map(rows.map((r) => [r.id, r.kind]));

  // Check each section's content against its own schema.
  const next = [];
  for (const s of sections) {
    const kind = kindOf.get(s.id);
    if (!kind) return NO_PERMISSION;
    const content = sectionSchemas[kind].safeParse(s.content);
    if (!content.success) return { ok: false, error: content.error.issues[0].message };
    // only the wedding's other languages, and only texts that section can translate
    const translations: Record<string, Record<string, unknown>> = {};
    for (const [lang, tr] of Object.entries(s.translations ?? {})) {
      if (!ctx.wedding.languages.includes(lang) || lang === ctx.wedding.languages[0]) continue;
      const clean = sanitizeTranslation(kind, tr);
      if (Object.keys(clean).length) translations[lang] = clean;
    }
    next.push({ ...s, kind, content: content.data, translations });
  }

  // Pictures must be this wedding's website uploads.
  const newPaths = sitePaths(look.hero_path, next);
  if (newPaths.some((p) => !isOwnFile(p, wid) || !p.startsWith(`${wid}/website/`)))
    return NO_PERMISSION;

  const results = await Promise.all([
    ctx.sb.from("website_settings").update(look).eq("wedding_id", wid),
    ...next.map((s, i) =>
      ctx.sb
        .from("website_sections")
        .update({
          sort_order: i,
          visible: s.visible,
          content: s.content,
          translations: s.translations,
        })
        .eq("id", s.id)
        .eq("wedding_id", wid),
    ),
  ]);
  const error = results.find((r) => r.error)?.error;
  if (error) return fail("saveWebsite", error);

  // Delete pictures that are no longer used anywhere on the site.
  const keep = new Set(newPaths);
  const old = sitePaths(before?.hero_path ?? null, rows);
  await removeFiles(
    ctx.sb,
    old.filter((p) => !keep.has(p)),
  );

  return { ok: true };
}

export async function setPublished(on: boolean): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const { error } = await ctx.sb
    .from("website_settings")
    .update({ published: on, ...(on ? { published_at: new Date().toISOString() } : {}) })
    .eq("wedding_id", ctx.wedding.id);
  if (error) return fail("setPublished", error);
  return { ok: true };
}

/** Sets the visitor password, or removes it (null / empty). */
export async function setSitePassword(password: string | null): Promise<ActionResult> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const pw = (password ?? "").trim();
  if (pw && (pw.length < 4 || pw.length > 100))
    return { ok: false, error: "Use 4 to 100 characters." };
  const { error } = await ctx.sb.rpc("set_site_password", {
    p_wedding_id: ctx.wedding.id,
    p_password: pw || null,
  });
  if (error) return fail("setSitePassword", error);
  return { ok: true };
}

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters")
  .max(60, "Use at most 60 characters")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use only letters, numbers and single dashes (e.g. ian-and-maria)",
  );

/** Changes the web address (/w/<slug>, also used by the RSVP page). */
export async function updateSlug(input: string): Promise<ActionResult<{ slug: string }>> {
  const ctx = await editor();
  if (!ctx) return NO_PERMISSION;
  const parsed = slugSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const slug = parsed.data;
  if (slug === ctx.wedding.slug) return { ok: true, data: { slug } };
  const { error } = await ctx.sb.from("weddings").update({ slug }).eq("id", ctx.wedding.id);
  if (error?.code === "23505")
    return {
      ok: false,
      error: "That address is taken. Try adding your year, e.g. ian-and-maria-2027.",
    };
  if (error) return fail("updateSlug", error);
  return { ok: true, data: { slug } };
}
