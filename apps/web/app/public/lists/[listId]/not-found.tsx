import Link from "next/link";
import MarkaLogo from "@/components/MarkaLogo";
import { Button } from "@/components/ui/button";
import { MARKA } from "@/lib/brand";
import { Home, SearchX } from "lucide-react";

export default function PublicListPageNotFound() {
  return (
    <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center py-8 sm:min-h-[calc(100vh-3rem)]">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          aria-label={`${MARKA.name} home`}
          className="inline-flex"
        >
          <MarkaLogo height={32} />
        </Link>
        <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          This list isn’t available
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground sm:text-base">
          This list may have been made private, deleted, or the link may be
          incorrect.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <Home className="size-4" />
            Go to {MARKA.name}
          </Link>
        </Button>
      </div>
    </div>
  );
}
