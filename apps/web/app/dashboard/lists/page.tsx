import AllListsView from "@/components/dashboard/lists/AllListsView";
import { EditListModal } from "@/components/dashboard/lists/EditListModal";
import { PendingInvitationsCard } from "@/components/dashboard/lists/PendingInvitationsCard";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/server";
import { api } from "@/server/api/client";
import { ClipboardList, Plus } from "lucide-react";

export default async function ListsPage() {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  const lists = await api.lists.list();
  const stats = await api.users.stats();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl tracking-normal text-foreground">
            <ClipboardList className="size-6 shrink-0 text-muted-foreground" />
            {t("lists.all_lists")}
          </h1>
          <p className="text-md text-muted-foreground">
            {t("lists.summary_list", { count: lists.lists.length })} ·{" "}
            {t("lists.summary_bookmark", { count: stats.numBookmarks })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EditListModal>
            <Button className="h-11 w-full gap-2 rounded-lg lg:w-auto">
              <Plus className="size-4" />
              <span>{t("lists.new_list")}</span>
            </Button>
          </EditListModal>
        </div>
      </div>
      <PendingInvitationsCard />
      <AllListsView
        archivedCount={stats.numArchived}
        favoritesCount={stats.numFavorites}
        initialData={lists.lists}
      />
    </div>
  );
}
