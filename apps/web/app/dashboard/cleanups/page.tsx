import { TagDuplicationDetection } from "@/components/dashboard/cleanups/TagDuplicationDetention";
import { PageHeader } from "@/components/shared/PageHeader";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "@/lib/i18n/server";
import { Paintbrush, Tags } from "lucide-react";

export default async function Cleanups() {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("cleanups.cleanups")}
        description="Tidy up your collection with focused maintenance tools that keep your organization clean and consistent."
        icon={<Paintbrush />}
      />
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Tags className="size-5 text-muted-foreground" />
          {t("cleanups.duplicate_tags.title")}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Merge duplicate tags and keep your taxonomy tidy.
        </p>
        <Separator className="my-4" />
        <TagDuplicationDetection />
      </div>
    </div>
  );
}
