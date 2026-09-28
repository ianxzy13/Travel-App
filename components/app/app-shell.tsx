"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Accent } from "@/lib/database.types";
import { cn } from "@/lib/utils";
import type { WeddingSummary } from "@/lib/wedding";
import {
  isActive,
  MOBILE_TABS,
  NAV_GROUPS,
  SETTINGS_ITEM,
  SIDEBAR_COOKIE,
  type NavItem,
} from "./nav-items";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { UserMenu, type CurrentUser } from "./user-menu";
import { WeddingSwitcher } from "./wedding-switcher";

type Props = {
  current: WeddingSummary;
  weddings: WeddingSummary[];
  user: CurrentUser;
  accent: Accent;
  defaultCollapsed: boolean;
  notifications: { items: NotificationItem[]; unread: number };
  children: React.ReactNode;
};

/**
 * Layout for every /app page:
 * - desktop: collapsible left sidebar
 * - mobile: top bar + bottom tab bar with a "More" sheet
 */
export function AppShell({
  current,
  weddings,
  user,
  accent,
  defaultCollapsed,
  notifications,
  children,
}: Props) {
  const pathname = usePathname();
  const t = useTranslations("app.shell");
  const tn = useTranslations("app.nav");
  // The seating chart uses the whole screen width and height.
  const wide = pathname.startsWith("/app/seating");
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  // Dialogs and menus render outside this component (at the end of <body>),
  // so also put the accent on <html> for them to pick it up.
  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    return () => {
      delete document.documentElement.dataset.accent;
    };
  }, [accent]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    // Remember the choice so the server renders it the same way next time.
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div data-accent={accent} className="bg-background min-h-dvh">
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className={cn(
          "bg-card fixed inset-y-0 start-0 z-30 hidden flex-col border-e transition-[width] duration-200 md:flex",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
        aria-label={t("mainNav")}
      >
        <div
          className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-1 py-3" : "h-16 justify-between ps-5 pe-3",
          )}
        >
          {collapsed ? (
            <Link
              href="/app"
              className="font-serif text-2xl font-medium"
              aria-label={tn("dashboard")}
            >
              V<span className="text-primary-ink">.</span>
            </Link>
          ) : (
            <Logo href="/app" />
          )}
          <NotificationBell {...notifications} align={collapsed ? "start" : "end"} />
        </div>

        <div className="px-3">
          <WeddingSwitcher current={current} weddings={weddings} compact={collapsed} />
        </div>

        <nav className="mt-6 flex-1 space-y-7 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.key}>
              {!collapsed && (
                <p className="eyebrow mb-2 px-3 text-[0.62rem] tracking-[0.26em]">
                  {tn(`groups.${group.key}`)}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <SidebarLink
                      item={item}
                      active={isActive(pathname, item.href)}
                      collapsed={collapsed}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t p-3">
          <SidebarLink
            item={SETTINGS_ITEM}
            active={isActive(pathname, SETTINGS_ITEM.href)}
            collapsed={collapsed}
          />
          <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
            <div className={cn("min-w-0", !collapsed && "flex-1")}>
              <UserMenu user={user} showName={!collapsed} />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapsed}
              aria-label={collapsed ? t("expand") : t("collapse")}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen className="rtl:rotate-180" aria-hidden />
              ) : (
                <PanelLeftClose className="rtl:rotate-180" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="bg-card/95 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-2 backdrop-blur md:hidden">
        <div className="min-w-0 flex-1">
          <WeddingSwitcher current={current} weddings={weddings} />
        </div>
        <NotificationBell {...notifications} />
        <UserMenu user={user} showName={false} />
      </header>

      {/* ---------- Page content ---------- */}
      <main
        id="main"
        className={cn(
          "pb-24 transition-[padding] duration-200 md:pb-0",
          collapsed ? "md:ps-[4.5rem]" : "md:ps-64",
        )}
      >
        <div
          className={cn(
            "mx-auto w-full",
            wide ? "px-3 py-3 md:py-4" : "max-w-6xl px-4 py-6 sm:px-6 md:py-10",
          )}
        >
          {children}
        </div>
      </main>

      {/* ---------- Mobile bottom tab bar ---------- */}
      <nav
        aria-label={t("mainNav")}
        className="bg-card/95 fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((item) => (
            <li key={item.href}>
              <TabLink item={item} active={isActive(pathname, item.href)} />
            </li>
          ))}
          <li>
            <MoreSheet pathname={pathname} />
          </li>
        </ul>
      </nav>
    </div>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const label = useTranslations("app.nav")(item.key);
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "focus-visible:ring-ring relative flex items-center gap-3 rounded-md px-3 py-2 text-[0.72rem] tracking-[0.14em] uppercase transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
        collapsed && "justify-center px-0",
        active
          ? "bg-primary-soft/70 text-foreground before:bg-primary font-medium before:absolute before:inset-y-2 before:start-0 before:w-px"
          : "text-muted-foreground hover:bg-primary-soft/40 hover:text-foreground",
      )}
    >
      <Icon className={cn("size-[1.15rem] shrink-0", active && "text-primary-ink")} aria-hidden />
      {!collapsed && label}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function TabLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const label = useTranslations("app.nav")(item.key);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:bg-accent flex h-16 flex-col items-center justify-center gap-1 text-[0.6rem] tracking-[0.12em] uppercase focus-visible:outline-none",
        active ? "text-primary-ink font-medium" : "text-muted-foreground",
      )}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </Link>
  );
}

/** "More" tab on mobile: a bottom sheet with every module. */
function MoreSheet({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("app.shell");
  const tn = useTranslations("app.nav");
  const all = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];
  const activeInMore = !MOBILE_TABS.some((t) => isActive(pathname, t.href));

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={cn(
          "focus-visible:bg-accent flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6rem] tracking-[0.12em] uppercase focus-visible:outline-none",
          activeInMore ? "text-primary-ink font-medium" : "text-muted-foreground",
        )}
      >
        <Menu className="size-5" aria-hidden />
        {t("more")}
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-lg">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">{t("allTools")}</SheetTitle>
        </SheetHeader>
        <ul className="grid grid-cols-3 gap-2 px-4 pb-6">
          {all.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-md border p-3 text-center text-[0.65rem] tracking-[0.12em] uppercase",
                    active ? "border-primary bg-primary-soft font-medium" : "bg-background",
                  )}
                >
                  <Icon className="text-primary-ink size-5" aria-hidden />
                  {tn(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
