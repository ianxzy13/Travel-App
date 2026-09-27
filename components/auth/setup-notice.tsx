import { getTranslations } from "next-intl/server";

/** Shown instead of the login form until the Supabase keys are configured. */
export async function SetupNotice() {
  const t = await getTranslations("login");
  return (
    <div
      role="status"
      className="border-warning/40 bg-warning/10 space-y-2 rounded-lg border p-4 text-sm"
    >
      <p className="font-medium">{t("setupTitle")}</p>
      <p className="text-muted-foreground">
        {t.rich("setupText", { code: (c) => <code>{c}</code> })}
      </p>
    </div>
  );
}
