"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function SidebarItem({
  name,
  logo,
  path,
  className,
  linkClassName,
  style,
  collapseButton,
  right = null,
  dropHighlight = false,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
}: {
  name: string;
  logo: React.ReactNode;
  path: string;
  style?: React.CSSProperties;
  className?: string;
  linkClassName?: string;
  right?: React.ReactNode;
  collapseButton?: React.ReactNode;
  dropHighlight?: boolean;
  onDrop?: React.DragEventHandler;
  onDragOver?: React.DragEventHandler;
  onDragEnter?: React.DragEventHandler;
  onDragLeave?: React.DragEventHandler;
}) {
  const currentPath = usePathname();
  const isActive = path == currentPath;

  return (
    <li
      className={cn(
        "ease-(--ease-out) group relative flex min-w-0 items-center justify-between overflow-hidden rounded-xl text-sm transition-[background-color,color,box-shadow,ring-color] duration-150",
        isActive
          ? "shadow-xs bg-background text-foreground"
          : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
        dropHighlight &&
          "bg-primary/10 text-foreground shadow-inner shadow-primary/20 ring-1 ring-inset ring-primary/60",
        className,
      )}
      style={style}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      <div className="flex min-w-0 flex-1 items-center rounded-l-[inherit]">
        {collapseButton}
        <Link
          href={path}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-x-2 rounded-[inherit] px-3 py-2.5",
            linkClassName,
          )}
        >
          <span
            className={cn(
              "ease-(--ease-out) flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-150",
              isActive ? "text-foreground" : "group-hover:text-foreground",
            )}
          >
            {logo}
          </span>
          <span title={name} className="min-w-0 truncate font-medium">
            {name}
          </span>
        </Link>
      </div>
      {right}
    </li>
  );
}
