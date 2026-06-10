import { cn } from "@/lib/utils";
import { Archive, ArchiveRestore, Star } from "lucide-react";

export function FavouritedActionIcon({
  favourited,
  className,
  size,
  strokeWidth,
}: {
  favourited: boolean;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  // Single element with fill-transparent <-> fill-primary so the toggle
  // crossfades (fill: none wouldn't interpolate).
  return (
    <Star
      size={size}
      strokeWidth={strokeWidth}
      className={cn(
        "transition-colors",
        favourited ? "fill-primary text-primary" : "fill-transparent",
        className,
      )}
    />
  );
}

export function ArchivedActionIcon({
  archived,
  className,
  size,
  strokeWidth,
}: {
  archived: boolean;
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return archived ? (
    <ArchiveRestore
      size={size}
      strokeWidth={strokeWidth}
      className={className}
    />
  ) : (
    <Archive size={size} strokeWidth={strokeWidth} className={className} />
  );
}
