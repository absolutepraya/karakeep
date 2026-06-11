import type { Metadata } from "next";
import Bookmarks from "@/components/dashboard/bookmarks/Bookmarks";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTranslation } from "@/lib/i18n/server";
import { Archive } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("common.archive")} | Karakeep`,
  };
}

export default async function ArchivedBookmarkPage() {
  return (
    <Bookmarks
      header={
        <PageHeader
          title="Archive"
          description="Archived bookmarks stay out of your main feed while remaining searchable and easy to revisit."
          icon={<Archive />}
        />
      }
      query={{ archived: true }}
      showDivider={true}
      showEditorCard={true}
    />
  );
}
