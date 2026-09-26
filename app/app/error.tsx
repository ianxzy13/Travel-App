"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** Friendly fallback if a page crashes. The real error is logged to the console. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="text-muted-foreground max-w-sm">
        We couldn&apos;t load this page. Please check your connection and try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
