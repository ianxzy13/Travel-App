import Link from "next/link";
import { cn } from "@/lib/utils";

/** The "Vow" wordmark. Change the name here to rebrand the app. */
export const APP_NAME = "Vow";

/**
 * The Vow mark: an infinity sign whose right loop is a ring with a diamond.
 * Drawn in the current text colour; the diamond takes the accent colour.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 34"
      aria-hidden
      className={cn("h-[1em] w-auto overflow-visible", className)}
      fill="none"
    >
      <path
        d="M32 21C24 9 6 9 6 21C6 33 24 33 32 21C40 9 58 9 58 21C58 33 40 33 32 21Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
      />
      <path
        d="M41 6.5L43.5 3H50.5L53 6.5L47 13Z M41 6.5H53 M45 6.5L47 13L49 6.5 M43.5 3L45 6.5L47 3L49 6.5L50.5 3"
        className="stroke-primary-ink"
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill="var(--primary-soft)"
      />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "text-foreground inline-flex items-center gap-3 font-serif text-2xl font-medium tracking-[0.28em] uppercase focus-visible:rounded-sm focus-visible:outline-2",
        className,
      )}
    >
      <LogoMark className="h-[1.4em]" />
      <span>
        {APP_NAME}
        <span className="text-primary-ink">.</span>
      </span>
    </Link>
  );
}
