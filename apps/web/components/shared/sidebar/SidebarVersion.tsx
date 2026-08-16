"use client";

import React from "react";
import Link from "next/link";
import { usePwaLifecycle } from "@/components/pwa/ServiceWorkerRegistration";
import { useTranslation } from "@/lib/i18n/client";
import { GitBranch, Github } from "lucide-react";

const FORK_REPO = "absolutepraya/karakeep";
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
  const { appBuild, deployedBuild, updateStatus } = usePwaLifecycle();
  const visibleBuild = displayBuild(appBuild);
  const newerBuild =
    deployedBuild && deployedBuild !== appBuild
      ? displayBuild(deployedBuild)
      : null;
  const containerClassName =
    placement === "profile"
      ? "flex min-w-0 flex-col gap-0.5 px-2 py-1 text-xs leading-tight"
      : "mt-auto flex min-w-0 flex-col gap-0.5 border-t pt-4 text-xs leading-tight";

  const buildLabel = t("build", { build: visibleBuild });

  return (
    <div className={containerClassName}>
      <Link
        href={FORK_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Github className="size-3.5 shrink-0" />
        <span className="truncate">{FORK_REPO}</span>
      </Link>
      {isCommitSha(appBuild) ? (
        <Link
          href={`${FORK_REPO_URL}/commit/${appBuild}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Fork build ${appBuild}`}
          className="flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground transition-colors hover:text-foreground"
        >
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{buildLabel}</span>
        </Link>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground">
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{buildLabel}</span>
        </span>
      )}
      {newerBuild && (
        <span className="truncate pl-5 font-mono text-muted-foreground">
          {updateStatus === "ready"
            ? t("update_ready", { build: newerBuild })
            : t("update_available", { build: newerBuild })}
        </span>
      )}
    </div>
  );
}
