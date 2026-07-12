"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  FileDown,
  Globe,
  LoaderCircle,
  Sparkles,
  Tags,
} from "lucide-react";

import { useTRPC } from "@karakeep/shared-react/trpc";

const LABEL_BY_KIND = {
  crawling: "Crawling",
  tagging: "Tagging",
  summarizing: "Summarizing",
  embedding: "Embedding",
  importing: "Importing",
} as const;

const ICON_BY_KIND = {
  crawling: Globe,
  tagging: Tags,
  summarizing: Sparkles,
  embedding: BrainCircuit,
  importing: FileDown,
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
        <div className="flex items-center gap-2 px-2 py-1">
          <LoaderCircle className="size-4 animate-spin text-primary" />
          <p className="text-sm font-medium">Processing</p>
          <span className="ml-auto text-sm font-medium tabular-nums">
            {data.total}
          </span>
        </div>
        <div className="mt-1 space-y-0.5">
          {data.tasks.map((task) => {
            const Icon = ICON_BY_KIND[task.kind];
            return (
              <div
                key={task.kind}
                className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="size-3.5" />
                  {LABEL_BY_KIND[task.kind]}
                </span>
                <span className="font-medium tabular-nums">{task.count}</span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
