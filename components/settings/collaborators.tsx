"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { Copy, Link2, Loader2, Trash2, UserPlus } from "lucide-react";
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
import { inviteSchema, ROLE_LABELS } from "@/lib/validation/wedding";

type Member = {
  id: string;
  role: MemberRole;
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};
type Invitation = { id: string; email: string; role: MemberRole; expiresAt: string; link: string };

const ROLES = Object.keys(ROLE_LABELS) as MemberRole[];

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Invite link copied");
  } catch {
    toast.error("Couldn't copy automatically. Please select the link and copy it.");
  }
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
  return (
    <Card id="collaborators" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Collaborators</CardTitle>
        <CardDescription>
          Plan together with your partner, family or wedding planner.
          {!isOwner && " Only owners can invite people or change roles."}
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
                <h3 className="mb-2 font-sans text-sm font-medium">Pending invitations</h3>
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
  const [pending, startTransition] = useTransition();
  const display = member.name ?? member.email ?? "Unknown";

  function changeRole(role: MemberRole) {
    startTransition(async () => {
      const result = await updateMemberRole(member.id, role);
      if (result.ok) toast.success(`${display} is now ${ROLE_LABELS[role].label.toLowerCase()}`);
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
          {display} {isSelf && <span className="text-muted-foreground">(you)</span>}
        </p>
        {member.name && member.email && (
          <p className="text-muted-foreground truncate text-xs">{member.email}</p>
        )}
      </div>

      {isOwner ? (
        <div className="ml-auto flex items-center gap-1">
          {pending && <Loader2 className="text-muted-foreground size-4 animate-spin" aria-hidden />}
          <Select
            value={member.role}
            onValueChange={(v) => changeRole(v as MemberRole)}
            disabled={pending}
          >
            <SelectTrigger className="w-28" aria-label={`Role for ${display}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isSelf && (
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label={`Remove ${display}`}>
                  <Trash2 aria-hidden />
                </Button>
              }
              title={`Remove ${display}?`}
              description="They will lose access to this wedding straight away. You can invite them again later."
              confirmLabel="Remove"
              onConfirm={async () => {
                const result = await removeMember(member.id);
                if (!result.ok) {
                  toast.error(result.error);
                  return false;
                }
                toast.success(`${display} was removed`);
              }}
            />
          )}
        </div>
      ) : (
        <Badge variant="secondary">{ROLE_LABELS[member.role].label}</Badge>
      )}
    </li>
  );
}

function InviteForm() {
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
        <UserPlus className="size-4" aria-hidden /> Invite someone
      </h3>
      <p className="text-muted-foreground mb-4 text-sm">
        We&apos;ll create a private link. Send it by email or WhatsApp; it works once and expires in
        30 days.
      </p>
      <form
        onSubmit={onSubmit}
        className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-start"
        noValidate
      >
        <FormField id="invite-email" label="Email" error={errors.email?.message}>
          {(aria) => (
            <Input
              {...aria}
              type="email"
              placeholder="partner@example.com"
              {...form.register("email")}
            />
          )}
        </FormField>
        <FormField id="invite-role" label="Role" hint={ROLE_LABELS[form.watch("role")].description}>
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
                        {ROLE_LABELS[r].label}
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
          Create invite link
        </Button>
      </form>

      {link && (
        <div role="status" className="bg-card mt-4 space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Invite link ready. Send it to them:</p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={link}
              aria-label="Invite link"
              onFocus={(e) => e.target.select()}
            />
            <Button type="button" variant="outline" onClick={() => copy(link)}>
              <Copy aria-hidden /> Copy
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-40 flex-1">
        <p className="truncate text-sm">{invitation.email}</p>
        <p className="text-muted-foreground text-xs">
          {ROLE_LABELS[invitation.role].label} · expires{" "}
          {format(parseISO(invitation.expiresAt), "d MMM")}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => copy(invitation.link)}>
        <Copy aria-hidden /> Copy link
      </Button>
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Cancel invitation for ${invitation.email}`}
          >
            <Trash2 aria-hidden />
          </Button>
        }
        title="Cancel this invitation?"
        description={`The link sent to ${invitation.email} will stop working.`}
        confirmLabel="Cancel invitation"
        onConfirm={async () => {
          const result = await revokeInvitation(invitation.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success("Invitation cancelled");
        }}
      />
    </li>
  );
}
