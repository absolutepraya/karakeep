import type { Metadata } from "next";
import Bookmarks from "@/components/dashboard/bookmarks/Bookmarks";
import InfoTooltip from "@/components/ui/info-tooltip";
import { useTranslation } from "@/lib/i18n/server";
import { Archive } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("common.archive")} | Karakeep`,
  };
}

function header() {
  return (
    <div className="flex gap-2">
      <p className="flex items-center gap-2 text-2xl">
        <Archive size={24} />
        Archive
      </p>
      <InfoTooltip size={17} className="my-auto" variant="explain">
        <p>Archived bookmarks won&apos;t appear in the homepage</p>
      </InfoTooltip>
    </div>
  );
}

export default async function ArchivedBookmarkPage() {
  return (
    <Bookmarks
      header={header()}
      query={{ archived: true }}
      showDivider={true}
      showEditorCard={true}
    />
  );
}
