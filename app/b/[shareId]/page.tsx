/* eslint-disable @next/next/no-img-element -- pins come from any website */
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import type { Accent } from "@/lib/database.types";
import { FILES_BUCKET } from "@/lib/files";
import { masonryColumns } from "@/lib/inspiration/layout";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type SharedPin = {
  id: string;
  title: string | null;
  note: string | null;
  image_path: string | null;
  image_url: string | null;
  width: number | null;
  height: number | null;
  source_url: string | null;
  credit_name: string | null;
  credit_url: string | null;
};
type SharedBoard = { name: string; description: string | null; couple: string; accent: Accent; pins: SharedPin[] };

const loadBoard = cache(async (shareId: string) => {
  if (!isSupabaseConfigured || !/^[\w-]{16,64}$/.test(shareId)) return null;
  const sb = await createClient();
  const { data } = await sb.rpc("get_shared_board", { p_share_id: shareId });
  return (data as SharedBoard | null) ?? null;
});

export async function generateMetadata({ params }: { params: Promise<{ shareId: string }> }): Promise<Metadata> {
  const board = await loadBoard((await params).shareId);
  return {
    title: board ? `${board.name} · ${board.couple}` : "Shared board",
    robots: { index: false, follow: false },
  };
}

/** /b/<token> — a read-only board shared with a link (e.g. for the florist). */
export default async function SharedBoardPage({ params }: { params: Promise<{ shareId: string }> }) {
  const board = await loadBoard((await params).shareId);
  if (!board) notFound();

  // Uploaded images are private; shared boards get temporary (1 hour) links.
  const paths = board.pins.map((p) => p.image_path).filter((p): p is string => !!p);
  const sb = await createClient();
  const { data: signed } = paths.length
    ? await sb.storage.from(FILES_BUCKET).createSignedUrls(paths, 3600)
    : { data: [] };
  const url = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));
  const pins = board.pins
    .map((p) => ({ ...p, src: p.image_path ? url.get(p.image_path) : p.image_url }))
    .filter((p): p is typeof p & { src: string } => !!p.src);

  // Pure-CSS responsive masonry: 2 columns on phones, 3 on tablets, 4 on desktops.
  const layouts = [2, 3, 4].map((n) => masonryColumns(pins, n));

  return (
    <div data-accent={board.accent} className="bg-background min-h-dvh">
      <main className="mx-auto max-w-6xl px-4 pt-10 pb-16">
        <header className="mb-8 text-center">
          <p className="text-primary text-xs font-medium tracking-[0.3em] uppercase">{board.couple}</p>
          <h1 className="mt-3 text-5xl">{board.name}</h1>
          {board.description && <p className="text-muted-foreground mx-auto mt-3 max-w-xl">{board.description}</p>}
        </header>
        {pins.length === 0 ? (
          <p className="text-muted-foreground text-center">This board is empty for now.</p>
        ) : (
          layouts.map((cols, i) => (
            <div
              key={i}
              className={
                i === 0 ? "flex items-start gap-3 sm:hidden" : i === 1 ? "hidden items-start gap-3 sm:flex lg:hidden" : "hidden items-start gap-4 lg:flex"
              }
            >
              {cols.map((col, c) => (
                <div key={c} className="flex min-w-0 flex-1 flex-col gap-4">
                  {col.map((p) => (
                    <figure key={p.id}>
                      <img
                        src={p.src}
                        alt={p.title || "Inspiration"}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="bg-muted w-full rounded-xl object-cover"
                        style={{ aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : "4 / 5" }}
                      />
                      {(p.title || p.note || p.credit_name) && (
                        <figcaption className="mt-1.5 space-y-0.5 px-0.5 text-sm">
                          {p.title && <p>{p.title}</p>}
                          {p.note && <p className="text-muted-foreground">{p.note}</p>}
                          {p.credit_name && (
                            <p className="text-muted-foreground text-xs">
                              Photo by{" "}
                              <a href={p.credit_url ?? undefined} className="underline" target="_blank" rel="noreferrer">
                                {p.credit_name}
                              </a>{" "}
                              on{" "}
                              <a href={p.source_url ?? undefined} className="underline" target="_blank" rel="noreferrer">
                                Unsplash
                              </a>
                            </p>
                          )}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
        <footer className="text-muted-foreground mt-16 flex items-center justify-center gap-2 text-sm">
          Made with <Logo />
        </footer>
      </main>
    </div>
  );
}
