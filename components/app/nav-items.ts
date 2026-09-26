import {
  Armchair,
  BedDouble,
  Clock,
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

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Every module in the app, grouped as they appear in the sidebar. */
export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Plan",
    items: [
      { href: "/app", label: "Dashboard", icon: LayoutDashboard },
      { href: "/app/tasks", label: "To-dos", icon: ListChecks },
      { href: "/app/budget", label: "Budget", icon: Wallet },
      { href: "/app/vendors", label: "Vendors", icon: Store },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/app/guests", label: "Guests", icon: Users },
      { href: "/app/rsvp", label: "RSVPs", icon: MailCheck },
      { href: "/app/seating", label: "Seating", icon: Armchair },
    ],
  },
  {
    label: "Places",
    items: [
      { href: "/app/venues", label: "Venues", icon: Landmark },
      { href: "/app/hotels", label: "Hotels", icon: BedDouble },
      { href: "/app/travel", label: "Travel", icon: Plane },
    ],
  },
  {
    label: "Style",
    items: [
      { href: "/app/inspiration", label: "Inspiration", icon: Images },
      { href: "/app/website", label: "Website", icon: Globe },
      { href: "/app/schedule", label: "Day-of schedule", icon: Clock },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/app/settings", label: "Settings", icon: Settings };

/** The four shortcuts in the mobile bottom bar (plus a "More" button). */
export const MOBILE_TABS: NavItem[] = [
  { href: "/app", label: "Home", icon: LayoutDashboard },
  { href: "/app/guests", label: "Guests", icon: Users },
  { href: "/app/seating", label: "Seating", icon: Armchair },
  { href: "/app/budget", label: "Budget", icon: Wallet },
];

export function isActive(pathname: string, href: string) {
  return href === "/app"
    ? pathname === "/app"
    : pathname === href || pathname.startsWith(`${href}/`);
}
