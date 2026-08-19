"use client";

import React from "react";
import Link from "next/link";
import { usePwaLifecycle } from "@/components/pwa/ServiceWorkerRegistration";
import { useTranslation } from "@/lib/i18n/client";
import { GitBranch, RefreshCw } from "lucide-react";
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
  const { appBuild, deployedBuild, updateStatus, activateUpdate } =
    usePwaLifecycle();
  const visibleBuild = displayBuild(appBuild);
  const newerBuild =
    deployedBuild && deployedBuild !== appBuild
      ? displayBuild(deployedBuild)
      : null;
  const containerClassName =
    placement === "profile"
      ? "flex min-w-0 flex-col items-end gap-0.5 px-2 py-1 text-xs leading-tight"
      : "flex min-w-0 flex-col gap-0.5 text-xs leading-tight";
  const buildClassName =
    placement === "profile"
      ? "flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground opacity-50 transition-colors hover:text-foreground"
      : "flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground transition-colors hover:text-foreground";
  const buildIconClassName = placement === "profile" ? "size-3" : "size-3.5";

  const buildLabel = t("build", { build: visibleBuild });

  return (
    <div className={containerClassName}>
      {isCommitSha(appBuild) ? (
        <Link
          href={`${FORK_REPO_URL}/commit/${appBuild}`}
          target="_blank"
          rel="noopener noreferrer"
          title={t("build_title", { build: appBuild })}
          className={buildClassName}
        >
          <GitBranch className={`${buildIconClassName} shrink-0`} />
          <span className="truncate">{buildLabel}</span>
        </Link>
      ) : (
        <span className={buildClassName}>
          <GitBranch className={`${buildIconClassName} shrink-0`} />
          <span className="truncate">{buildLabel}</span>
        </span>
      )}
      {newerBuild && updateStatus === "ready" ? (
        <Button
          type="button"
          size="sm"
          onClick={activateUpdate}
          className="mt-1 h-7 w-full justify-start gap-1.5 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
        >
          <RefreshCw className="size-3.5" />
          {t("update_now")}
        </Button>
      ) : (
        newerBuild && (
          <span className="truncate pl-5 font-mono text-xs text-muted-foreground opacity-50">
            {t("update_available", { build: newerBuild })}
          </span>
        )
      )}
    </div>
  );
}
