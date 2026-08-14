export function UrlDisplay({ value, label }: { value: string; label: string }) {
  return (
    <div
      aria-label={label}
      className="flex h-10 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-4 py-2 text-sm"
    >
      <span className="block min-w-0 truncate select-text">{value}</span>
    </div>
  );
}
