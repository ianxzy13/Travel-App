"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

// "Welcome" in each of Vow's 25 languages, written in that language.
const WELCOMES: { lang: string; text: string }[] = [
  { lang: "en", text: "Welcome" },
  { lang: "sl", text: "Dobrodošli" },
  { lang: "de", text: "Willkommen" },
  { lang: "fr", text: "Bienvenue" },
  { lang: "es", text: "Bienvenidos" },
  { lang: "it", text: "Benvenuti" },
  { lang: "pt", text: "Bem-vindos" },
  { lang: "nl", text: "Welkom" },
  { lang: "pl", text: "Witamy" },
  { lang: "cs", text: "Vítejte" },
  { lang: "hr", text: "Dobro došli" },
  { lang: "sv", text: "Välkommen" },
  { lang: "el", text: "Καλώς ήρθατε" },
  { lang: "tr", text: "Hoş geldiniz" },
  { lang: "ru", text: "Добро пожаловать" },
  { lang: "uk", text: "Ласкаво просимо" },
  { lang: "ar", text: "أهلاً وسهلاً" },
  { lang: "hi", text: "स्वागत है" },
  { lang: "zh-CN", text: "欢迎" },
  { lang: "zh-TW", text: "歡迎" },
  { lang: "ja", text: "ようこそ" },
  { lang: "ko", text: "환영합니다" },
  { lang: "id", text: "Selamat datang" },
  { lang: "vi", text: "Chào mừng" },
  { lang: "th", text: "ยินดีต้อนรับ" },
];

/** A slow, endless strip of "Welcome" in every language guests can use. */
export function LanguageMarquee() {
  const t = useTranslations("landing");
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {WELCOMES.map((w) => (
        <li key={w.lang} lang={w.lang} className="flex items-center">
          <span className="px-6 font-serif text-2xl whitespace-nowrap sm:text-3xl">{w.text}</span>
          <span className="text-primary-ink" aria-hidden>
            ·
          </span>
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label={t("marquee")} className="bg-blush/35 overflow-hidden border-y py-8">
      <p className="eyebrow mb-6 text-center">{t("marquee")}</p>
      <div className="flex [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        {/* two copies side by side, moved left by exactly one copy, loop seamlessly */}
        <motion.div
          className="flex"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 60, ease: "linear", repeat: Infinity }}
        >
          {row(false)}
          {row(true)}
        </motion.div>
      </div>
    </section>
  );
}
