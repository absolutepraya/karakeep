import React from "react";

export function UrlDisplay({ value, label }: { value: string; label: string }) {
  return (
    <div
      aria-label={label}
      className="flex h-10 min-w-0 max-w-full flex-1 items-center overflow-hidden rounded-md border border-input bg-background px-4 py-2 text-sm"
    >
      <span className="min-w-0 flex-1 truncate">{value}</span>
    </div>
  );
}
