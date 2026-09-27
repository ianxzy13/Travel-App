import { useTranslations } from "next-intl";
import { tableName, type SeatingWords } from "@/lib/seating/geometry";
import type { TableIssue } from "@/lib/seating/rules";
import type { SeatingObject } from "@/lib/seating/types";

/** Table names and warnings in the viewer's language (works on the server and in the browser). */
export function useSeatingWords() {
  const t = useTranslations("seating");
  const words: SeatingWords = { table: (n) => t("table", { n }), kind: (k) => t(`kinds.${k}`) };
  return {
    t,
    words,
    tableName: (o: Pick<SeatingObject, "label" | "number" | "kind">) => tableName(o, words),
    issueText: (i: Pick<TableIssue, "type" | "names">) =>
      t(`issues.${i.type}`, { a: i.names[0] || t("aGuest"), b: i.names[1] || t("aGuest") }),
  };
}
