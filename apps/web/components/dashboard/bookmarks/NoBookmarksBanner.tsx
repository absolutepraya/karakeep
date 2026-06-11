"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n/client";
import { Bookmark } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export default function NoBookmarksBanner({
  title,
  description,
  icon,
  action,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <EmptyState
      className={className}
      icon={icon ?? <Bookmark className="size-8" />}
      title={title ?? t("banners.no_bookmarks.title")}
      description={description ?? t("banners.no_bookmarks.description")}
      action={action}
    />
  );
}
