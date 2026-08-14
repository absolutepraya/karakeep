import Link from "next/link";
import KarakeepLogo from "@/components/KarakeepIcon";
import { buttonVariants } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import { RssIcon } from "lucide-react";

export default function PublicListHeader({
  list,
}: {
  list: {
    id: string;
    name: string;
    description: string | null | undefined;
    icon: string;
    ownerName: string;
    ownerImage: string | null;
    numItems: number;
  };
}) {
  const rssLink = `/api/v1/rss/lists/${list.id}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" aria-label="Karakeep home" className="inline-flex">
          <KarakeepLogo height={30} />
        </Link>
        <Link
          href={rssLink}
          target="_blank"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-2",
          )}
        >
          <RssIcon className="size-4" />
          RSS
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-4xl">
            {list.icon}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold leading-tight">
              {list.name}
            </h1>
            {list.description && (
              <p className="mt-1 text-muted-foreground">{list.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{list.numItems} bookmarks</span>
              <span aria-hidden>·</span>
              <span>Public list</span>
              <span aria-hidden>·</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <UserAvatar
                  name={list.ownerName}
                  image={list.ownerImage}
                  className="size-5 shrink-0"
                  fallbackClassName="uppercase"
                />
                <span className="truncate">{list.ownerName}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
