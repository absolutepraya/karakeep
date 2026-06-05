import { cn } from "@/lib/utils";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

export function SettingsPage({
  title,
  description,
  icon,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            {icon}
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsSection({
  title,
  description,
  action,
  children,
  variant = "default",
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  const hasHeader = !!(title || description || action);
  return (
    <Card
      className={variant === "danger" ? "border-destructive/20" : undefined}
    >
      {hasHeader && (
        <CardHeader className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              {title && (
                <CardTitle
                  className={cn(
                    "text-lg",
                    variant === "danger" && "text-destructive",
                  )}
                >
                  {title}
                </CardTitle>
              )}
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={cn("space-y-3 p-4", hasHeader && "pt-0")}>
        {children}
      </CardContent>
    </Card>
  );
}
