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
  return favourited ? (
    <Star
      size={size}
      strokeWidth={strokeWidth}
      className={cn("fill-primary text-primary", className)}
    />
  ) : (
    <Star size={size} strokeWidth={strokeWidth} className={className} />
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
