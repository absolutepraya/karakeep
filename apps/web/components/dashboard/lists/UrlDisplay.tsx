export function UrlDisplay({ value, label }: { value: string; label: string }) {
  return (
    <div
      aria-label={label}
      className="flex h-10 w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
    >
      <span className="truncate">{value}</span>
    </div>
  );
}
