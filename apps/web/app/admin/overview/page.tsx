import type { Metadata } from "next";
import BasicStats from "@/components/admin/BasicStats";
import ServiceConnections from "@/components/admin/ServiceConnections";
import { PageHeader } from "@/components/shared/PageHeader";
import { MARKA } from "@/lib/brand";
import { useTranslation } from "@/lib/i18n/server";
import { Activity } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return {
    title: `${t("admin.admin_settings")} | ${MARKA.name}`,
  };
}

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Admin overview"
        description="A quick read on system health, total usage, and the external services your instance depends on."
        icon={<Activity className="size-5" />}
      />
      <BasicStats />
      <ServiceConnections />
    </div>
  );
}
