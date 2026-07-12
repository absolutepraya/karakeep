import AllListsView from "@/components/dashboard/lists/AllListsView";
import { PendingInvitationsCard } from "@/components/dashboard/lists/PendingInvitationsCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTranslation } from "@/lib/i18n/server";
import { api } from "@/server/api/client";
import { ClipboardList } from "lucide-react";

export default async function ListsPage() {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  const lists = await api.lists.list();
  const stats = await api.users.stats();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("lists.all_lists")}
        icon={<ClipboardList />}
        titleAction={
          <div className="flex flex-col items-end text-right text-xs leading-4 text-muted-foreground">
            <span>
              {t("lists.summary_list", { count: lists.lists.length })}
            </span>
            <span>
              {t("lists.summary_bookmark", { count: stats.numBookmarks })}
            </span>
          </div>
        }
      />
      <PendingInvitationsCard />
      <AllListsView
        archivedCount={stats.numArchived}
        favoritesCount={stats.numFavorites}
        initialData={lists.lists}
      />
    </div>
  );
}
