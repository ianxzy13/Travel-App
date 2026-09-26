import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { SIDEBAR_COOKIE } from "@/components/app/nav-items";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWedding } from "@/lib/wedding";

// Every /app page depends on who is signed in, so never pre-render at build time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/login");

  const user = await requireUser();
  const { wedding, weddings } = await requireWedding();

  const supabase = await createClient();
  // Adds reminders (payments, room-block cut-offs, to-dos) at most once a day.
  // A failure here must never block the app, so errors are only logged.
  const { error: syncError } = await supabase.rpc("sync_reminders", { p_wedding_id: wedding.id });
  if (syncError && syncError.code !== "PGRST202") console.error("[sync_reminders]", syncError);

  const [{ data: profile }, { data: notifications }, { count: unread }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .eq("user_id", user.id)
      .eq("wedding_id", wedding.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("wedding_id", wedding.id)
      .is("read_at", null),
  ]);

  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const current = weddings.find((w) => w.id === wedding.id) ?? weddings[0];

  return (
    <AppShell
      current={current}
      weddings={weddings}
      accent={wedding.accent}
      defaultCollapsed={collapsed}
      notifications={{
        unread: unread ?? 0,
        items: (notifications ?? []).map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          readAt: n.read_at,
          createdAt: n.created_at,
        })),
      }}
      user={{
        name: profile?.full_name ?? null,
        email: user.email ?? "",
        avatarUrl: profile?.avatar_url ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
