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
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  const current = weddings.find((w) => w.id === wedding.id) ?? weddings[0];

  return (
    <AppShell
      current={current}
      weddings={weddings}
      accent={wedding.accent}
      defaultCollapsed={collapsed}
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
