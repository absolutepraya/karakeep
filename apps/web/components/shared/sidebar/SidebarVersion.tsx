"use client";

import React from "react";
import Link from "next/link";
import { usePwaLifecycle } from "@/components/pwa/ServiceWorkerRegistration";
import { useTranslation } from "@/lib/i18n/client";
import { Download, GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const FORK_REPO = "absolutepraya/marka";
const FORK_REPO_URL = `https://github.com/${FORK_REPO}`;

function isCommitSha(value?: string): value is string {
  return !!value && /^[0-9a-f]{7,40}$/i.test(value);
}

function displayBuild(value: string) {
  return isCommitSha(value) ? value.slice(0, 7) : value;
}

interface SidebarVersionProps {
  placement?: "sidebar" | "profile";
}

export default function SidebarVersion({
  placement = "sidebar",
}: SidebarVersionProps) {
  const { t } = useTranslation("profile_menu");
  const {
    appBuild,
    deployedBuild,
    updateStatus,
    updateAvailable,
    checkForUpdate,
    activateUpdate,
  } = usePwaLifecycle();
  const validAppBuild = isCommitSha(appBuild);
  const visibleBuild = validAppBuild
    ? displayBuild(appBuild)
    : appBuild === "development"
      ? "development"
      : "unknown";
  const containerClassName =
    placement === "profile"
      ? "flex min-w-0 items-center justify-between gap-3 px-2 py-1 text-xs leading-tight"
      : "flex min-w-0 items-center justify-between gap-3 text-xs leading-tight";
  const buildClassName =
    placement === "profile"
      ? "flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground opacity-50 transition-colors hover:text-foreground"
      : "flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground";
  const buildIconClassName = placement === "profile" ? "size-3" : "size-3.5";

  const buildLabel = t("build", { build: visibleBuild });

  return (
    <div className={containerClassName}>
      {validAppBuild ? (
        <Link
          href={`${FORK_REPO_URL}/commit/${appBuild}`}
          target="_blank"
          rel="noopener noreferrer"
          title={t("build_title", { build: appBuild })}
          className={buildClassName}
        >
          <span className="truncate">{buildLabel}</span>
          <GitBranch className={`${buildIconClassName} shrink-0`} />
        </Link>
      ) : (
        <span className={buildClassName}>
          <span className="truncate">{buildLabel}</span>
          <GitBranch className={`${buildIconClassName} shrink-0`} />
        </span>
      )}
      <div className="flex shrink-0 items-center justify-end gap-1 font-mono text-xs text-muted-foreground">
        {!validAppBuild || !deployedBuild || updateStatus === "unavailable" ? (
          <span>{t("update_unavailable")}</span>
        ) : updateStatus === "checking" ? (
          <span>{t("checking")}</span>
        ) : updateStatus === "installing" ? (
          <span>{t("preparing_update")}</span>
        ) : updateStatus === "error" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={checkForUpdate}
            className="h-auto gap-1 px-1.5 py-1 font-mono text-xs text-muted-foreground"
          >
            {t("check_failed")}
            <RefreshCw className="size-3" />
          </Button>
        ) : updateStatus === "blocked" ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={activateUpdate}
            className="h-auto gap-1 px-1.5 py-1 font-mono text-xs text-muted-foreground"
          >
            {t("close_other_tabs")}
            <RefreshCw className="size-3" />
          </Button>
        ) : updateStatus === "updating" ? (
          <span>{t("updating")}</span>
        ) : updateAvailable && updateStatus === "ready" ? (
          <Button
            type="button"
            size="sm"
            onClick={activateUpdate}
            className="h-auto gap-1 rounded-md bg-emerald-500/15 px-2 py-1 font-mono text-xs text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
          >
            {t("update_now")}
            <Download className="size-3" />
          </Button>
        ) : updateAvailable ? (
          <span>{t("preparing_update")}</span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={checkForUpdate}
            className="h-auto gap-1 px-1.5 py-1 font-mono text-xs text-muted-foreground"
          >
            {t("up_to_date")}
            <RefreshCw className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );
}
