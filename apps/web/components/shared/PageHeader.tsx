import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  icon,
  meta,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const hasSupportingText = Boolean(description || meta);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "flex gap-4",
            hasSupportingText ? "items-start" : "items-center",
          )}
        >
          {icon && (
            <div
              className={cn(
                "shrink-0 items-center justify-center bg-muted text-muted-foreground",
                hasSupportingText
                  ? "mt-0.5 flex size-14 rounded-2xl [&_svg]:size-7"
                  : "flex size-11 rounded-xl [&_svg]:size-[1.375rem]",
              )}
            >
              {icon}
            </div>
          )}
          <div
            className={cn("min-w-0", hasSupportingText && "space-y-1.5 pt-0.5")}
          >
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description && (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            )}
            {meta && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {meta}
              </div>
            )}
          </div>
        </div>
      </div>

      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {action}
        </div>
      )}
    </div>
  );
}
