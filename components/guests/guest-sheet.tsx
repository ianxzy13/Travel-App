"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Link2, Loader2, Plus, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import {
  addRelationship,
  createTag,
  deleteGuests,
  removeRelationship,
  saveGuest,
} from "@/app/app/guests/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { RelationshipType } from "@/lib/database.types";
import { AGE_GROUP_LABELS, fullName, type GuestView, type PartnerNames } from "@/lib/guests/model";
import { cn } from "@/lib/utils";
import { emptyAddress, guestFormSchema, type GuestFormValues } from "@/lib/validation/guest";
import { TAG_COLOR_CLASSES } from "./badges";
import type { EventOption, HouseholdOption, RelationshipItem, TagOption } from "./types";

/** What the sheet is showing: a new guest (optionally in a household) or an existing one. */
export type SheetMode =
  { kind: "new"; householdId?: string } | { kind: "edit"; guest: GuestView } | null;

type Props = {
  mode: SheetMode;
  onModeChange: (mode: SheetMode) => void;
  guests: GuestView[];
  households: HouseholdOption[];
  events: EventOption[];
  tags: TagOption[];
  relationships: RelationshipItem[];
  names: PartnerNames;
};

export function GuestSheet(props: Props) {
  const { mode, onModeChange } = props;
  // A new key re-creates the form with fresh default values for each guest.
  const formKey = mode
    ? mode.kind === "edit"
      ? mode.guest.id
      : `new-${mode.householdId ?? ""}`
    : "none";

  return (
    <Sheet open={mode !== null} onOpenChange={(open) => !open && onModeChange(null)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {mode && <GuestForm key={formKey} {...props} mode={mode} />}
      </SheetContent>
    </Sheet>
  );
}

function defaultValues(mode: NonNullable<SheetMode>, p: Props): GuestFormValues {
  const allEvents = p.events.map((e) => e.id);
  if (mode.kind === "new") {
    const h = p.households.find((x) => x.id === mode.householdId);
    return {
      isPlusOne: false,
      householdId: h?.id ?? "new",
      householdName: h?.name ?? "",
      address: h?.address ?? emptyAddress,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      side: "both",
      ageGroup: "adult",
      list: "a",
      plusOneAllowed: false,
      plusOneName: "",
      dietary: "",
      accessibility: "",
      notes: "",
      eventIds: allEvents,
      tagIds: [],
    };
  }
  const g = mode.guest;
  const h = p.households.find((x) => x.id === g.householdId);
  const plusOne = p.guests.find((x) => x.plusOneOf === g.id);
  return {
    isPlusOne: !!g.plusOneOf,
    householdId: g.householdId,
    householdName: h?.name ?? "",
    address: h?.address ?? emptyAddress,
    firstName: g.firstName,
    lastName: g.lastName,
    email: g.email ?? "",
    phone: g.phone ?? "",
    side: g.side,
    ageGroup: g.ageGroup,
    list: g.list,
    plusOneAllowed: g.plusOneAllowed,
    plusOneName: plusOne ? fullName(plusOne.firstName, plusOne.lastName) : "",
    dietary: g.dietary ?? "",
    accessibility: g.accessibility ?? "",
    notes: g.notes ?? "",
    eventIds: g.eventIds,
    tagIds: g.tagIds,
  };
}

function GuestForm(props: Props & { mode: NonNullable<SheetMode> }) {
  const { mode, onModeChange, households, events, names, guests } = props;
  const editing = mode.kind === "edit" ? mode.guest : null;
  const isPlusOne = !!editing?.plusOneOf;
  const host = isPlusOne ? guests.find((g) => g.id === editing?.plusOneOf) : null;

  const [pending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(guestFormSchema),
    defaultValues: defaultValues(mode, props),
  });
  const { errors } = form.formState;
  const householdId = form.watch("householdId");
  const plusOneAllowed = form.watch("plusOneAllowed");

  function submit(addAnother: boolean) {
    return form.handleSubmit((values) =>
      startTransition(async () => {
        const result = await saveGuest(values, editing?.id);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        const name = fullName(values.firstName, values.lastName) || "Guest";
        toast.success(editing ? `${name} saved` : `${name} added`);
        onModeChange(addAnother ? { kind: "new", householdId: result.data.householdId } : null);
      }),
    )();
  }

  return (
    <>
      <SheetHeader className="border-b px-6 py-4">
        <SheetTitle className="font-serif text-3xl">
          {editing ? editing.name : "Add a guest"}
        </SheetTitle>
        <SheetDescription>
          {isPlusOne
            ? `Plus-one of ${host?.name ?? "a guest"}. Household, side and events follow ${host?.firstName || "them"}.`
            : "Only a name is required. You can fill in the rest later."}
        </SheetDescription>
      </SheetHeader>

      <form
        id="guest-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="flex-1 space-y-8 overflow-y-auto px-6 py-6"
        noValidate
      >
        {/* ---------- name & contact ---------- */}
        <Section title="Name & contact">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="g-first" label="First name" error={errors.firstName?.message}>
              {(aria) => <Input {...aria} autoFocus={!editing} {...form.register("firstName")} />}
            </FormField>
            <FormField id="g-last" label="Last name" error={errors.lastName?.message}>
              {(aria) => <Input {...aria} {...form.register("lastName")} />}
            </FormField>
            <FormField id="g-email" label="Email" error={errors.email?.message}>
              {(aria) => (
                <Input {...aria} type="email" autoComplete="off" {...form.register("email")} />
              )}
            </FormField>
            <FormField id="g-phone" label="Phone" error={errors.phone?.message}>
              {(aria) => (
                <Input {...aria} type="tel" autoComplete="off" {...form.register("phone")} />
              )}
            </FormField>
          </div>
        </Section>

        {/* ---------- household ---------- */}
        {!isPlusOne && (
          <Section
            title="Household"
            hint="Invitations and RSVP links go to a household, e.g. “The Smith Family”."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="g-household" label="Household">
                {(aria) => (
                  <Controller
                    control={form.control}
                    name="householdId"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          const h = households.find((x) => x.id === value);
                          form.setValue("householdName", h?.name ?? "");
                          form.setValue("address", h?.address ?? emptyAddress);
                        }}
                      >
                        <SelectTrigger {...aria} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">+ New household</SelectItem>
                          {[...households]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((h) => (
                              <SelectItem key={h.id} value={h.id}>
                                {h.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </FormField>
              <FormField
                id="g-household-name"
                label={householdId === "new" ? "New household name" : "Household name"}
                hint={householdId === "new" ? "Leave empty to use the guest's name." : undefined}
                error={errors.householdName?.message}
              >
                {(aria) => (
                  <Input
                    {...aria}
                    placeholder="e.g. The Smith Family"
                    {...form.register("householdName")}
                  />
                )}
              </FormField>
            </div>
            <AddressFields form={form} />
          </Section>
        )}

        {/* ---------- invitation ---------- */}
        <Section title="Invitation">
          {!isPlusOne && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Whose side?</legend>
              <Controller
                control={form.control}
                name="side"
                render={({ field }) => (
                  <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex flex-wrap gap-4"
                  >
                    {(
                      [
                        ["partner_a", names.a],
                        ["partner_b", names.b],
                        ["both", "Both"],
                      ] as const
                    ).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value={value} /> {label}
                      </label>
                    ))}
                  </RadioGroup>
                )}
              />
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="g-age" label="Age group">
              {(aria) => (
                <Controller
                  control={form.control}
                  name="ageGroup"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger {...aria} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
            </FormField>
            {!isPlusOne && (
              <FormField id="g-list" label="List" hint="B-list guests are invited if space allows.">
                {(aria) => (
                  <Controller
                    control={form.control}
                    name="list"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger {...aria} className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a">A-list</SelectItem>
                          <SelectItem value="b">B-list (waitlist)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </FormField>
            )}
          </div>

          {!isPlusOne && events.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Invited to</legend>
              <Controller
                control={form.control}
                name="eventIds"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {events.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value.includes(e.id)}
                          onCheckedChange={(c) =>
                            field.onChange(
                              c ? [...field.value, e.id] : field.value.filter((id) => id !== e.id),
                            )
                          }
                        />
                        {e.name}
                      </label>
                    ))}
                  </div>
                )}
              />
            </fieldset>
          )}

          {!isPlusOne && (
            <div className="space-y-3 rounded-lg border p-4">
              <label className="flex items-center justify-between gap-4 text-sm font-medium">
                Allow a plus-one
                <Controller
                  control={form.control}
                  name="plusOneAllowed"
                  render={({ field }) => (
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </label>
              {plusOneAllowed && (
                <FormField
                  id="g-plus-one"
                  label="Plus-one's name"
                  hint="Leave empty if you don't know it yet."
                  error={errors.plusOneName?.message}
                >
                  {(aria) => <Input {...aria} {...form.register("plusOneName")} />}
                </FormField>
              )}
            </div>
          )}
        </Section>

        {/* ---------- tags ---------- */}
        <Section title="Tags">
          <TagPicker form={form} tags={props.tags} />
        </Section>

        {/* ---------- needs & notes ---------- */}
        <Section title="Needs & notes">
          <FormField id="g-diet" label="Dietary restrictions" error={errors.dietary?.message}>
            {(aria) => (
              <Input
                {...aria}
                placeholder="e.g. Vegetarian, nut allergy"
                {...form.register("dietary")}
              />
            )}
          </FormField>
          <FormField
            id="g-access"
            label="Accessibility needs"
            error={errors.accessibility?.message}
          >
            {(aria) => (
              <Input
                {...aria}
                placeholder="e.g. Wheelchair user"
                {...form.register("accessibility")}
              />
            )}
          </FormField>
          <FormField id="g-notes" label="Notes" error={errors.notes?.message}>
            {(aria) => <Textarea {...aria} rows={3} {...form.register("notes")} />}
          </FormField>
        </Section>

        {editing && (
          <Section
            title="Seating rules"
            hint="Used by the seating chart to warn you and to auto-arrange tables."
          >
            <RelationshipsEditor
              guest={editing}
              guests={guests}
              relationships={props.relationships}
            />
          </Section>
        )}
      </form>

      <SheetFooter className="flex-row flex-wrap items-center gap-2 border-t px-6 py-4">
        {editing && (
          <ConfirmDialog
            trigger={
              <Button variant="ghost" className="text-destructive mr-auto" disabled={pending}>
                <Trash2 aria-hidden /> Delete
              </Button>
            }
            title={`Delete ${editing.name}?`}
            description="Their plus-one, invitations, tags and seating rules will be deleted too."
            onConfirm={async () => {
              const result = await deleteGuests([editing.id]);
              if (!result.ok) {
                toast.error(result.error);
                return false;
              }
              toast.success(`${editing.name} deleted`);
              onModeChange(null);
            }}
          />
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!editing && (
            <Button type="button" variant="outline" disabled={pending} onClick={() => submit(true)}>
              Save &amp; add to household
            </Button>
          )}
          <Button type="submit" form="guest-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}
            {editing ? "Save changes" : "Add guest"}
          </Button>
        </div>
      </SheetFooter>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl">{title}</h3>
        {hint && <p className="text-muted-foreground text-sm">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function AddressFields({ form }: { form: UseFormReturn<GuestFormValues> }) {
  const e = form.formState.errors.address;
  return (
    <details className="group rounded-lg border p-4 [&[open]]:pb-5">
      <summary className="cursor-pointer text-sm font-medium">
        Mailing address{" "}
        <span className="text-muted-foreground font-normal">(for the household)</span>
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <FormField
          id="a-1"
          label="Address line 1"
          error={e?.line1?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} autoComplete="off" {...form.register("address.line1")} />}
        </FormField>
        <FormField
          id="a-2"
          label="Address line 2"
          error={e?.line2?.message}
          className="sm:col-span-2"
        >
          {(aria) => <Input {...aria} autoComplete="off" {...form.register("address.line2")} />}
        </FormField>
        <FormField id="a-city" label="City" error={e?.city?.message}>
          {(aria) => <Input {...aria} autoComplete="off" {...form.register("address.city")} />}
        </FormField>
        <FormField id="a-region" label="State / region" error={e?.region?.message}>
          {(aria) => <Input {...aria} autoComplete="off" {...form.register("address.region")} />}
        </FormField>
        <FormField id="a-zip" label="Postal code" error={e?.postalCode?.message}>
          {(aria) => (
            <Input {...aria} autoComplete="off" {...form.register("address.postalCode")} />
          )}
        </FormField>
        <FormField id="a-country" label="Country" error={e?.country?.message}>
          {(aria) => <Input {...aria} autoComplete="off" {...form.register("address.country")} />}
        </FormField>
      </div>
    </details>
  );
}

/** Toggle existing tags, or type a new one. */
function TagPicker({ form, tags }: { form: UseFormReturn<GuestFormValues>; tags: TagOption[] }) {
  const [newTag, setNewTag] = useState("");
  const [pending, startTransition] = useTransition();

  function create() {
    const name = newTag.trim();
    if (!name) return;
    startTransition(async () => {
      const result = await createTag({ name, color: "stone" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      form.setValue("tagIds", [...form.getValues("tagIds"), result.data.tag.id], {
        shouldDirty: true,
      });
      setNewTag("");
    });
  }

  return (
    <Controller
      control={form.control}
      name="tagIds"
      render={({ field }) => (
        <div className="space-y-3">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => {
                const on = field.value.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      field.onChange(
                        on ? field.value.filter((id) => id !== t.id) : [...field.value, t.id],
                      )
                    }
                    className={cn(
                      "focus-visible:ring-ring inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm transition focus-visible:ring-2 focus-visible:outline-none",
                      on
                        ? TAG_COLOR_CLASSES[t.color] + " ring-foreground/30 ring-1"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {on && <Check className="size-3.5" aria-hidden />}
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
              placeholder={tags.length ? "New tag…" : "Create your first tag, e.g. Family"}
              aria-label="New tag name"
              maxLength={40}
            />
            <Button
              type="button"
              variant="outline"
              onClick={create}
              disabled={pending || !newTag.trim()}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              Add
            </Button>
          </div>
        </div>
      )}
    />
  );
}

/** "Keep together with…" / "Keep apart from…" rules for one guest. */
function RelationshipsEditor({
  guest,
  guests,
  relationships,
}: {
  guest: GuestView;
  guests: GuestView[];
  relationships: RelationshipItem[];
}) {
  const [type, setType] = useState<RelationshipType>("keep_apart");
  const [other, setOther] = useState("");
  const [pending, startTransition] = useTransition();
  const byId = new Map(guests.map((g) => [g.id, g]));
  const mine = relationships.filter((r) => r.guestA === guest.id || r.guestB === guest.id);
  const taken = new Set(mine.map((r) => (r.guestA === guest.id ? r.guestB : r.guestA)));
  const options = guests
    .filter((g) => g.id !== guest.id && !taken.has(g.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  function add() {
    startTransition(async () => {
      const result = await addRelationship({ guestA: guest.id, guestB: other, type, note: "" });
      if (result.ok) setOther("");
      else toast.error(result.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await removeRelationship(id);
      if (!result.ok) toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {mine.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {mine.map((r) => {
            const otherGuest = byId.get(r.guestA === guest.id ? r.guestB : r.guestA);
            const together = r.type === "keep_together";
            return (
              <li key={r.id} className="flex items-center gap-2 p-2 pl-3 text-sm">
                {together ? (
                  <Link2 className="text-success size-4" aria-hidden />
                ) : (
                  <Unlink className="text-destructive size-4" aria-hidden />
                )}
                <span className="flex-1">
                  {together ? "Keep together with " : "Keep apart from "}
                  <strong>{otherGuest?.name ?? "a removed guest"}</strong>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => remove(r.id)}
                  aria-label="Remove rule"
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <div>
          <Label htmlFor="rel-type" className="sr-only">
            Rule
          </Label>
          <Select value={type} onValueChange={(v) => setType(v as RelationshipType)}>
            <SelectTrigger id="rel-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="keep_apart">Keep apart from</SelectItem>
              <SelectItem value="keep_together">Keep together with</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="rel-guest" className="sr-only">
            Guest
          </Label>
          <Select value={other} onValueChange={setOther}>
            <SelectTrigger id="rel-guest" className="w-full">
              <SelectValue placeholder="Choose a guest" />
            </SelectTrigger>
            <SelectContent>
              {options.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={add} disabled={!other || pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
          Add rule
        </Button>
      </div>
    </div>
  );
}
