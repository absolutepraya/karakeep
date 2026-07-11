import { useState } from "react";
import {
  Dialog,
  DialogClose,
  ResponsiveDialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/client";

import { Button } from "./button";

export default function ActionConfirmingDialog({
  title,
  description,
  actionButton,
  children,
  open: userIsOpen,
  setOpen: userSetOpen,
}: {
  open?: boolean;
  setOpen?: (v: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  actionButton: (setDialogOpen: (open: boolean) => void) => React.ReactNode;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const [customIsOpen, setCustomIsOpen] = useState(false);
  const [isDialogOpen, setDialogOpen] = [
    userIsOpen ?? customIsOpen,
    userSetOpen ?? setCustomIsOpen,
  ];
  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <ResponsiveDialogContent className="gap-0 p-0">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-6 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 text-sm text-muted-foreground sm:px-6 sm:py-5">
          {description}
        </div>
        <div className="sticky bottom-0 flex gap-2 border-t border-border/70 bg-card px-5 py-4 sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="h-11 flex-1">
              {t("actions.close")}
            </Button>
          </DialogClose>
          <div className="flex-1 [&>button]:h-11 [&>button]:w-full">
            {actionButton(setDialogOpen)}
          </div>
        </div>
      </ResponsiveDialogContent>
    </Dialog>
  );
}
