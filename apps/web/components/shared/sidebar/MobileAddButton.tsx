"use client";

import { useState } from "react";
import EditorCard from "@/components/dashboard/bookmarks/EditorCard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { haptic } from "@/lib/haptic";
import { useTranslation } from "@/lib/i18n/client";
import { Plus } from "lucide-react";

// The right-most item in the floating mobile nav: a primary-tinted button that
// pops the new-item capture card in a dialog, closing once a bookmark is added.
export default function MobileAddButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t("editor.new_item", { defaultValue: "New item" });

  return (
    <li className="flex min-w-0 shrink-0 grow basis-[3.25rem]">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          onClick={haptic}
          aria-label={label}
          title={label}
          className="ease-(--ease-out) flex w-full flex-col items-center justify-center gap-1 rounded-2xl bg-primary px-2 py-2 text-primary-foreground transition-[opacity,transform] duration-150 active:opacity-90"
        >
          <span className="flex size-5 items-center justify-center">
            <Plus size={18} />
          </span>
          <span className="text-[0.625rem] font-medium leading-none">
            {t("actions.new", { defaultValue: "Add" })}
          </span>
        </DialogTrigger>
        <DialogContent
          hideCloseBtn
          className="max-w-[calc(100vw-2rem)] rounded-2xl p-3 sm:max-w-md"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <EditorCard onCreated={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </li>
  );
}
