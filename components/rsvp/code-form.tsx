"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CODE_PATTERN, normalizeCode } from "@/lib/rsvp/types";

/** "Enter the code from your invitation" box. */
export function CodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const clean = normalizeCode(code);
        if (!CODE_PATTERN.test(clean)) {
          setError("Codes have 6 letters and numbers, like K7P2QX.");
          return;
        }
        router.push(`/r/${clean}`);
      }}
    >
      <Label htmlFor="rsvp-code">Your RSVP code</Label>
      <div className="flex gap-2">
        <Input
          id="rsvp-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(null);
          }}
          placeholder="K7P2QX"
          autoComplete="off"
          autoCapitalize="characters"
          maxLength={10}
          aria-invalid={!!error}
          aria-describedby={error ? "code-err" : undefined}
          className="text-center font-mono text-lg tracking-[0.3em] uppercase"
        />
        <Button type="submit">
          Continue <ArrowRight aria-hidden />
        </Button>
      </div>
      {error && (
        <p id="code-err" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </form>
  );
}
