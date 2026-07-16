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
  className,
}: {
  name: string;
  logo: React.ReactNode;
  path: string;
  className?: string;
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
    <li
      ref={ref}
      className={cn("flex min-w-0 shrink-0 grow basis-[3.25rem]", className)}
    >
      <Link
        onClick={haptic}
        href={path}
        title={name}
        aria-label={name}
        className={cn(
          "ease-(--ease-out) flex w-full flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-[background-color,color,box-shadow,transform] duration-150 active:bg-accent",
          isActive
            ? "shadow-xs bg-background text-foreground"
            : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
        )}
      >
        <span className="flex size-5 items-center justify-center">{logo}</span>
        <span className="max-w-full truncate text-[0.625rem] leading-none">
          {name}
        </span>
      </Link>
    </li>
  );
}
