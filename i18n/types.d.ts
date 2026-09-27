import type { Messages } from "./messages";
import type { Locale } from "./locales";

// Makes translation keys type-checked: t("rsvp.sendd") is a build error.
declare module "next-intl" {
  interface AppConfig {
    Messages: Messages;
    Locale: Locale;
  }
}
