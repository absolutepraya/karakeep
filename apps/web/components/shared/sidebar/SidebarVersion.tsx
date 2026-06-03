"use client";

import Link from "next/link";

// This is a fork, so the sidebar shows the git commit it was built from and
// links to the fork's repo rather than upstream Karakeep release tags.
const FORK_REPO_URL = "https://github.com/absolutepraya/karakeep";

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
  const href = isSha ? `${FORK_REPO_URL}/commit/${commit}` : FORK_REPO_URL;

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={isSha ? `Fork build ${commit}` : undefined}
      className="mt-auto flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span>Karakeep fork</span>
      <span aria-hidden>·</span>
      <span className="font-mono">{isSha ? commit.slice(0, 7) : commit}</span>
    </Link>
  );
}
