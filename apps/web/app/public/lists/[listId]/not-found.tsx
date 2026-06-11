import { EmptyState } from "@/components/shared/EmptyState";
import { SearchX } from "lucide-react";

export default function PublicListPageNotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-1 items-center justify-center px-4 py-16">
      <EmptyState
        icon={<SearchX strokeWidth={1.75} />}
        title="List not found"
        titleAs="h1"
        description="The list you’re looking for doesn’t exist, is no longer public, or may have been removed."
      />
    </div>
  );
}
