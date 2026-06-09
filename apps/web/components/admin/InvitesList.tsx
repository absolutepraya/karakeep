"use client";

import { ActionButton } from "@/components/ui/action-button";
import { ButtonWithTooltip } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Mail, MailX, UserPlus } from "lucide-react";

import { useTRPC } from "@karakeep/shared-react/trpc";

import ActionConfirmingDialog from "../ui/action-confirming-dialog";
import { AdminCard } from "./AdminCard";
import CreateInviteDialog from "./CreateInviteDialog";

export default function InvitesList() {
  const api = useTRPC();
  const queryClient = useQueryClient();
  const { data: invites } = useSuspenseQuery(api.invites.list.queryOptions());

  const { mutateAsync: revokeInvite, isPending: isRevokePending } = useMutation(
    api.invites.revoke.mutationOptions({
      onSuccess: () => {
        toast({
          description: "Invite revoked successfully",
        });
        queryClient.invalidateQueries(api.invites.list.pathFilter());
      },
      onError: (e) => {
        toast({
          variant: "destructive",
          description: `Failed to revoke invite: ${e.message}`,
        });
      },
    }),
  );

  const { mutateAsync: resendInvite, isPending: isResendPending } = useMutation(
    api.invites.resend.mutationOptions({
      onSuccess: () => {
        toast({
          description: "Invite resent successfully",
        });
        queryClient.invalidateQueries(api.invites.list.pathFilter());
      },
      onError: (e) => {
        toast({
          variant: "destructive",
          description: `Failed to resend invite: ${e.message}`,
        });
      },
    }),
  );

  const activeInvites = invites?.invites || [];
  const title = "Invites";

  return (
    <AdminCard>
      <div className="flex flex-col gap-4">
        <div className="mb-2 flex items-center justify-between text-xl font-medium">
          <span>User Invitations ({activeInvites.length})</span>
          <CreateInviteDialog>
            <ButtonWithTooltip tooltip="Send Invite" variant="outline">
              <UserPlus size={16} />
            </ButtonWithTooltip>
          </CreateInviteDialog>
        </div>

        <div className="mb-6">
          {activeInvites.length === 0 ? (
            <p className="text-sm text-gray-500">
              No {title.toLowerCase()} invites
            </p>
          ) : (
            <Table className="whitespace-nowrap">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>{invite.invitedBy.name}</TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(invite.createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <ButtonWithTooltip
                          tooltip="Resend Invite"
                          variant="outline"
                          size="sm"
                          onClick={() => resendInvite({ inviteId: invite.id })}
                          disabled={isResendPending}
                        >
                          <Mail size={14} />
                        </ButtonWithTooltip>
                        <ActionConfirmingDialog
                          title="Revoke Invite"
                          description={`Are you sure you want to revoke the invite for ${invite.email}? This action cannot be undone.`}
                          actionButton={(setDialogOpen) => (
                            <ActionButton
                              variant="destructive"
                              loading={isRevokePending}
                              onClick={async () => {
                                await revokeInvite({ inviteId: invite.id });
                                setDialogOpen(false);
                              }}
                            >
                              Revoke
                            </ActionButton>
                          )}
                        >
                          <ButtonWithTooltip
                            tooltip="Revoke Invite"
                            variant="outline"
                            size="sm"
                          >
                            <MailX size={14} color="red" />
                          </ButtonWithTooltip>
                        </ActionConfirmingDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </AdminCard>
  );
}
