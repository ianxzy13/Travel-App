"use client";

import { setRsvpLanguage } from "@/app/r/actions";
import { LanguageSwitcher } from "@/components/language-switcher";

/** Language picker on RSVP pages; on a household's own page the choice is saved for their emails. */
export function RsvpLanguageSwitcher({ offered, code }: { offered: string[]; code?: string }) {
  return (
    <LanguageSwitcher
      offered={offered}
      onChange={code ? (lang) => void setRsvpLanguage(code, lang) : undefined}
    />
  );
}
