"use client";

import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Bookmark } from "lucide-react";

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
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-card p-10 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Bookmark className="size-8" />}
      </div>
      <h3 className="mb-2 text-xl font-semibold text-foreground">
        {title ?? t("banners.no_bookmarks.title")}
      </h3>
      <p className="max-w-md text-muted-foreground">
        {description ?? t("banners.no_bookmarks.description")}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
