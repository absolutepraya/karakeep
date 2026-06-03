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
    <header className="bg-sidebar sticky left-0 right-0 top-0 z-50 flex h-16 items-center justify-between overflow-x-auto overflow-y-hidden p-4">
      <div className="hidden items-center sm:flex">
        <Link href={"/dashboard/bookmarks"} className="w-56">
          <KarakeepLogo height={38} />
        </Link>
      </div>
      <div className="flex flex-1 gap-2">
        <SearchInput />
        <GlobalActions />
      </div>
      <div className="ml-2 flex items-center sm:ml-3">
        <ProfileOptions />
      </div>
    </header>
  );
}
