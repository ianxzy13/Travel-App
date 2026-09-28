"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { saveMealTranslations } from "@/app/app/settings/language-actions";
import { TranslationsDialog } from "@/components/translations-dialog";
import type { Translations } from "@/lib/database.types";
import {
  deleteMealOption,
  saveMealOption,
  setEventMealChoice,
  updateRsvpSettings,
} from "@/app/app/rsvp/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { rsvpSettingsSchema, type RsvpSettingsValues } from "@/lib/validation/rsvp";

type Meal = { id: string; name: string; description: string | null; translations?: Translations };

export function RsvpSetup({
  settings,
  mealOptions,
  events,
  adminConfigured,
  emailConfigured,
  readOnly,
  languages = [],
}: {
  /** the wedding's languages, main first */
  languages?: string[];
  settings: RsvpSettingsValues;
  mealOptions: Meal[];
  events: { id: string; name: string; mealChoice: boolean }[];
  /** SUPABASE_SECRET_KEY set (needed for emailing the couple about replies) */
  adminConfigured: boolean;
  emailConfigured: boolean;
  readOnly: boolean;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <SettingsCard
        settings={settings}
        readOnly={readOnly}
        canNotify={adminConfigured && emailConfigured}
      />
      <div className="space-y-6">
        <MealsCard mealOptions={mealOptions} readOnly={readOnly} languages={languages} />
        <MealEventsCard events={events} readOnly={readOnly} hasMeals={mealOptions.length > 0} />
      </div>
    </div>
  );
}

function SettingsCard({
  settings,
  readOnly,
  canNotify,
}: {
  settings: RsvpSettingsValues;
  readOnly: boolean;
  canNotify: boolean;
}) {
  const t = useTranslations("rsvpAdmin.setup");
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(rsvpSettingsSchema), defaultValues: settings });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateRsvpSettings(values);
      if (result.ok) {
        toast.success(t("saved"));
        form.reset(values);
      } else toast.error(result.error);
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormField
            id="rsvp-deadline"
            label={t("deadline")}
            hint={t("deadlineHint")}
            error={errors.deadline?.message}
          >
            {(aria) => (
              <Input {...aria} type="date" disabled={readOnly} {...form.register("deadline")} />
            )}
          </FormField>
          <FormField
            id="rsvp-contact"
            label={t("contact")}
            hint={t("contactHint")}
            error={errors.contact?.message}
          >
            {(aria) => (
              <Textarea {...aria} rows={2} disabled={readOnly} {...form.register("contact")} />
            )}
          </FormField>
          <Toggle
            label={t("askSong")}
            control={
              <Controller
                control={form.control}
                name="askSong"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={readOnly}
                  />
                )}
              />
            }
          />
          <Toggle
            label={t("notify")}
            hint={canNotify ? t("notifyOn") : t("notifyOff")}
            control={
              <Controller
                control={form.control}
                name="notifyEmail"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={readOnly}
                  />
                )}
              />
            }
          />
          {!readOnly && (
            <div className="flex justify-end">
              <Button type="submit" disabled={pending || !form.formState.isDirty}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {t("save")}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function Toggle({
  label,
  hint,
  control,
}: {
  label: string;
  hint?: string;
  control: React.ReactNode;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="text-muted-foreground block text-sm">{hint}</span>}
      </span>
      {control}
    </label>
  );
}

function MealsCard({
  mealOptions,
  readOnly,
  languages,
}: {
  mealOptions: Meal[];
  readOnly: boolean;
  languages: string[];
}) {
  const tt = useTranslations("app.translate");
  const t = useTranslations("rsvpAdmin.setup");
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("mealsTitle")}</CardTitle>
        <CardDescription>{t("mealsText")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {mealOptions.length === 0 && editing !== "new" && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
            <UtensilsCrossed className="text-primary-ink size-6" aria-hidden />
            <p className="text-muted-foreground text-sm">{t("noMeals")}</p>
          </div>
        )}
        <ul className="divide-y rounded-lg border empty:hidden">
          {mealOptions.map((m) =>
            editing === m.id ? (
              <li key={m.id} className="p-3">
                <MealForm meal={m} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={m.id} className="flex items-center gap-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{m.name}</p>
                  {m.description && (
                    <p className="text-muted-foreground truncate text-xs">{m.description}</p>
                  )}
                </div>
                {!readOnly && (
                  <>
                    <TranslationsDialog
                      compact
                      title={tt("title", { name: m.name })}
                      fields={[
                        { key: "name", label: tt("fields.mealName"), max: 100 },
                        { key: "description", label: tt("fields.mealDescription"), max: 300 },
                      ]}
                      source={{ name: m.name, description: m.description }}
                      mainLanguage={languages[0] ?? "en"}
                      languages={languages.slice(1)}
                      value={m.translations ?? {}}
                      onSave={(tr) => saveMealTranslations(m.id, tr)}
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing(m.id)}
                      aria-label={t("edit", { name: m.name })}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("delete", { name: m.name })}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      }
                      title={t("deleteTitle", { name: m.name })}
                      description={t("deleteText")}
                      onConfirm={async () => {
                        const r = await deleteMealOption(m.id);
                        if (!r.ok) {
                          toast.error(r.error);
                          return false;
                        }
                      }}
                    />
                  </>
                )}
              </li>
            ),
          )}
        </ul>
        {!readOnly &&
          (editing === "new" ? (
            <MealForm onDone={() => setEditing(null)} />
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
              <Plus aria-hidden /> {t("addMeal")}
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}

function MealForm({ meal, onDone }: { meal?: Meal; onDone: () => void }) {
  const t = useTranslations("rsvpAdmin.setup");
  const [name, setName] = useState(meal?.name ?? "");
  const [description, setDescription] = useState(meal?.description ?? "");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await saveMealOption({ name, description }, meal?.id);
          if (r.ok) onDone();
          else toast.error(r.error);
        });
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("mealName")}
        aria-label={t("mealNameLabel")}
        maxLength={80}
        autoFocus
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("mealDescription")}
        aria-label={t("mealDescriptionLabel")}
        maxLength={300}
      />
      <div className="flex gap-1">
        <Button type="submit" size="sm" className="h-9" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {t("save2")}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </form>
  );
}

function MealEventsCard({
  events,
  readOnly,
  hasMeals,
}: {
  events: { id: string; name: string; mealChoice: boolean }[];
  readOnly: boolean;
  hasMeals: boolean;
}) {
  const t = useTranslations("rsvpAdmin.setup");
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("mealEvents")}</CardTitle>
        <CardDescription>{hasMeals ? t("mealEventsHint") : t("addMealsFirst")}</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noEvents")}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-3">
                <span className="text-sm">{e.name}</span>
                <Switch
                  checked={e.mealChoice}
                  disabled={readOnly || pending}
                  aria-label={t("askAt", { name: e.name })}
                  onCheckedChange={(on) =>
                    startTransition(async () => {
                      const r = await setEventMealChoice(e.id, on);
                      if (!r.ok) toast.error(r.error);
                    })
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
