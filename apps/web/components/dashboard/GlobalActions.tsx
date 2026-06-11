"use client";

import BulkBookmarksAction from "@/components/dashboard/BulkBookmarksAction";
import SortOrderToggle from "@/components/dashboard/SortOrderToggle";
import ViewOptions from "@/components/dashboard/ViewOptions";
import { useTranslation } from "@/lib/i18n/client";
import { useInBookmarkGridStore } from "@/lib/store/useInBookmarkGridStore";
import { useKeyboardNavigationStore } from "@/lib/store/useKeyboardNavigationStore";
import { Keyboard } from "lucide-react";

import { ButtonWithTooltip } from "../ui/button";

export default function GlobalActions() {
  const { t } = useTranslation();
  const inBookmarkGrid = useInBookmarkGridStore(
    (state) => state.inBookmarkGrid,
  );
  const setShortcutsDialogOpen = useKeyboardNavigationStore(
    (state) => state.setShortcutsDialogOpen,
  );
  if (!inBookmarkGrid) {
    return null;
  }

  return (
    <div className="shadow-xs flex min-w-max flex-wrap items-center gap-0.5 rounded-xl border border-border/70 bg-background/80 p-1 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <ViewOptions />
      <BulkBookmarksAction />
      <SortOrderToggle />
      <span className="hidden sm:inline-flex">
        <ButtonWithTooltip
          variant="ghost"
          onClick={() => setShortcutsDialogOpen(true)}
          tooltip={t("keyboard_shortcuts.title")}
          delayDuration={100}
          aria-label={t("keyboard_shortcuts.title")}
        >
          <Keyboard size={18} />
        </ButtonWithTooltip>
      </span>
    </div>
  );
}
