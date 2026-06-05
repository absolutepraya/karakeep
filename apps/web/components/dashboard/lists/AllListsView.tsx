"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CollapsibleTriggerChevron } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { MoreHorizontal, Plus, Search, X } from "lucide-react";

import type { ZBookmarkList } from "@karakeep/shared/types/lists";
import {
  augmentBookmarkListsWithInitialData,
  useBookmarkLists,
} from "@karakeep/shared-react/hooks/lists";
import { ZBookmarkListTreeNode } from "@karakeep/shared/utils/listUtils";

import { CollapsibleBookmarkLists } from "./CollapsibleBookmarkLists";
import { EditListModal } from "./EditListModal";
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
  const [query, setQuery] = useState("");

  // Fetch live lists data
  const { data: listsData } = useBookmarkLists(undefined, {
    initialData: { lists: initialData },
  });
  const lists = augmentBookmarkListsWithInitialData(listsData, initialData);

  // Client-side search: all lists are in memory. Results start at each matched
  // folder (the top-most match) with its subtree, mirroring the sidebar.
  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const matchedRoots = useMemo(() => {
    if (!isSearching) return [];
    const roots: ZBookmarkListTreeNode[] = [];
    const walk = (node: ZBookmarkListTreeNode, ancestorMatched: boolean) => {
      const selfMatched = node.item.name.toLowerCase().includes(trimmedQuery);
      if (selfMatched && !ancestorMatched) {
        roots.push(node);
      }
      node.children.forEach((child) =>
        walk(child, ancestorMatched || selfMatched),
      );
    };
    Object.values(lists.root).forEach((node) => walk(node, false));
    return roots;
  }, [isSearching, trimmedQuery, lists.root]);

  const hasSharedLists = useMemo(() => {
    return lists.data.some((list) => list.userRole !== "owner");
  }, [lists.data]);

  const hasOwnedLists = useMemo(() => {
    return lists.data.some((list) => list.userRole === "owner");
  }, [lists.data]);

  const renderRow = ({
    node,
    level,
    open,
    numBookmarks,
  }: {
    node: ZBookmarkListTreeNode;
    level: number;
    open: boolean;
    numBookmarks?: number;
  }) => (
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
  );

  return (
    <div className="space-y-6">
      {/* Sticky toolbar: a list search above a New List button, both the same
          height, pinned so they stay reachable while the tree scrolls. On
          mobile the page header is sticky (h-16) so we offset below it; on
          desktop the header sits outside the scroll area, so top-0. */}
      <div className="sticky top-16 z-20 flex flex-col gap-2 bg-background pb-2 pt-1 sm:top-0 sm:flex-row sm:items-center">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("lists.search_placeholder", {
            defaultValue: "Search lists",
          })}
          aria-label={t("lists.search_placeholder", {
            defaultValue: "Search lists",
          })}
          startIcon={<Search className="size-4 text-muted-foreground" />}
          endIcon={
            query ? (
              <button
                type="button"
                aria-label={t("actions.clear", { defaultValue: "Clear" })}
                onClick={() => setQuery("")}
                className="flex items-center text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : undefined
          }
          className="shadow-xs h-11 rounded-lg focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 sm:flex-1 [&::-webkit-search-cancel-button]:appearance-none"
        />
        <EditListModal>
          <Button className="h-11 w-full gap-2 rounded-lg sm:w-auto">
            <Plus className="size-4" />
            <span>{t("lists.new_list")}</span>
          </Button>
        </EditListModal>
      </div>

      {isSearching ? (
        matchedRoots.length > 0 ? (
          <div className="rounded-xl border bg-card p-1.5">
            <CollapsibleBookmarkLists
              listsData={{
                ...lists,
                root: Object.fromEntries(
                  matchedRoots.map((node) => [node.item.id, node]),
                ),
              }}
              render={renderRow}
            />
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("lists.no_lists_found", { defaultValue: "No lists found" })}
          </p>
        )
      ) : (
        <>
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
                render={renderRow}
              />
            </Section>
          )}

          {hasSharedLists && (
            <Section title={t("lists.shared_lists")}>
              <CollapsibleBookmarkLists
                listsData={lists}
                filter={(node) => node.item.userRole !== "owner"}
                render={renderRow}
              />
            </Section>
          )}
        </>
      )}
    </div>
  );
}
