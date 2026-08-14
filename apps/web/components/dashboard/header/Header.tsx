import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileOptions from "@/components/dashboard/header/ProfileOptions";
import ProcessingStatusIndicator from "@/components/dashboard/header/ProcessingStatusIndicator";
import { SearchInput } from "@/components/dashboard/search/SearchInput";
import MarkaLogo from "@/components/MarkaLogo";
import { getServerAuthSession } from "@/server/auth";

export default async function Header() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/");
  }

  return (
    <header className="bg-sidebar/95 supports-[backdrop-filter]:bg-sidebar/85 sticky left-0 right-0 top-0 z-50 backdrop-blur">
      <div className="flex h-16 items-center gap-3 overflow-x-auto overflow-y-hidden px-3 sm:px-4">
        <div className="hidden shrink-0 items-center sm:flex">
          <Link
            href={"/dashboard/bookmarks"}
            className="flex w-56 items-center justify-start [&_img]:h-[38px] [&_img]:w-auto"
          >
            <MarkaLogo height={38} />
          </Link>
        </div>
        <div className="min-w-0 flex-1">
          <SearchInput className="w-full" />
        </div>
        <div className="ml-3 flex shrink-0 items-center gap-2 sm:ml-4">
          <ProcessingStatusIndicator />
          <ProfileOptions />
        </div>
      </div>
    </header>
  );
}
