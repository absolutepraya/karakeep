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
      {/* Horizontally scrollable so dense navs (e.g. settings, 13 items) don't
          overflow the viewport; the few-item dashboard nav still spreads to
          fill since each item can grow past its basis. Scrollbar is hidden for
          the clean floating-pill look. */}
      <ul className="flex items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-2xl border bg-card/90 p-1 shadow-lg backdrop-blur-md [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
