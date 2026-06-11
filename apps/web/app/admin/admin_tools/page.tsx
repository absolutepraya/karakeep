import type { Metadata } from "next";
import BookmarkDebugger from "@/components/admin/BookmarkDebugger";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTranslation } from "@/lib/i18n/server";
import { Wrench } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("admin.admin_tools.admin_tools")} | Karakeep`,
  };
}

export default function AdminToolsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Admin tools"
        description="Investigate individual bookmarks, inspect pipeline state, and kick off targeted repair actions."
        icon={<Wrench className="size-5" />}
      />
      <BookmarkDebugger />
    </div>
  );
}
