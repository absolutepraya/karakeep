import type { Metadata } from "next";
import BackgroundJobs from "@/components/admin/BackgroundJobs";
import { PageHeader } from "@/components/shared/PageHeader";
import { MARKA } from "@/lib/brand";
import { useTranslation } from "@/lib/i18n/server";
import { Activity } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("admin.background_jobs.background_jobs")} | ${MARKA.name}`,
  };
}

export default function BackgroundJobsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Background jobs"
        description="Monitor queue health, inspect failures, and trigger maintenance or recovery jobs without leaving the admin area."
        icon={<Activity className="size-5" />}
      />
      <BackgroundJobs />
    </div>
  );
}
