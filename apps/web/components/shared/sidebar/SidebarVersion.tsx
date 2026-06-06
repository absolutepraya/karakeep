"use client";

import Link from "next/link";
import { GitBranch, Github } from "lucide-react";

// This is a fork: the sidebar links to the fork's repo and shows the git commit
// it was built from (linking to that commit) rather than upstream Karakeep tags.
const FORK_REPO = "absolutepraya/karakeep";
const FORK_REPO_URL = `https://github.com/${FORK_REPO}`;

function isCommitSha(value?: string): value is string {
  return !!value && /^[0-9a-f]{7,40}$/i.test(value);
}

interface SidebarVersionProps {
  // The fork's build identifier - a git commit SHA in both dev and deploy.
  serverVersion?: string;
  changeLogVersion?: string;
}

export default function SidebarVersion({ serverVersion }: SidebarVersionProps) {
  const commit = serverVersion ?? "unknown";
  const isSha = isCommitSha(commit);

  return (
    <div className="mt-auto flex min-w-0 flex-col gap-0.5 border-t pt-2 text-xs leading-tight">
      <Link
        href={FORK_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Github className="size-3.5 shrink-0" />
        <span className="truncate">{FORK_REPO}</span>
      </Link>
      {isSha ? (
        <Link
          href={`${FORK_REPO_URL}/commit/${commit}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Fork build ${commit}`}
          className="flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground transition-colors hover:text-foreground"
        >
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{commit.slice(0, 7)}</span>
        </Link>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5 font-mono text-muted-foreground">
          <GitBranch className="size-3.5 shrink-0" />
          <span className="truncate">{commit}</span>
        </span>
      )}
    </div>
  );
}
