"use client";

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
  return (
    <li className="flex flex-1">
      <Link
        onClick={haptic}
        href={path}
        title={name}
        className={cn(
          "flex min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 transition-colors active:bg-accent",
          isActive
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-foreground",
        )}
      >
        {logo}
        <span className="max-w-full truncate text-[0.625rem] leading-tight">
          {name}
        </span>
      </Link>
    </li>
  );
}
