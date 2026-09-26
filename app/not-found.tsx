import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-primary text-sm font-medium">404</p>
      <h1 className="text-4xl">We couldn&apos;t find that page</h1>
      <p className="text-muted-foreground max-w-sm">
        The link may be old or mistyped. Let&apos;s get you back on track.
      </p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </main>
  );
}
