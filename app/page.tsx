import Link from "next/link";
import {
  Armchair,
  CalendarHeart,
  Globe,
  Images,
  Landmark,
  MailCheck,
  Plane,
  Users,
  Wallet,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Users,
    title: "Guest list",
    text: "Households, sides, dietary needs and CSV import in minutes.",
  },
  { icon: MailCheck, title: "RSVPs", text: "One private link per household. Answers arrive live." },
  {
    icon: Armchair,
    title: "Seating chart",
    text: "Drag guests onto seats. Keep families together, exes apart.",
  },
  { icon: Wallet, title: "Budget", text: "Categories, deposits and due dates, with no surprises." },
  {
    icon: Landmark,
    title: "Venues & vendors",
    text: "Compare side by side, then book with confidence.",
  },
  {
    icon: Plane,
    title: "Hotels & travel",
    text: "Room blocks, flights and an arrivals board for pickups.",
  },
  {
    icon: Images,
    title: "Inspiration",
    text: "Pin ideas, pull colour palettes and decide together.",
  },
  { icon: Globe, title: "Wedding website", text: "Five beautiful templates with RSVP built in." },
  {
    icon: CalendarHeart,
    title: "Timeline",
    text: "A to-do plan from twelve months out to the big day.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/login">Get started</Link>
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-20">
          <div>
            <p className="text-primary mb-4 text-sm font-medium tracking-wide uppercase">
              Wedding planning, together
            </p>
            <h1 className="text-5xl leading-[1.05] text-balance sm:text-6xl">
              Everything for your wedding, in one calm place.
            </h1>
            <p className="text-muted-foreground mt-6 max-w-lg text-lg">
              Plan your guests, RSVPs, seating, budget, venues and travel with your partner and
              family, from your phone or laptop.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/login">Start planning for free</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">See what&apos;s inside</a>
              </Button>
            </div>
          </div>

          <HeroPreview />
        </section>

        {/* Features */}
        <section id="features" className="bg-card/60 border-t py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-4xl">One app instead of twelve spreadsheets</h2>
            <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-center">
              Every part of your plan talks to the others. RSVPs flow into the seating chart, booked
              venues flow into your website.
            </p>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <li key={title} className="bg-background rounded-xl border p-6">
                  <span className="bg-primary-soft text-primary mb-4 inline-flex size-10 items-center justify-center rounded-full">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="text-2xl">{title}</h3>
                  <p className="text-muted-foreground mt-1">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
          <h2 className="text-4xl sm:text-5xl">Say yes to less stress.</h2>
          <p className="text-muted-foreground mt-4">
            Invite your partner, parents or planner, and plan it all together in real time.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/login">Create your wedding</Link>
          </Button>
        </section>
      </main>

      <footer className="text-muted-foreground border-t py-8 text-center text-sm">
        Made with love · © {new Date().getFullYear()} Vow
      </footer>
    </div>
  );
}

/** A decorative mock-up of the app, drawn with plain HTML/SVG. */
function HeroPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md">
      <div className="bg-primary-soft absolute -inset-6 -z-10 rounded-[2rem] blur-2xl" />
      <div className="bg-card rounded-2xl border p-6 shadow-xl">
        <p className="text-muted-foreground text-sm">Ian & Maria · Lisbon</p>
        <p className="mt-1 font-serif text-6xl font-semibold">214</p>
        <p className="text-muted-foreground text-sm">days to go</p>

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          {[
            ["86", "attending"],
            ["9", "declined"],
            ["23", "waiting"],
          ].map(([n, label]) => (
            <div key={label} className="bg-muted rounded-lg p-3">
              <p className="font-serif text-2xl font-semibold">{n}</p>
              <p className="text-muted-foreground text-xs">{label}</p>
            </div>
          ))}
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-sm">
            <span>Budget</span>
            <span className="text-muted-foreground">€18,400 of €25,000</span>
          </div>
          <div className="bg-muted mt-2 h-2 rounded-full">
            <div className="bg-primary h-2 w-[74%] rounded-full" />
          </div>
        </div>

        {/* mini seating chart */}
        <svg viewBox="0 0 300 110" className="text-primary mt-6 w-full">
          {[50, 150, 250].map((cx, t) => (
            <g key={cx}>
              <circle cx={cx} cy={55} r={24} className="fill-muted stroke-border" />
              {Array.from({ length: 8 }).map((_, i) => {
                const a = (i / 8) * Math.PI * 2;
                const filled = (i + t) % 3 !== 0;
                return (
                  <circle
                    key={i}
                    cx={cx + Math.cos(a) * 36}
                    cy={55 + Math.sin(a) * 36}
                    r={7}
                    className={filled ? "fill-current" : "fill-card stroke-border"}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
