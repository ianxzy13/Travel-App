import "server-only";
import { getTranslations } from "next-intl/server";
import type { NameLabels } from "./model";

/** "Ann's guest" / "Unnamed guest" in the viewer's language, for loaders on the server. */
export async function nameLabels(): Promise<NameLabels> {
  const t = await getTranslations("guests");
  return { guestOf: (host) => t("guestOf", { name: host }), unnamed: t("unnamed") };
}
