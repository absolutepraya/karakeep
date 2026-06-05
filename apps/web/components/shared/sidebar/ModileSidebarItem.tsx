"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

export default function MobileSidebarItem({
  name,
  logo,
  path,
}: {
  name: string;
  logo: React.ReactNode;
  path: string;
}) {
  const currentPath = usePathname();
  const isActive = path == currentPath;
  const ref = useRef<HTMLLIElement>(null);

  // When the nav scrolls horizontally (dense settings nav), keep the active
  // tab in view so the user can always see where they are.
  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [isActive]);

  return (
    // basis lets items keep a comfortable min width and scroll when there are
    // many; grow makes the few-item dashboard nav spread to fill the bar.
    <li ref={ref} className="flex min-w-0 shrink-0 grow basis-[3.25rem]">
      <Link
        onClick={haptic}
        href={path}
        title={name}
        aria-label={name}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-colors active:bg-accent",
          isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {logo}
        <span className="max-w-full truncate text-[0.5625rem] leading-none">
          {name}
        </span>
      </Link>
    </li>
  );
}
