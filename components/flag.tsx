import type { FlagComponent } from "country-flag-icons/react/3x2";
import {
  CN,
  CZ,
  DE,
  ES,
  FR,
  GB,
  GR,
  HR,
  ID,
  IN,
  IT,
  JP,
  KR,
  NL,
  PL,
  PT,
  RU,
  SA,
  SE,
  SI,
  TH,
  TR,
  TW,
  UA,
  VN,
} from "country-flag-icons/react/3x2";
import { localeInfo } from "@/i18n/locales";
import { cn } from "@/lib/utils";

const FLAGS: Record<string, FlagComponent> = {
  CN,
  CZ,
  DE,
  ES,
  FR,
  GB,
  GR,
  HR,
  ID,
  IN,
  IT,
  JP,
  KR,
  NL,
  PL,
  PT,
  RU,
  SA,
  SE,
  SI,
  TH,
  TR,
  TW,
  UA,
  VN,
};

/** A small flag for a language (decorative: the language name is always shown next to it). */
export function Flag({ locale, className }: { locale: string; className?: string }) {
  const Svg = FLAGS[localeInfo(locale).flag];
  return (
    <Svg
      aria-hidden
      focusable="false"
      className={cn(
        "inline-block h-3.5 w-auto shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.12)]",
        className,
      )}
    />
  );
}
