import { useTranslation } from "@/lib/i18n/server";
import { TFunction } from "i18next";

import MobileAddButton from "./MobileAddButton";
import MobileSidebarItem from "./ModileSidebarItem";
import { TSidebarItem } from "./TSidebarItem";

export default async function MobileSidebar({
  items,
}: {
  items: (t: TFunction) => TSidebarItem[];
}) {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();
  return (
    <nav
      className="fixed inset-x-3 bottom-0 z-40 sm:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
    >
      <ul className="flex items-center gap-0.5 rounded-2xl border bg-card/90 p-1 shadow-lg backdrop-blur-md">
        {items(t).map((item) => (
          <MobileSidebarItem
            key={item.name}
            name={item.name}
            logo={item.icon}
            path={item.path}
          />
        ))}
        <MobileAddButton />
      </ul>
    </nav>
  );
}
