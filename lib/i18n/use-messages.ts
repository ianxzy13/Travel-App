"use client";

import { useEffect, useState } from "react";
import en from "@/messages/en.json";
import { withFallback } from "@/i18n/resolve";

type Messages = typeof en;

/** Loads one language's texts in the browser (e.g. for the website preview), English filling gaps. */
export function useLocaleMessages(locale: string): Messages {
  const [messages, setMessages] = useState<{ locale: string; messages: Messages }>({
    locale: "en",
    messages: en,
  });
  useEffect(() => {
    if (locale === "en") return setMessages({ locale, messages: en });
    let cancelled = false;
    import(`@/messages/${locale}.json`)
      .then(
        (m) =>
          !cancelled &&
          setMessages({ locale, messages: withFallback(m.default as Partial<Messages>, en) }),
      )
      .catch(() => !cancelled && setMessages({ locale, messages: en }));
    return () => {
      cancelled = true;
    };
  }, [locale]);
  return messages.locale === locale ? messages.messages : en;
}
