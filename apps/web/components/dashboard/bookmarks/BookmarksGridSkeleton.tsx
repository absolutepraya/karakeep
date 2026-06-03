import type { BookmarksLayoutTypes } from "@/lib/userLocalSettings/types";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bookmarkLayoutSwitch,
  useBookmarkLayout,
  useGridColumns,
} from "@/lib/userLocalSettings/bookmarksLayout";
import tailwindConfig from "@/tailwind.config";
import Masonry from "react-masonry-css";
import resolveConfig from "tailwindcss/resolveConfig";

function getBreakpointConfig(userColumns: number) {
  const fullConfig = resolveConfig(tailwindConfig);

  const breakpointColumnsObj: { [key: number]: number; default: number } = {
    default: userColumns,
  };

  const lgColumns = Math.max(1, Math.min(userColumns, userColumns - 1));
  const mdColumns = Math.max(1, Math.min(userColumns, 2));
  const smColumns = 1;

  breakpointColumnsObj[parseInt(fullConfig.theme.screens.lg)] = lgColumns;
  breakpointColumnsObj[parseInt(fullConfig.theme.screens.md)] = mdColumns;
  breakpointColumnsObj[parseInt(fullConfig.theme.screens.sm)] = smColumns;
  return breakpointColumnsObj;
}

// Each skeleton mirrors the geometry of the real card for its layout so the
// load -> loaded transition doesn't jump.
function CardSkeleton({ layout }: { layout: BookmarksLayoutTypes }) {
  if (layout === "compact") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card p-2">
        <Skeleton className="size-5 shrink-0 rounded" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
    );
  }
  if (layout === "list") {
    return (
      <div className="mb-4 flex gap-4 rounded-lg border border-border bg-card p-2">
        <Skeleton className="size-32 shrink-0 rounded-lg" />
        <div className="flex flex-1 flex-col gap-2 py-1">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-auto h-3 w-24" />
        </div>
      </div>
    );
  }
  // grid / masonry: image on top, padded title + tags + meta below
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="h-56 w-full !rounded-none" />
      <div className="flex flex-col gap-2 p-2">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-6" />
        </div>
      </div>
    </div>
  );
}

export default function BookmarksGridSkeleton({
  count = 12,
}: {
  count?: number;
}) {
  const layout = useBookmarkLayout();
  const gridColumns = useGridColumns();
  const breakpointConfig = useMemo(
    () => getBreakpointConfig(gridColumns),
    [gridColumns],
  );

  const children = Array.from({ length: count }, (_, i) => (
    <CardSkeleton key={i} layout={layout} />
  ));

  return bookmarkLayoutSwitch(layout, {
    masonry: (
      <Masonry
        className="-ml-4 flex w-auto"
        columnClassName="pl-4"
        breakpointCols={breakpointConfig}
      >
        {children}
      </Masonry>
    ),
    grid: (
      <Masonry
        className="-ml-4 flex w-auto"
        columnClassName="pl-4"
        breakpointCols={breakpointConfig}
      >
        {children}
      </Masonry>
    ),
    list: <div className="grid grid-cols-1">{children}</div>,
    compact: <div className="grid grid-cols-1">{children}</div>,
  });
}
