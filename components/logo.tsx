import Link from "next/link";
import { cn } from "@/lib/utils";

/** The "Vow" wordmark. Change the name here to rebrand the app. */
export const APP_NAME = "Vow";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "text-foreground font-serif text-2xl font-semibold tracking-tight focus-visible:rounded-sm focus-visible:outline-2",
        className,
      )}
    >
      {APP_NAME}
      <span className="text-primary">.</span>
    </Link>
  );
}
