"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import FilePickerButton from "@/components/ui/file-picker-button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { useBookmarkImport } from "@/lib/hooks/useBookmarkImport";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Archive,
  BookOpen,
  Chrome,
  Download,
  FileText,
  Globe,
  Package,
  Upload,
} from "lucide-react";

import { ImportSessionsSection } from "./ImportSessionsSection";
import { SettingsPage, SettingsSection } from "./SettingsPage";

type ImportSource =
  | "html"
  | "pocket"
  | "matter"
  | "omnivore"
  | "linkwarden"
  | "tab-session-manager"
  | "mymind"
  | "instapaper"
  | "karakeep"
  | "readwise-reader"
  | "onetab";

function SurfaceBlock({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="shadow-xs rounded-xl border border-border/70 bg-background/80 p-4">
      <div className="mb-4 space-y-1">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {description && (
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

function ImportSourceCard({
  title,
  description,
  icon,
  accept,
  source,
  onImport,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accept: string;
  source: ImportSource;
  onImport: (args: { file: File; source: ImportSource }) => void;
}) {
  return (
    <div className="shadow-xs rounded-xl border border-border/70 bg-background/80 p-4 transition-shadow duration-200 hover:shadow-sm">
      <div className="flex h-full flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground [&_svg]:size-4">
            {icon}
          </div>
          <div className="min-w-0 space-y-1">
            <h4 className="font-medium text-foreground">{title}</h4>
            <p className="text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
        <div className="mt-auto flex justify-end">
          <FilePickerButton
            size="sm"
            loading={false}
            accept={accept}
            multiple={false}
            className="flex items-center gap-2"
            onFileSelect={(file) => onImport({ file, source })}
          >
            Import
          </FilePickerButton>
        </div>
      </div>
    </div>
  );
}

function ExportCard() {
  const { t } = useTranslation();
  const [format, setFormat] = useState<"json" | "netscape">("json");
  const queryClient = useQueryClient();
  const { isFetching, refetch, error } = useQuery({
    queryKey: ["exportBookmarks"],
    queryFn: async () => {
      const res = await fetch(`/api/bookmarks/export?format=${format}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error?.error || "Failed to export bookmarks");
      }
      const match = res.headers
        .get("Content-Disposition")
        ?.match(/filename\*?=(?:UTF-8''|")?([^"]+)/i);
      const filename = match
        ? match[1]
        : `karakeep-export-${new Date().toISOString()}.${format}`;
      return { blob: res.blob(), filename };
    },
    enabled: false,
  });

  useEffect(() => {
    if (error) {
      toast({
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error]);

  const onExport = useCallback(async () => {
    const { data } = await refetch();
    if (!data) return;
    const { blob, filename } = data;
    const url = window.URL.createObjectURL(await blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    queryClient.setQueryData(["exportBookmarks"], () => null);
  }, [refetch, queryClient]);

  return (
    <SurfaceBlock
      title="Export your library"
      description={t("settings.import.export_links_and_notes")}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground [&_svg]:size-4">
              <Upload />
            </div>
            <p className="max-w-xl leading-6">
              Create a portable backup of your bookmarks, notes, and structure
              in the format that best suits the next step.
            </p>
          </div>
          <Select
            value={format}
            onValueChange={(value) => setFormat(value as "json" | "netscape")}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="json">JSON (Karakeep format)</SelectItem>
              <SelectItem value="netscape">HTML (Netscape format)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          className={cn(
            buttonVariants({ variant: "default", size: "sm" }),
            "gap-2",
          )}
          onClick={onExport}
          disabled={isFetching}
        >
          {isFetching ? <Download className="animate-pulse" /> : <Download />}
          Export
        </Button>
      </div>
    </SurfaceBlock>
  );
}

export function ImportExportRow() {
  const { t } = useTranslation();
  const { importProgress, quotaError, runUploadBookmarkFile } =
    useBookmarkImport();

  const groups = useMemo(
    () => [
      {
        title: "Browser & file imports",
        description:
          "The quickest path for bookmarks exported from browsers or tools that generate simple files.",
        items: [
          {
            title: "HTML File",
            description: t("settings.import.import_bookmarks_from_html_file"),
            accept: ".html",
            source: "html" as const,
            icon: <FileText />,
          },
          {
            title: "OneTab",
            description: t(
              "settings.import.import_bookmarks_from_onetab_export",
            ),
            accept: ".txt",
            source: "onetab" as const,
            icon: <Chrome />,
          },
          {
            title: "Karakeep",
            description: t(
              "settings.import.import_bookmarks_from_karakeep_export",
            ),
            accept: ".json",
            source: "karakeep" as const,
            icon: <Archive />,
          },
        ],
      },
      {
        title: "Reading apps",
        description:
          "Bring reading queues and save-later libraries into one calmer place.",
        items: [
          {
            title: "Pocket",
            description: t(
              "settings.import.import_bookmarks_from_pocket_export",
            ),
            accept: ".csv",
            source: "pocket" as const,
            icon: <BookOpen />,
          },
          {
            title: "Instapaper",
            description: t(
              "settings.import.import_bookmarks_from_instapaper_export",
            ),
            accept: ".csv",
            source: "instapaper" as const,
            icon: <BookOpen />,
          },
          {
            title: "Readwise Reader",
            description: t(
              "settings.import.import_bookmarks_from_readwise_reader_export",
            ),
            accept: ".csv",
            source: "readwise-reader" as const,
            icon: <BookOpen />,
          },
          {
            title: "Matter",
            description: t(
              "settings.import.import_bookmarks_from_matter_export",
            ),
            accept: ".csv",
            source: "matter" as const,
            icon: <BookOpen />,
          },
          {
            title: "Omnivore",
            description: t(
              "settings.import.import_bookmarks_from_omnivore_export",
            ),
            accept: ".json",
            source: "omnivore" as const,
            icon: <BookOpen />,
          },
          {
            title: "mymind",
            description: t(
              "settings.import.import_bookmarks_from_mymind_export",
            ),
            accept: ".csv",
            source: "mymind" as const,
            icon: <BookOpen />,
          },
        ],
      },
      {
        title: "Bookmark tools",
        description:
          "For dedicated bookmarking products and tab-management tools with richer exports.",
        items: [
          {
            title: "Linkwarden",
            description: t(
              "settings.import.import_bookmarks_from_linkwarden_export",
            ),
            accept: ".json",
            source: "linkwarden" as const,
            icon: <Globe />,
          },
          {
            title: "Tab Session Manager",
            description: t(
              "settings.import.import_bookmarks_from_tab_session_manager_export",
            ),
            accept: ".json",
            source: "tab-session-manager" as const,
            icon: <Package />,
          },
        ],
      },
    ],
    [t],
  );

  return (
    <div className="space-y-5">
      {quotaError && (
        <Alert
          variant="destructive"
          className="rounded-xl border-destructive/25"
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Import quota exceeded</AlertTitle>
          <AlertDescription>{quotaError}</AlertDescription>
        </Alert>
      )}

      {importProgress && (
        <SurfaceBlock
          title="Import in progress"
          description={`Processed ${importProgress.done} of ${importProgress.total} bookmarks so far.`}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Current progress</span>
              <span className="font-medium text-foreground">
                {Math.round((importProgress.done * 100) / importProgress.total)}
                %
              </span>
            </div>
            <Progress
              value={(importProgress.done * 100) / importProgress.total}
              className="h-2.5"
            />
          </div>
        </SurfaceBlock>
      )}

      {groups.map((group) => (
        <SurfaceBlock
          key={group.title}
          title={group.title}
          description={group.description}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {group.items.map((item) => (
              <ImportSourceCard
                key={item.title}
                title={item.title}
                description={item.description}
                accept={item.accept}
                source={item.source}
                icon={item.icon}
                onImport={runUploadBookmarkFile}
              />
            ))}
          </div>
        </SurfaceBlock>
      ))}

      <ExportCard />
    </div>
  );
}

export default function ImportExport() {
  const { t } = useTranslation();
  return (
    <SettingsPage
      title={t("settings.import.import_export")}
      description="Move your library in or out of Karakeep without losing structure, notes, or momentum."
      icon={<Download className="size-6 shrink-0 text-muted-foreground" />}
    >
      <SettingsSection
        title={t("settings.import.import_export_bookmarks")}
        description="Import from common reading tools and bookmark managers, then review every run below."
      >
        <ImportExportRow />
      </SettingsSection>

      <ImportSessionsSection />
    </SettingsPage>
  );
}
