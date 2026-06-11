import Link from "next/link";
import { redirect } from "next/navigation";
import GlobalActions from "@/components/dashboard/GlobalActions";
import ProfileOptions from "@/components/dashboard/header/ProfileOptions";
import { SearchInput } from "@/components/dashboard/search/SearchInput";
import KarakeepLogo from "@/components/KarakeepIcon";
import { getServerAuthSession } from "@/server/auth";

export default async function Header() {
  const session = await getServerAuthSession();
  if (!session) {
    redirect("/");
  }

  return (
    <header className="bg-sidebar/95 border-sidebar-border/70 supports-[backdrop-filter]:bg-sidebar/85 sticky left-0 right-0 top-0 z-50 border-b backdrop-blur">
      <div className="flex h-16 items-center gap-3 overflow-x-auto overflow-y-hidden px-3 sm:px-4">
        <div className="hidden shrink-0 items-center sm:flex">
          <Link
            href={"/dashboard/bookmarks"}
            className="flex w-56 items-center"
          >
            <KarakeepLogo height={38} />
          </Link>
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
          <div className="min-w-0 flex-1 lg:max-w-4xl">
            <SearchInput />
          </div>
          <GlobalActions />
        </div>
        <div className="ml-1 flex shrink-0 items-center sm:ml-2">
          <ProfileOptions />
        </div>
      </div>
    </header>
  );
}
