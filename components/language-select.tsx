"use client";

import { ChevronDown, Globe } from "lucide-react";
import { Flag } from "@/components/flag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOCALES, localeInfo } from "@/i18n/locales";
import { cn } from "@/lib/utils";

/** A language's flag and its own name ("🇸🇮 Slovenščina"). */
export function LanguageName({ code, className }: { code: string; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Flag locale={code} />
      <span lang={code} className="truncate">
        {localeInfo(code).native}
      </span>
    </span>
  );
}

/**
 * Pick a language from a list with flags. `featured` languages come first
 * (e.g. the ones a wedding already uses); `empty` adds a "none / default" choice.
 */
export function LanguageSelect({
  value,
  onChange,
  id,
  label,
  empty,
  featured = [],
  only,
  moreLabel,
  disabled,
  variant = "field",
  className,
}: {
  value: string;
  onChange: (code: string) => void;
  id?: string;
  /** accessible name of the button, e.g. "Language" */
  label: string;
  empty?: { label: string; hint?: string };
  featured?: readonly string[];
  /** offer only these languages */
  only?: readonly string[];
  moreLabel?: string;
  disabled?: boolean;
  /** "field" looks like an input; "link" is a quiet inline button (guest pages) */
  variant?: "field" | "link";
  className?: string;
}) {
  const pool = only ? LOCALES.filter((l) => only.includes(l.code)) : LOCALES;
  const first = pool.filter((l) => featured.includes(l.code));
  const rest = pool.filter((l) => !featured.includes(l.code));
  const item = (code: string) => (
    <DropdownMenuRadioItem key={code} value={code} className="gap-2">
      <Flag locale={code} />
      <span lang={code} className="flex-1">
        {localeInfo(code).native}
      </span>
      {localeInfo(code).native !== localeInfo(code).english && (
        <span className="text-muted-foreground text-xs" lang="en">
          {localeInfo(code).english}
        </span>
      )}
    </DropdownMenuRadioItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={id}
        disabled={disabled}
        aria-label={`${label}: ${value ? localeInfo(value).native : (empty?.label ?? "")}`}
        className={cn(
          variant === "field"
            ? "border-input bg-background hover:bg-accent/50 flex h-9 w-full min-w-0 items-center gap-2 rounded-md border px-3 text-start text-sm shadow-xs"
            : "inline-flex items-center gap-1.5 rounded py-1 text-sm font-medium underline-offset-4 hover:underline",
          "focus-visible:ring-ring focus-visible:ring-[3px] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        {value ? (
          <LanguageName code={value} className="flex-1" />
        ) : (
          <span className="text-muted-foreground inline-flex flex-1 items-center gap-2">
            <Globe className="size-4" aria-hidden /> {empty?.label}
          </span>
        )}
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-72">
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {empty && (
            <DropdownMenuRadioItem value="" className="gap-2">
              <Globe className="size-4" aria-hidden />
              <span className="flex-1">
                {empty.label}
                {empty.hint && (
                  <span className="text-muted-foreground block text-xs">{empty.hint}</span>
                )}
              </span>
            </DropdownMenuRadioItem>
          )}
          {first.map((l) => item(l.code))}
          {first.length > 0 && (
            <>
              <DropdownMenuSeparator />
              {moreLabel && (
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  {moreLabel}
                </DropdownMenuLabel>
              )}
            </>
          )}
          {rest.map((l) => item(l.code))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
