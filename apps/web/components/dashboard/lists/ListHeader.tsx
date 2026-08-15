"use client";

import { Fragment, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight, MoreHorizontal, Sparkles } from "lucide-react";

import { useBookmarkLists } from "@karakeep/shared-react/hooks/lists";
import { useTRPC } from "@karakeep/shared-react/trpc";
import { parseSearchQuery } from "@karakeep/shared/searchQueryParser";
import { ZBookmarkList } from "@karakeep/shared/types/lists";

import QueryExplainerTooltip from "../search/QueryExplainerTooltip";
import { ListOptions } from "./ListOptions";
import {
  ListCollaboratorsIcons,
  ListPrivacyLabel,
} from "./ListHeaderComponents";

export default function ListHeader({
  initialData,
}: {
  initialData: ZBookmarkList;
}) {
  const api = useTRPC();
  const { t } = useTranslation();
  const router = useRouter();
  const { data: list, error } = useQuery(
    api.lists.get.queryOptions(
      {
        listId: initialData.id,
      },
      {
        initialData,
      },
    ),
  );
  const { data: listsData } = useBookmarkLists();

  const { data: statsData } = useQuery(
    api.lists.stats.queryOptions(undefined, {
      placeholderData: keepPreviousData,
    }),
  );
  const itemCount = statsData?.stats.get(list.id);
  const hierarchyPath = listsData?.getPathById(list.id) ?? [];

  const parsedQuery = useMemo(() => {
    if (!list.query) {
      return null;
    }
    return parseSearchQuery(list.query);
  }, [list.query]);

  if (error) {
    // This is usually exercised during list deletions.
    if (error.data?.code == "NOT_FOUND") {
      router.push("/dashboard/lists");
    }
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-4xl">
          {list.icon}
        </span>
        <div className="min-w-0 flex-1">
          {hierarchyPath.length > 1 && (
            <div className="mb-1 flex min-w-0 items-center gap-1 overflow-hidden text-xs text-muted-foreground">
              {hierarchyPath.map((pathList, index) => {
                const isCurrent = index === hierarchyPath.length - 1;
                return (
                  <Fragment key={pathList.id}>
                    {isCurrent ? (
                      <span className="min-w-0 truncate">
                        {pathList.icon} {pathList.name}
                      </span>
                    ) : (
                      <Link
                        href={`/dashboard/lists/${pathList.id}`}
                        className="min-w-0 truncate transition-colors hover:text-foreground"
                      >
                        {pathList.icon} {pathList.name}
                      </Link>
                    )}
                    {!isCurrent && (
                      <ChevronRight className="size-3 shrink-0" aria-hidden />
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
          <h1 className="truncate text-2xl font-semibold leading-tight">
            {list.name}
          </h1>
          {list.description && (
            <p className="mt-1 text-muted-foreground">{list.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {itemCount !== undefined && (
              <>
                <span>{t("lists.items_count", { count: itemCount })}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <ListPrivacyLabel list={list} />
            {parsedQuery && (
              <>
                <span aria-hidden>·</span>
                <QueryExplainerTooltip
                  parsedSearchQuery={parsedQuery}
                  trigger={
                    <button
                      type="button"
                      className="inline-flex cursor-help items-center gap-1 transition-colors hover:text-foreground"
                    >
                      <Sparkles className="size-3.5" />
                      {t("lists.smart_list")}
                    </button>
                  }
                />
              </>
            )}
            <ListCollaboratorsIcons list={list} />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <ListOptions list={list}>
          <Button variant="ghost">
            <MoreHorizontal />
          </Button>
        </ListOptions>
      </div>
    </div>
  );
}
