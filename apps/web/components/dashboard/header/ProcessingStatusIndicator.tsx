"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import { useTRPC } from "@karakeep/shared-react/trpc";

const LABEL_BY_KIND = {
  crawling: "Crawling",
  tagging: "Tagging",
  summarizing: "Summarizing",
  embedding: "Embedding",
  importing: "Importing",
} as const;

export default function ProcessingStatusIndicator() {
  const api = useTRPC();
  const { data } = useQuery(
    api.bookmarks.getProcessingStatus.queryOptions(undefined, {
      refetchInterval: 15_000,
    }),
  );

  if (!data || data.total === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="shadow-xs ease-(--ease-out) h-10 gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 text-foreground transition-[background-color,border-color,box-shadow] duration-150 hover:bg-accent/70"
          aria-label={`${data.total} background tasks processing`}
        >
          <LoaderCircle className="size-4 animate-spin text-primary" />
          <span className="text-sm font-medium tabular-nums">{data.total}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl p-2">
        <p className="px-2 py-1 text-sm font-medium">Processing</p>
        <div className="mt-1 space-y-0.5">
          {data.tasks.map((task) => (
            <div
              key={task.kind}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
            >
              <span className="text-muted-foreground">
                {LABEL_BY_KIND[task.kind]}
              </span>
              <span className="font-medium tabular-nums">{task.count}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
