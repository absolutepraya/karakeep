"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CollapsibleTriggerChevron } from "@/components/ui/collapsible";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";

import type { ZBookmarkList } from "@karakeep/shared/types/lists";
import {
  augmentBookmarkListsWithInitialData,
  useBookmarkLists,
} from "@karakeep/shared-react/hooks/lists";

import { CollapsibleBookmarkLists } from "./CollapsibleBookmarkLists";
import { ListOptions } from "./ListOptions";

// A single compact tree row: chevron, emoji tile, name, item count, and an
// options menu that fades in on hover. Indentation tracks the nesting level,
// mirroring the sidebar tree but with a touch more room for a full page.
function ListRow({
  name,
  icon,
  path,
  level = 0,
  list,
  open,
  collapsible,
  itemCount,
}: {
  name: string;
  icon: string;
  path: string;
  level?: number;
  list?: ZBookmarkList;
  open?: boolean;
  collapsible: boolean;
  itemCount?: number;
}) {
  return (
    <div
      className="group/list-row flex items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-accent"
      style={{ marginLeft: `${level * 1.25}rem` }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {collapsible ? (
          <CollapsibleTriggerChevron
            className="size-4 shrink-0 text-muted-foreground transition-transform hover:text-foreground"
            open={open ?? false}
          />
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <Link
          href={path}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5"
        >
          <span className="shrink-0 text-lg leading-none">{icon}</span>
          <span className="truncate text-sm text-foreground">{name}</span>
        </Link>
      </div>
      {/* Count sits at the far right in every row; for editable lists the
          options button is absolutely positioned so it doesn't shift the count
          (keeping All Lists counts aligned with the Pinned ones), fading in
          over the count on hover. */}
      <div className="relative flex shrink-0 items-center text-muted-foreground">
        {itemCount !== undefined && itemCount > 0 && (
          <span
            className={cn(
              "px-1 text-xs tabular-nums",
              list && "transition-opacity group-hover/list-row:opacity-0",
            )}
          >
            {itemCount.toLocaleString()}
          </span>
        )}
        {list && (
          <ListOptions list={list}>
            <Button
              size="none"
              variant="ghost"
              className="absolute inset-y-0 right-0 my-auto flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/list-row:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </ListOptions>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h2 className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="rounded-xl border bg-card p-1.5">{children}</div>
    </section>
  );
}

export default function AllListsView({
  initialData,
  favoritesCount,
  archivedCount,
}: {
  initialData: ZBookmarkList[];
  favoritesCount?: number;
  archivedCount?: number;
}) {
  const { t } = useTranslation();

  // Fetch live lists data
  const { data: listsData } = useBookmarkLists(undefined, {
    initialData: { lists: initialData },
  });
  const lists = augmentBookmarkListsWithInitialData(listsData, initialData);

  const hasSharedLists = useMemo(() => {
    return lists.data.some((list) => list.userRole !== "owner");
  }, [lists.data]);

  const hasOwnedLists = useMemo(() => {
    return lists.data.some((list) => list.userRole === "owner");
  }, [lists.data]);

  return (
    <div className="space-y-6">
      <Section title="Pinned">
        <ListRow
          collapsible={false}
          name={t("lists.favourites")}
          icon="⭐️"
          itemCount={favoritesCount}
          path={`/dashboard/favourites`}
        />
        <ListRow
          collapsible={false}
          name={t("common.archive")}
          icon="🗄️"
          itemCount={archivedCount}
          path={`/dashboard/archive`}
        />
      </Section>

      {hasOwnedLists && (
        <Section title={t("lists.all_lists")}>
          <CollapsibleBookmarkLists
            listsData={lists}
            filter={(node) => node.item.userRole === "owner"}
            render={({ node, level, open, numBookmarks }) => (
              <ListRow
                name={node.item.name}
                icon={node.item.icon}
                itemCount={numBookmarks}
                level={level}
                list={node.item}
                path={`/dashboard/lists/${node.item.id}`}
                collapsible={node.children.length > 0}
                open={open}
              />
            )}
          />
        </Section>
      )}

      {hasSharedLists && (
        <Section title={t("lists.shared_lists")}>
          <CollapsibleBookmarkLists
            listsData={lists}
            filter={(node) => node.item.userRole !== "owner"}
            render={({ node, level, open, numBookmarks }) => (
              <ListRow
                name={node.item.name}
                icon={node.item.icon}
                itemCount={numBookmarks}
                level={level}
                list={node.item}
                path={`/dashboard/lists/${node.item.id}`}
                collapsible={node.children.length > 0}
                open={open}
              />
            )}
          />
        </Section>
      )}
    </div>
  );
}
