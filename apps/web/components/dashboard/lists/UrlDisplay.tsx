import { cn } from "@/lib/utils";

export function UrlDisplay({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  return (
    <div
      aria-label={label}
      tabIndex={0}
      className={cn(
        "flex h-10 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0",
        className,
      )}
    >
      <span className="block min-w-0 truncate select-text">{value}</span>
    </div>
  );
}
