import {
  Armchair,
  BedDouble,
  Camera,
  ClipboardList,
  Clock,
  Gift,
  Globe,
  Images,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MailCheck,
  Plane,
  Settings,
  Store,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/** Cookie remembering whether the desktop sidebar is collapsed. */
export const SIDEBAR_COOKIE = "vow_sidebar";

/** `key` is the name under "app.nav" in messages/*.json. */
export type NavKey =
  | "dashboard"
  | "tasks"
  | "budget"
  | "gifts"
  | "vendors"
  | "paperwork"
  | "guests"
  | "rsvp"
  | "seating"
  | "venues"
  | "hotels"
  | "travel"
  | "inspiration"
  | "website"
  | "schedule"
  | "photos"
  | "settings"
  | "home";
export type NavItem = { href: string; key: NavKey; icon: LucideIcon };
export type NavGroupKey = "plan" | "people" | "places" | "style";

/** Every module in the app, grouped as they appear in the sidebar. */
export const NAV_GROUPS: { key: NavGroupKey; items: NavItem[] }[] = [
  {
    key: "plan",
    items: [
      { href: "/app", key: "dashboard", icon: LayoutDashboard },
      { href: "/app/tasks", key: "tasks", icon: ListChecks },
      { href: "/app/budget", key: "budget", icon: Wallet },
      { href: "/app/gifts", key: "gifts", icon: Gift },
      { href: "/app/vendors", key: "vendors", icon: Store },
      { href: "/app/paperwork", key: "paperwork", icon: ClipboardList },
    ],
  },
  {
    key: "people",
    items: [
      { href: "/app/guests", key: "guests", icon: Users },
      { href: "/app/rsvp", key: "rsvp", icon: MailCheck },
      { href: "/app/seating", key: "seating", icon: Armchair },
    ],
  },
  {
    key: "places",
    items: [
      { href: "/app/venues", key: "venues", icon: Landmark },
      { href: "/app/hotels", key: "hotels", icon: BedDouble },
      { href: "/app/travel", key: "travel", icon: Plane },
    ],
  },
  {
    key: "style",
    items: [
      { href: "/app/inspiration", key: "inspiration", icon: Images },
      { href: "/app/photos", key: "photos", icon: Camera },
      { href: "/app/website", key: "website", icon: Globe },
      { href: "/app/schedule", key: "schedule", icon: Clock },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/app/settings", key: "settings", icon: Settings };

/** The four shortcuts in the mobile bottom bar (plus a "More" button). */
export const MOBILE_TABS: NavItem[] = [
  { href: "/app", key: "home", icon: LayoutDashboard },
  { href: "/app/guests", key: "guests", icon: Users },
  { href: "/app/seating", key: "seating", icon: Armchair },
  { href: "/app/budget", key: "budget", icon: Wallet },
];

export function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}
