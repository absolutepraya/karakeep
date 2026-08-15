"use client";

import { useState } from "react";
import { ManageCollaboratorsModal } from "@/components/dashboard/lists/ManageCollaboratorsModal";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useTranslation } from "@/lib/i18n/client";
import { useQuery } from "@tanstack/react-query";
import {
  CircleUserRound,
  Globe,
  Pencil,
  Rss,
  Share2,
  Users,
} from "lucide-react";

import { useTRPC } from "@karakeep/shared-react/trpc";
import { ZBookmarkList } from "@karakeep/shared/types/lists";

import { EditListModal } from "./EditListModal";
import { ListOptions } from "./ListOptions";
import { ShareListModal } from "./ShareListModal";

export function ListPrivacyLabel({ list }: { list: ZBookmarkList }) {
  const api = useTRPC();
  const { data } = useQuery(
    api.lists.getCollaborators.queryOptions(
      { listId: list.id },
      {
        enabled: list.userRole === "owner" && list.type === "manual",
      },
    ),
  );
  const hasAcceptedCollaborators =
    data?.collaborators.some(
      (collaborator) => collaborator.status === "accepted",
    ) ?? false;

  if (list.userRole !== "owner") {
    return <div>{list.userRole === "editor" ? "Can edit" : "Can view"}</div>;
  }
  if (list.public) {
    return (
      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
        <Globe className="size-4" /> Public
      </div>
    );
  }
  if (list.hasCollaborators || hasAcceptedCollaborators) {
    return (
      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
        <Users className="size-4" /> Shared
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <CircleUserRound className="size-4" /> Private
    </div>
  );
}

export function ListCollaboratorIcons({ list }: { list: ZBookmarkList }) {
  const api = useTRPC();
  const { data, isLoading } = useQuery(
    api.lists.getCollaborators.queryOptions(
      { listId: list.id },
      {
        enabled: list.userRole === "owner" && list.type === "manual",
      },
    ),
  );

  if (list.userRole !== "owner" || isLoading || !data) {
    return null;
  }

  const acceptedCollaborators = data.collaborators.filter(
    (collaborator) => collaborator.status === "accepted",
  );
  if (acceptedCollaborators.length === 0) {
    return null;
  }

  const visibleCollaborators = acceptedCollaborators.slice(0, 4);
  const remainingCount = acceptedCollaborators.length - 4;

  return (
    <div className="flex h-7 -space-x-2 overflow-visible pl-1">
      {visibleCollaborators.map((collaborator) => (
        <UserAvatar
          key={collaborator.user.id}
          name={collaborator.user.name}
          image={collaborator.user.image}
          className="size-7 ring-2 ring-background"
        />
      ))}
      {remainingCount > 0 && (
        <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-2 ring-background">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

export function ListHeaderActions({ list }: { list: ZBookmarkList }) {
  const { t } = useTranslation();
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [collaboratorsOpen, setCollaboratorsOpen] = useState(false);

  return (
    <div className="flex items-center gap-0.5">
      {list.userRole === "owner" && (
        <>
          {list.type === "manual" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("lists.collaborators.manage")}
              onClick={() => setCollaboratorsOpen(true)}
              className="rounded-full"
            >
              <Users className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("lists.actions.share")}
            onClick={() => setShareOpen(true)}
            className="rounded-full"
          >
            {list.public ? (
              <Globe className="size-4" />
            ) : list.rssToken ? (
              <Rss className="size-4" />
            ) : (
              <Share2 className="size-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("lists.actions.edit")}
            onClick={() => setEditOpen(true)}
            className="rounded-full"
          >
            <Pencil className="size-4" />
          </Button>
        </>
      )}
      <ListOptions list={list} />
      {list.userRole === "owner" && (
        <>
          <EditListModal open={editOpen} setOpen={setEditOpen} list={list} />
          <ShareListModal
            open={shareOpen}
            setOpen={setShareOpen}
            list={list}
          />
          {list.type === "manual" && (
            <ManageCollaboratorsModal
              open={collaboratorsOpen}
              setOpen={setCollaboratorsOpen}
              list={list}
            />
          )}
        </>
      )}
    </div>
  );
}
