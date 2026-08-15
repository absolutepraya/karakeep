"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ResponsiveDialogContent,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useTranslation } from "@/lib/i18n/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock3,
  Loader2,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

import { useTRPC } from "@karakeep/shared-react/trpc";
import { ZBookmarkList } from "@karakeep/shared/types/lists";

import {
  canManageCollaboratorOnList,
  collaboratorRemovalMessage,
  invitationDeliveryMessage,
} from "./collaborationUi";

export function ManageCollaboratorsModal({
  open: userOpen,
  setOpen: userSetOpen,
  list,
  children,
  readOnly = false,
}: {
  open?: boolean;
  setOpen?: (v: boolean) => void;
  list: ZBookmarkList;
  children?: React.ReactNode;
  readOnly?: boolean;
}) {
  const api = useTRPC();
  if (
    (userOpen !== undefined && !userSetOpen) ||
    (userOpen === undefined && userSetOpen)
  ) {
    throw new Error("You must provide both open and setOpen or neither");
  }
  const [customOpen, customSetOpen] = useState(false);
  const [open, setOpen] = [
    userOpen ?? customOpen,
    userSetOpen ?? customSetOpen,
  ];

  const [newCollaboratorEmail, setNewCollaboratorEmail] = useState("");
  const [newCollaboratorRole, setNewCollaboratorRole] = useState<
    "viewer" | "editor"
  >("viewer");
  const [newCollaboratorRecursive, setNewCollaboratorRecursive] =
    useState(false);

  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const invalidateListCaches = () =>
    Promise.all([
      queryClient.invalidateQueries(
        api.lists.getCollaborators.queryFilter({ listId: list.id }),
      ),
      queryClient.invalidateQueries(
        api.lists.get.queryFilter({ listId: list.id }),
      ),
      queryClient.invalidateQueries(api.lists.list.pathFilter()),
      queryClient.invalidateQueries(
        api.lists.getPendingInvitations.pathFilter(),
      ),
      queryClient.invalidateQueries(
        api.bookmarks.getBookmarks.queryFilter({ listId: list.id }),
      ),
      queryClient.invalidateQueries(
        api.bookmarks.getBookmarks.infiniteQueryFilter({ listId: list.id }),
      ),
    ]);

  const { data: collaboratorsData, isLoading } = useQuery(
    api.lists.getCollaborators.queryOptions(
      { listId: list.id },
      { enabled: open },
    ),
  );

  const addCollaborator = useMutation(
    api.lists.addCollaborator.mutationOptions({
      onSuccess: async (result) => {
        toast({
          description: invitationDeliveryMessage(result.emailSent),
        });
        setNewCollaboratorEmail("");
        setNewCollaboratorRole("viewer");
        setNewCollaboratorRecursive(false);
        await invalidateListCaches();
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          description: error.message || t("lists.collaborators.failed_to_add"),
        });
      },
    }),
  );

  const removeCollaborator = useMutation(
    api.lists.removeCollaborator.mutationOptions({
      onSuccess: async () => {
        toast({ description: t("lists.collaborators.removed") });
        await invalidateListCaches();
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          description:
            error.message || t("lists.collaborators.failed_to_remove"),
        });
      },
    }),
  );

  const updateCollaborator = useMutation(
    api.lists.updateCollaborator.mutationOptions({
      onSuccess: async () => {
        toast({ description: t("lists.collaborators.role_updated") });
        await invalidateListCaches();
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          description:
            error.message || t("lists.collaborators.failed_to_update_role"),
        });
      },
    }),
  );

  const updateInvitation = useMutation(
    api.lists.updateInvitation.mutationOptions({
      onSuccess: invalidateListCaches,
      onError: (error) => {
        toast({
          variant: "destructive",
          description: error.message,
        });
      },
    }),
  );

  const resendInvitation = useMutation(
    api.lists.resendInvitation.mutationOptions({
      onSuccess: async (result) => {
        toast({ description: invitationDeliveryMessage(result.emailSent) });
        await invalidateListCaches();
      },
      onError: (error) => {
        toast({ variant: "destructive", description: error.message });
      },
    }),
  );

  const revokeInvitation = useMutation(
    api.lists.revokeInvitation.mutationOptions({
      onSuccess: async () => {
        toast({
          description: t("lists.collaborators.invitation_revoked"),
        });
        await invalidateListCaches();
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          description:
            error.message || t("lists.collaborators.failed_to_revoke"),
        });
      },
    }),
  );

  const handleAddCollaborator = () => {
    const email = newCollaboratorEmail.trim();
    if (!email) {
      toast({
        variant: "destructive",
        description: t("lists.collaborators.please_enter_email"),
      });
      return;
    }

    addCollaborator.mutate({
      listId: list.id,
      email,
      role: newCollaboratorRole,
      recursive: newCollaboratorRecursive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <ResponsiveDialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {readOnly
              ? t("lists.collaborators.collaborators")
              : t("lists.collaborators.manage")}
          </DialogTitle>
          <DialogDescription>
            {readOnly
              ? t("lists.collaborators.people_with_access")
              : "Invite people to this list and choose whether access also follows its current and future nested lists."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!readOnly && (
            <div className="space-y-3">
              <Label>{t("lists.collaborators.add")}</Label>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
                <div className="min-w-0">
                  <Input
                    type="email"
                    placeholder={t("lists.collaborators.enter_email")}
                    value={newCollaboratorEmail}
                    onChange={(e) => setNewCollaboratorEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddCollaborator();
                      }
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:contents">
                  <Select
                    value={newCollaboratorRole}
                    onValueChange={(value) =>
                      setNewCollaboratorRole(value as "viewer" | "editor")
                    }
                  >
                    <SelectTrigger
                      className="h-10 w-full sm:w-32"
                      aria-label={`${t("lists.collaborators.add")} ${t("common.role")}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        {t("lists.collaborators.viewer")}
                      </SelectItem>
                      <SelectItem value="editor">
                        {t("lists.collaborators.editor")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    className="h-10 w-full gap-2 sm:w-auto"
                    onClick={handleAddCollaborator}
                    disabled={addCollaborator.isPending}
                    aria-label={t("lists.collaborators.add")}
                  >
                    {addCollaborator.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                    <span className="sm:hidden">
                      {t("lists.collaborators.add")}
                    </span>
                  </Button>
                </div>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  checked={newCollaboratorRecursive}
                  onChange={(event) =>
                    setNewCollaboratorRecursive(event.target.checked)
                  }
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    Also share all nested lists
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Includes lists nested here now and lists added or moved here
                    later. Turn this off to share only this list.
                  </span>
                </span>
              </label>

              <p className="text-xs text-muted-foreground">
                <strong>{t("lists.collaborators.viewer")}:</strong>{" "}
                {t("lists.collaborators.viewer_description")}
                <br />
                <strong>{t("lists.collaborators.editor")}:</strong>{" "}
                {t("lists.collaborators.editor_description")}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Label>
              {readOnly
                ? t("lists.collaborators.collaborators")
                : t("lists.collaborators.current")}
            </Label>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : collaboratorsData ? (
              <div className="space-y-2">
                {collaboratorsData.owner && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar
                        name={collaboratorsData.owner.name}
                        image={collaboratorsData.owner.image}
                        className="size-10 ring-1 ring-border"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">
                          {collaboratorsData.owner.name}
                        </div>
                        {collaboratorsData.owner.email && (
                          <div className="truncate text-sm text-muted-foreground">
                            {collaboratorsData.owner.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t("lists.collaborators.owner")}
                    </div>
                  </div>
                )}

                {collaboratorsData.collaborators.map((collaborator) => {
                  const canManage = canManageCollaboratorOnList(collaborator);
                  const isPending = collaborator.status === "pending";
                  const disabledPending = isPending && collaborator.expired;
                  return (
                    <div
                      key={collaborator.id}
                      className="rounded-lg border p-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <UserAvatar
                            name={collaborator.user.name}
                            image={
                              collaborator.status === "accepted"
                                ? collaborator.user.image
                                : null
                            }
                            className="size-10 ring-1 ring-border"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate font-medium">
                                {collaborator.user.name}
                              </div>
                              {isPending && !collaborator.expired && (
                                <Badge variant="outline">Pending</Badge>
                              )}
                              {isPending && collaborator.expired && (
                                <Badge variant="destructive">Expired</Badge>
                              )}
                              {collaborator.inherited && (
                                <Badge variant="secondary">Inherited</Badge>
                              )}
                              {collaborator.recursive && (
                                <Badge variant="outline">Nested lists</Badge>
                              )}
                            </div>
                            {collaborator.user.email && (
                              <div className="truncate text-sm text-muted-foreground">
                                {collaborator.user.email}
                              </div>
                            )}
                            {collaborator.inherited &&
                              collaborator.sourceListName && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Inherited from {collaborator.sourceListName}
                                </div>
                              )}
                            {isPending && collaborator.expiresAt && (
                              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock3 className="size-3" />
                                {collaborator.expired
                                  ? "Expired"
                                  : "Expires"}{" "}
                                {new Intl.DateTimeFormat(undefined, {
                                  dateStyle: "medium",
                                }).format(collaborator.expiresAt)}
                              </div>
                            )}
                          </div>
                        </div>

                        {readOnly ? (
                          <div className="text-sm capitalize text-muted-foreground">
                            {collaborator.role}
                          </div>
                        ) : collaborator.inherited ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm capitalize text-muted-foreground">
                              {collaborator.role}
                            </span>
                            {collaborator.user.email && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setNewCollaboratorEmail(
                                    collaborator.user.email ?? "",
                                  );
                                  setNewCollaboratorRole(collaborator.role);
                                  setNewCollaboratorRecursive(false);
                                }}
                              >
                                Override here
                              </Button>
                            )}
                          </div>
                        ) : isPending ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={collaborator.role}
                              disabled={disabledPending}
                              onValueChange={(value) =>
                                updateInvitation.mutate({
                                  invitationId: collaborator.id,
                                  role: value as "viewer" | "editor",
                                  recursive: collaborator.recursive,
                                })
                              }
                            >
                              <SelectTrigger
                                className="w-28"
                                aria-label="Pending invitation role"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                              </SelectContent>
                            </Select>
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={collaborator.recursive}
                                disabled={disabledPending}
                                onChange={(event) =>
                                  updateInvitation.mutate({
                                    invitationId: collaborator.id,
                                    role: collaborator.role,
                                    recursive: event.target.checked,
                                  })
                                }
                              />
                              Nested lists
                            </label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                resendInvitation.mutate({
                                  invitationId: collaborator.id,
                                })
                              }
                              disabled={resendInvitation.isPending}
                            >
                              <RefreshCw className="mr-1 size-3" />
                              Resend
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                revokeInvitation.mutate({
                                  invitationId: collaborator.id,
                                })
                              }
                              disabled={revokeInvitation.isPending}
                            >
                              {t("lists.collaborators.revoke")}
                            </Button>
                          </div>
                        ) : canManage ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Select
                              value={collaborator.role}
                              onValueChange={(value) =>
                                updateCollaborator.mutate({
                                  listId: list.id,
                                  userId: collaborator.userId,
                                  role: value as "viewer" | "editor",
                                  recursive: collaborator.recursive,
                                })
                              }
                            >
                              <SelectTrigger
                                className="w-28"
                                aria-label="Collaborator role"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="viewer">Viewer</SelectItem>
                                <SelectItem value="editor">Editor</SelectItem>
                              </SelectContent>
                            </Select>
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={collaborator.recursive}
                                onChange={(event) =>
                                  updateCollaborator.mutate({
                                    listId: list.id,
                                    userId: collaborator.userId,
                                    role: collaborator.role,
                                    recursive: event.target.checked,
                                  })
                                }
                              />
                              Nested lists
                            </label>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove ${collaborator.user.name}`}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    collaboratorRemovalMessage(
                                      collaborator.user.name,
                                    ),
                                  )
                                ) {
                                  removeCollaborator.mutate({
                                    listId: list.id,
                                    userId: collaborator.userId,
                                  });
                                }
                              }}
                              disabled={removeCollaborator.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}

                {collaboratorsData.collaborators.length === 0 &&
                  !collaboratorsData.owner && (
                    <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                      {readOnly
                        ? t("lists.collaborators.no_collaborators_readonly")
                        : t("lists.collaborators.no_collaborators")}
                    </div>
                  )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                {readOnly
                  ? t("lists.collaborators.no_collaborators_readonly")
                  : t("lists.collaborators.no_collaborators")}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              {t("actions.close")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
