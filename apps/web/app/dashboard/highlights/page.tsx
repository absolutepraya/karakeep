import type { Metadata } from "next";
import AllHighlights from "@/components/dashboard/highlights/AllHighlights";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTranslation } from "@/lib/i18n/server";
import { api } from "@/server/api/client";
import { Highlighter } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("common.highlights")} | Karakeep`,
  };
}

export default async function HighlightsPage() {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  const highlights = await api.highlights.getAll({});
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("common.highlights")}
        description="Search and revisit every passage you’ve highlighted across your saved reading."
        icon={<Highlighter />}
      />
      <div className="flex flex-col gap-6 rounded-xl border bg-card p-4 sm:p-5">
        <AllHighlights highlights={highlights} />
      </div>
    </div>
  );
}
