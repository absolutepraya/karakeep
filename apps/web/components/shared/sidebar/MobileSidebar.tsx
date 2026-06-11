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
  // Lift the floating pill clear of the phone's home-indicator / gesture
  // handle: the device safe-area inset when it resolves (iOS standalone), plus
  // a comfortable static gap so there's breathing room even in plain browser
  // tabs where `env()` reports 0.
  return (
    <nav
      className="fixed inset-x-3 bottom-0 z-40 sm:hidden"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
    >
      {/* Horizontally scrollable so dense navs (e.g. settings, 13 items) don't
          overflow the viewport; the few-item dashboard nav still spreads to
          fill since each item can grow past its basis. Scrollbar is hidden for
          the clean floating-pill look. */}
      <ul className="flex items-center gap-1 overflow-x-auto overscroll-x-contain rounded-[1.35rem] border border-border/80 bg-card/95 p-1.5 shadow-lg shadow-black/5 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] supports-[backdrop-filter]:bg-card/80 [&::-webkit-scrollbar]:hidden">
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
