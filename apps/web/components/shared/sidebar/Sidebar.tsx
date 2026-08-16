import { useTranslation } from "@/lib/i18n/server";
import { TFunction } from "i18next";

import SidebarItem from "./SidebarItem";
import SidebarVersion from "./SidebarVersion";
import { TSidebarItem } from "./TSidebarItem";

export default async function Sidebar({
  items,
  extraSections,
}: {
  items: (t: TFunction) => TSidebarItem[];
  extraSections?: React.ReactNode;
}) {
  // oxlint-disable-next-line rules-of-hooks
  const { t } = await useTranslation();

  return (
    <aside className="sidebar-scrollbar flex h-[calc(100vh-64px)] w-64 flex-col gap-4 overflow-y-auto px-3 py-4">
      <div>
        <ul className="space-y-1 text-sm">
          {items(t).map((item) => (
            <SidebarItem
              key={item.name}
              logo={item.icon}
              name={item.name}
              path={item.path}
            />
          ))}
        </ul>
      </div>
      {extraSections}
      <SidebarVersion />
    </aside>
  );
}
