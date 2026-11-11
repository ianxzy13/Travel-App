// Loads Paddle.js (the payment window) once, in the browser.
import { PADDLE_CLIENT_TOKEN, PADDLE_ENV } from "@/lib/billing/config";

type PaddleEvent = { name?: string };
export type PaddleJs = {
  Environment: { set: (env: "sandbox") => void };
  Initialize: (o: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
  Checkout: {
    open: (o: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
      settings?: {
        displayMode?: "overlay";
        locale?: string;
        successUrl?: string;
        theme?: "light" | "dark";
      };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleJs;
  }
}

const SCRIPT = "https://cdn.paddle.com/paddle/v2/paddle.js";
let loading: Promise<PaddleJs> | null = null;

export function loadPaddle(onEvent?: (e: PaddleEvent) => void): Promise<PaddleJs> {
  loading ??= new Promise<PaddleJs>((resolve, reject) => {
    const ready = () => {
      const p = window.Paddle;
      if (!p) return reject(new Error("Paddle.js missing"));
      if (PADDLE_ENV === "sandbox") p.Environment.set("sandbox");
      p.Initialize({ token: PADDLE_CLIENT_TOKEN, eventCallback: (e) => onEvent?.(e) });
      resolve(p);
    };
    if (window.Paddle) return ready();
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = ready;
    s.onerror = () => {
      loading = null;
      reject(new Error("Paddle.js failed to load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

// Languages we know the Paddle checkout speaks; anything else shows English.
const PADDLE_LOCALES: Record<string, string> = {
  ar: "ar",
  cs: "cs",
  de: "de",
  en: "en",
  es: "es",
  fr: "fr",
  it: "it",
  ja: "ja",
  ko: "ko",
  nl: "nl",
  pl: "pl",
  pt: "pt",
  ru: "ru",
  sv: "sv",
  tr: "tr",
  "zh-CN": "zh-Hans",
};

export const paddleLocale = (locale: string) => PADDLE_LOCALES[locale] ?? "en";
