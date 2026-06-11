import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  compact = false,
  titleAs: TitleTag = "h3",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
  titleAs?: "h1" | "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact
          ? "rounded-lg border border-dashed border-border/80 bg-muted/20 px-6 py-8"
          : "rounded-xl border border-border bg-card px-6 py-10 sm:px-10",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          compact ? "size-12 [&_svg]:size-6" : "size-16 [&_svg]:size-8",
        )}
      >
        {icon ?? <Inbox />}
      </div>
      <TitleTag
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-lg" : "text-xl",
        )}
      >
        {title}
      </TitleTag>
      {description && (
        <p
          className={cn(
            "mt-2 text-muted-foreground",
            compact ? "max-w-md text-sm" : "max-w-xl text-base",
          )}
        >
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>
      )}
    </div>
  );
}
