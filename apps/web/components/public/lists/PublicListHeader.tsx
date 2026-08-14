import Link from "next/link";
import MarkaLogo from "@/components/MarkaLogo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookmarkIcon, RssIcon } from "lucide-react";

export default function PublicListHeader({
  list,
}: {
  list: {
    id: string;
    name: string;
    description: string | null | undefined;
    icon: string;
    ownerName: string;
    numItems: number;
  };
}) {
  const rssLink = `/api/v1/rss/lists/${list.id}`;

  return (
    <div className="shadow-xs rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.04] p-6 sm:p-7">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <MarkaLogo height={36} />
          <div className="flex flex-wrap items-center gap-2">
            <div className="shadow-xs rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Public list
            </div>
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
        </div>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="shadow-xs flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/85 text-3xl sm:size-[4.5rem] sm:text-4xl">
              <span>{list.icon}</span>
            </div>
            <div className="min-w-0 space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {list.name}
              </h1>
              {list.description && list.description.length > 0 && (
                <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
                  {list.description}
                </p>
              )}
            </div>
          </div>

          <div className="shadow-xs rounded-2xl border border-border/70 bg-background/85 px-4 py-3 lg:min-w-64">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Curated by
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="shadow-xs flex aspect-square size-10 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground">
                {list.ownerName[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground">{list.ownerName}</p>
                <p className="text-sm text-muted-foreground">
                  Shared from Karakeep
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="shadow-xs inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-sm text-muted-foreground">
            <BookmarkIcon className="size-4" />
            <span>{list.numItems} bookmarks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
