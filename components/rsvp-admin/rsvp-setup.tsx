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
  const [pending, startTransition] = useTransition();
  const form = useForm({ resolver: zodResolver(rsvpSettingsSchema), defaultValues: settings });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await updateRsvpSettings(values);
      if (result.ok) {
        toast.success("RSVP settings saved");
        form.reset(values);
      } else toast.error(result.error);
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">RSVP settings</CardTitle>
        <CardDescription>What guests see on their RSVP page.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <FormField
            id="rsvp-deadline"
            label="Reply by"
            hint="After this date guests can't change their answers online."
            error={errors.deadline?.message}
          >
            {(aria) => (
              <Input {...aria} type="date" disabled={readOnly} {...form.register("deadline")} />
            )}
          </FormField>
          <FormField
            id="rsvp-contact"
            label="After the deadline, tell guests…"
            hint="e.g. “Message Maria on +351 912 345 678”"
            error={errors.contact?.message}
          >
            {(aria) => (
              <Textarea {...aria} rows={2} disabled={readOnly} {...form.register("contact")} />
            )}
          </FormField>
          <Toggle
            label="Ask for a song request"
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
            label="Email me when someone replies"
            hint={
              canNotify
                ? "Sent to owners and editors, in addition to the bell in the app."
                : "Needs Resend and the Supabase secret key (see README). You'll still get in-app notifications."
            }
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
                Save settings
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
  const [editing, setEditing] = useState<string | "new" | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Meal options</CardTitle>
        <CardDescription>
          Guests choose one when they accept an event that asks for meals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {mealOptions.length === 0 && editing !== "new" && (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center">
            <UtensilsCrossed className="text-primary size-6" aria-hidden />
            <p className="text-muted-foreground text-sm">
              No meal options yet, so guests won&apos;t be asked. Add e.g. “Beef”, “Fish”,
              “Vegetarian”, “Children&apos;s menu”.
            </p>
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
                      aria-label={`Edit ${m.name}`}
                    >
                      <Pencil aria-hidden />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${m.name}`}>
                          <Trash2 aria-hidden />
                        </Button>
                      }
                      title={`Delete “${m.name}”?`}
                      description="Guests who picked it will keep their RSVP but lose the meal choice."
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
              <Plus aria-hidden /> Add meal option
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}

function MealForm({ meal, onDone }: { meal?: Meal; onDone: () => void }) {
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
        placeholder="Name, e.g. Fish"
        aria-label="Meal name"
        maxLength={80}
        autoFocus
      />
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        aria-label="Meal description"
        maxLength={300}
      />
      <div className="flex gap-1">
        <Button type="submit" size="sm" className="h-9" disabled={pending || !name.trim()}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onDone}>
          Cancel
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
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Which events ask for a meal?</CardTitle>
        <CardDescription>
          {hasMeals ? "Usually just the reception dinner." : "Add meal options first."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No events yet. Add them in Settings.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between p-3">
                <span className="text-sm">{e.name}</span>
                <Switch
                  checked={e.mealChoice}
                  disabled={readOnly || pending}
                  aria-label={`Ask for a meal choice at ${e.name}`}
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
