"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Link2, Loader2, Trash2, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  inviteCollaborator,
  removeMember,
  revokeInvitation,
  updateMemberRole,
} from "@/app/app/settings/actions";
import { initials } from "@/components/app/user-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormField } from "@/components/form-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MemberRole } from "@/lib/database.types";
import { fmtDate } from "@/lib/i18n/format";
import { inviteSchema, ROLES } from "@/lib/validation/wedding";

type Member = {
  id: string;
  role: MemberRole;
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};
type Invitation = { id: string; email: string; role: MemberRole; expiresAt: string; link: string };

function useCopy() {
  const t = useTranslations("collab");
  return async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("copied"));
    } catch {
      toast.error(t("copyFailed"));
    }
  };
}

export function Collaborators({
  currentUserId,
  isOwner,
  members,
  invitations,
}: {
  currentUserId: string;
  isOwner: boolean;
  members: Member[];
  invitations: Invitation[];
}) {
  const t = useTranslations("collab");
  return (
    <Card id="collaborators" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">{t("title")}</CardTitle>
        <CardDescription>
          {t("description")} {!isOwner && t("ownersOnly")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <ul className="divide-y">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isSelf={m.userId === currentUserId}
              isOwner={isOwner}
            />
          ))}
        </ul>

        {isOwner && (
          <>
            <InviteForm />
            {invitations.length > 0 && (
              <div>
                <h3 className="mb-2 font-sans text-sm font-medium">{t("pending")}</h3>
                <ul className="divide-y rounded-lg border">
                  {invitations.map((inv) => (
                    <InvitationRow key={inv.id} invitation={inv} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  isSelf,
  isOwner,
}: {
  member: Member;
  isSelf: boolean;
  isOwner: boolean;
}) {
  const t = useTranslations("collab");
  const roles = useTranslations("roles");
  const [pending, startTransition] = useTransition();
  const display = member.name ?? member.email ?? t("unknown");

  function changeRole(role: MemberRole) {
    startTransition(async () => {
      const result = await updateMemberRole(member.id, role);
      if (result.ok) toast.success(t("nowRole", { name: display, role: roles(`${role}.label`) }));
      else toast.error(result.error);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar className="size-9">
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt="" />}
        <AvatarFallback className="bg-primary-soft text-xs">{initials(display)}</AvatarFallback>
      </Avatar>
      {/* min width makes the role controls wrap below the name on narrow phones */}
      <div className="min-w-40 flex-1">
        <p className="truncate text-sm font-medium">
          {display} {isSelf && <span className="text-muted-foreground">{t("you")}</span>}
        </p>
        {member.name && member.email && (
          <p className="text-muted-foreground truncate text-xs">{member.email}</p>
        )}
      </div>

      {isOwner ? (
        <div className="ms-auto flex items-center gap-1">
          {pending && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />}
          <Select
            value={member.role}
            onValueChange={(v) => changeRole(v as MemberRole)}
            disabled={pending}
          >
            <SelectTrigger className="w-28" aria-label={t("roleFor", { name: display })}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {roles(`${r}.label`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isSelf && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={t("removeName", { name: display })}>
                  <Trash2 aria-hidden />
                </Button>
              }
              title={t("removeTitle", { name: display })}
              description={t("removeText")}
              confirmLabel={t("remove")}
              onConfirm={async () => {
                const result = await removeMember(member.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return false;
                }
                toast.success(t("removed", { name: display }));
              }}
            />
          )}
        </div>
      ) : (
        <Badge variant="secondary">{roles(`${member.role}.label`)}</Badge>
      )}
    </li>
  );
}

function InviteForm() {
  const t = useTranslations("collab");
  const roles = useTranslations("roles");
  const copy = useCopy();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const form = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "editor" as MemberRole },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await inviteCollaborator(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(result.data.link);
      form.reset({ email: "", role: values.role });
    }),
  );

  return (
    <div className="bg-muted/60 rounded-xl p-4 sm:p-5">
      <h3 className="mb-1 flex items-center gap-2 font-sans text-sm font-medium">
        <UserPlus className="size-4" aria-hidden /> {t("invite")}
      </h3>
      <p className="text-muted-foreground mb-4 text-sm">{t("inviteText")}</p>
      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start"
        noValidate
      >
        <FormField id="invite-email" label={t("email")} error={errors.email?.message}>
          {(aria) => (
            <Input
              {...aria}
              type="email"
              placeholder={t("emailPlaceholder")}
              {...form.register("email")}
            />
          )}
        </FormField>
        <FormField id="invite-role" label={t("role")} hint={roles(`${form.watch("role")}.description`)}>
          {(aria) => (
            <Controller
              control={form.control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...aria} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roles(`${r}.label`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          )}
        </FormField>
        <Button type="submit" disabled={pending} className="sm:mt-[1.375rem]">
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Link2 aria-hidden />}
          {t("create")}
        </Button>
      </form>

      {link && (
        <div role="status" className="bg-card mt-4 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{t("ready")}</p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={link}
              aria-label={t("link")}
              onFocus={(e) => e.target.select()}
            />
            <Button type="button" variant="outline" onClick={() => copy(link)}>
              <Copy aria-hidden /> {t("copy")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  const t = useTranslations("collab");
  const roles = useTranslations("roles");
  const locale = useLocale();
  const copy = useCopy();
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-40 flex-1">
        <p className="truncate text-sm">{invitation.email}</p>
        <p className="text-muted-foreground text-xs">
          {t("expires", {
            role: roles(`${invitation.role}.label`),
            date: fmtDate(invitation.expiresAt, locale, "medium"),
          })}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => copy(invitation.link)}>
        <Copy aria-hidden /> {t("copyLink")}
      </Button>
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("cancelFor", { email: invitation.email })}
          >
            <Trash2 aria-hidden />
          </Button>
        }
        title={t("cancelTitle")}
        description={t("cancelText", { email: invitation.email })}
        confirmLabel={t("cancelConfirm")}
        onConfirm={async () => {
          const result = await revokeInvitation(invitation.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(t("cancelled"));
        }}
      />
    </li>
  );
}
