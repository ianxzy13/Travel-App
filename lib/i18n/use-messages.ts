"use client";

import { useEffect, useState } from "react";
import { EN, loadMessages, type Messages } from "@/i18n/messages";

/** Loads one language's texts in the browser (e.g. for the website preview), English filling gaps. */
export function useLocaleMessages(locale: string): Messages {
  const [messages, setMessages] = useState<{ locale: string; messages: Messages }>({
    locale: "en",
    messages: EN,
  });
  useEffect(() => {
    let cancelled = false;
    loadMessages(locale).then((m) => !cancelled && setMessages({ locale, messages: m }));
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return messages.locale === locale ? messages.messages : EN;
}
