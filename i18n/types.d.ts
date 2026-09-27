import type messages from "../messages/en.json";
import type { Locale } from "./locales";

// Makes translation keys type-checked: t("rsvp.sendd") is a build error.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
    Locale: Locale;
  }
}
