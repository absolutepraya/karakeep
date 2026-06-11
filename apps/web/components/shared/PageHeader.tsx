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
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="shadow-xs mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card text-muted-foreground [&_svg]:size-5">
              {icon}
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
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
