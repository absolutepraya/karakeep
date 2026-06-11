import { cn } from "@/lib/utils";

export function AdminCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "shadow-xs rounded-2xl border border-border/70 bg-card/90 p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
