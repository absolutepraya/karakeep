"use client";

import Link from "next/link";

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
    <div className="mt-auto flex items-center gap-2.5 border-t pt-2 text-xs">
      <div className="flex min-w-0 flex-col leading-tight">
        <Link
          href={FORK_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-muted-foreground transition-colors hover:text-foreground"
        >
          {FORK_REPO}
        </Link>
        {isSha ? (
          <Link
            href={`${FORK_REPO_URL}/commit/${commit}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Fork build ${commit}`}
            className="truncate font-mono text-muted-foreground transition-colors hover:text-foreground"
          >
            {commit.slice(0, 7)}
          </Link>
        ) : (
          <span className="truncate font-mono text-muted-foreground">
            {commit}
          </span>
        )}
      </div>
    </div>
  );
}
