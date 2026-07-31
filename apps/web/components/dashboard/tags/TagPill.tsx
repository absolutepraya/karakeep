import React, { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useDragAndDrop } from "@/lib/drag-and-drop";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { X } from "lucide-react";
import Draggable from "react-draggable";

import { useMergeTag } from "@karakeep/shared-react/hooks/tags";

export const TagPill = React.memo(function TagPill({
  id,
  name,
  count,
  isDraggable,
  onOpenDialog,
}: {
  id: string;
  name: string;
  count: number;
  isDraggable: boolean;
  onOpenDialog: (tag: { id: string; name: string }) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();
  const draggableRef = useRef<HTMLDivElement>(null);

  const handleMouseOver = () => setIsHovered(true);
  const handleMouseOut = () => setIsHovered(false);

  const { mutate: mergeTag } = useMergeTag({
    onSuccess: () => {
      toast({
        description: "Tags have been merged!",
      });
    },
    onError: (e) => {
      if (e.data?.code == "BAD_REQUEST") {
        if (e.data.zodError) {
          toast({
            variant: "destructive",
            description: Object.values(e.data.zodError.fieldErrors)
              .flat()
              .join("\n"),
          });
        } else {
          toast({
            variant: "destructive",
            description: e.message,
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Something went wrong",
        });
      }
    },
  });

  const dragAndDropFunction = useDragAndDrop(
    "data-id",
    (dragTargetId: string) => {
      mergeTag({
        fromTagIds: [id],
        intoTagId: dragTargetId,
      });
    },
  );

  const pill = (
    <div
      className="group flex items-center rounded-md border border-border bg-background text-xs text-foreground transition-colors hover:bg-foreground hover:text-background"
      onMouseEnter={handleMouseOver}
      onFocus={handleMouseOver}
      onMouseLeave={handleMouseOut}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          handleMouseOut();
        }
      }}
      ref={draggableRef}
    >
      <Link
        className="flex min-w-0 items-center gap-1.5 px-2 py-0.5"
        href={`/dashboard/tags/${id}`}
        data-id={id}
        draggable={false}
        prefetch={false}
      >
        <span className="truncate">{name}</span>
        <span aria-hidden="true" className="border-current/30 h-3 border-l" />
        <span>{count}</span>
      </Link>

      {(isHovered || isMobile) && !isDraggable && (
        <Button
          size="none"
          variant="ghost"
          className="mr-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm text-current hover:bg-background/20 hover:text-current"
          aria-label={`Delete ${name}`}
          onClick={() => onOpenDialog({ id, name })}
        >
          <X className="size-3" />
        </Button>
      )}
    </div>
  );
  if (!isDraggable) {
    return pill;
  }
  return (
    <Draggable
      key={id}
      axis="both"
      onStart={dragAndDropFunction.handleDragStart}
      onStop={dragAndDropFunction.handleDragEnd}
      disabled={!isDraggable}
      defaultClassNameDragging={"position-relative z-10 pointer-events-none"}
      position={{ x: 0, y: 0 }}
      nodeRef={draggableRef}
    >
      {pill}
    </Draggable>
  );
});
