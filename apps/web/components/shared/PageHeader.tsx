import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  icon,
  meta,
  titleAction,
  action,
  className,
  variant = "default",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  titleAction?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  variant?: "default" | "settings";
}) {
  const hasDescription = Boolean(description);
  const usesSettingsLayout = variant === "settings";
  const useLargeIcon = hasDescription || usesSettingsLayout;

  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex gap-4",
            useLargeIcon ? "items-start" : "items-center",
          )}
        >
          {icon && (
            <div
              className={cn(
                "shrink-0 items-center justify-center bg-muted text-muted-foreground",
                useLargeIcon
                  ? "mt-0.5 flex size-14 rounded-2xl [&_svg]:size-7"
                  : "flex size-11 rounded-xl [&_svg]:size-[1.375rem]",
              )}
            >
              {icon}
            </div>
          )}
          <div className={cn("min-w-0", useLargeIcon && "space-y-1.5 pt-0.5")}>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-foreground">
                {title}
              </h1>
            </div>
            {description && (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            )}
            {meta && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {meta}
              </div>
            )}
          </div>
        </div>
      </div>
      {(titleAction || action) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-center">
          {titleAction}
          {action}
        </div>
      )}
    </div>
  );
}
