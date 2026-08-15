"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { useTranslation } from "@/lib/i18n/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Loader2, Mail, X } from "lucide-react";

import { useTRPC } from "@karakeep/shared-react/trpc";

import { formatInvitationDate } from "./collaborationUi";

interface Invitation {
  id: string;
  role: "viewer" | "editor";
  recursive: boolean;
  expiresAt: Date;
  expired: boolean;
  list: {
    name: string;
    icon?: string;
    description?: string | null;
    owner?: { name?: string } | null;
  };
}

function InvitationRow({
  invitation,
  highlighted,
}: {
  invitation: Invitation;
  highlighted: boolean;
}) {
  const api = useTRPC();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries(
        api.lists.getPendingInvitations.pathFilter(),
      ),
      queryClient.invalidateQueries(api.lists.list.pathFilter()),
    ]);

  const acceptInvitation = useMutation(
    api.lists.acceptInvitation.mutationOptions({
      onSuccess: async () => {
        toast({ description: t("lists.invitations.accepted") });
        await invalidate();
      },
      onError: (error) =>
        toast({ variant: "destructive", description: error.message }),
    }),
  );
  const declineInvitation = useMutation(
    api.lists.declineInvitation.mutationOptions({
      onSuccess: async () => {
        toast({ description: t("lists.invitations.declined") });
        await invalidate();
      },
      onError: (error) =>
        toast({ variant: "destructive", description: error.message }),
    }),
  );

  return (
    <div
      id={`pending-invitation-${invitation.id}`}
      className={`rounded-lg border p-4 ${highlighted ? "ring-2 ring-primary ring-offset-2" : ""}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">
              {invitation.list.icon} {invitation.list.name}
            </span>
            <Badge variant="outline" className="capitalize">
              {invitation.role}
            </Badge>
            {invitation.recursive && (
              <Badge variant="secondary">Includes nested lists</Badge>
            )}
            {invitation.expired && <Badge variant="destructive">Expired</Badge>}
          </div>
          {invitation.list.description && (
            <div className="mt-1 text-sm text-muted-foreground">
              {invitation.list.description}
            </div>
          )}
          <div className="mt-2 text-sm text-muted-foreground">
            {t("lists.invitations.invited_by")}{" "}
            <span className="font-medium">
              {invitation.list.owner?.name || "Unknown"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock3 className="size-3" />
            {invitation.expired ? "Expired" : "Expires"}{" "}
            {formatInvitationDate(invitation.expiresAt)}
          </div>
          {invitation.expired && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ask the list owner to resend this invitation to renew it for 30
              days.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            disabled={
              invitation.expired ||
              declineInvitation.isPending ||
              acceptInvitation.isPending
            }
            onClick={() =>
              declineInvitation.mutate({ invitationId: invitation.id })
            }
          >
            {declineInvitation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <X className="mr-1 size-4" />
                {t("lists.invitations.decline")}
              </>
            )}
          </Button>
          <Button
            size="sm"
            disabled={
              invitation.expired ||
              acceptInvitation.isPending ||
              declineInvitation.isPending
            }
            onClick={() =>
              acceptInvitation.mutate({ invitationId: invitation.id })
            }
          >
            {acceptInvitation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-1 size-4" />
                {t("lists.invitations.accept")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PendingInvitationsCard() {
  const api = useTRPC();
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const highlightedInvitationId = searchParams.get("pendingInvitation");
  const { data: invitations, isLoading } = useQuery(
    api.lists.getPendingInvitations.queryOptions(),
  );

  useEffect(() => {
    if (!highlightedInvitationId || !invitations) return;
    if (!invitations.some((item) => item.id === highlightedInvitationId))
      return;
    document
      .getElementById(`pending-invitation-${highlightedInvitationId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedInvitationId, invitations]);

  if (isLoading || !invitations?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-normal">
          <Mail className="size-5" />
          {t("lists.invitations.pending")}
          <span className="rounded bg-secondary p-1 text-sm text-secondary-foreground">
            {invitations.length}
          </span>
        </CardTitle>
        <CardDescription>{t("lists.invitations.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {invitations.map((invitation) => (
          <InvitationRow
            key={invitation.id}
            invitation={invitation}
            highlighted={invitation.id === highlightedInvitationId}
          />
        ))}
      </CardContent>
    </Card>
  );
}
