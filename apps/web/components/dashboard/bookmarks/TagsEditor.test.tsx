// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TagsEditor } from "./TagsEditor";

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CommandEmpty: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CommandGroup: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CommandItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CommandList: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/lib/clientConfig", () => ({ useClientConfig: () => ({}) }));
vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));
vi.mock("@/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
}));
vi.mock("@tanstack/react-query", () => ({
  keepPreviousData: undefined,
  useQuery: () => ({ data: undefined, isLoading: false }),
}));
vi.mock("@karakeep/shared-react/trpc", () => ({
  useTRPC: () => ({ tags: { list: { queryOptions: () => ({}) } } }),
}));
vi.mock("cmdk", () => ({
  Command: {
    Input: ({
      onValueChange,
      ...props
    }: React.ComponentProps<"input"> & {
      onValueChange?: (value: string) => void;
    }) => (
      <input
        {...props}
        onChange={(event) => onValueChange?.(event.target.value)}
      />
    ),
  },
}));
vi.mock("lucide-react", () => ({
  Check: () => null,
  Loader2: () => null,
  Plus: () => null,
  Sparkles: () => null,
  X: () => null,
}));

describe("TagsEditor", () => {
  it("keeps the persisted tags visible when the durable tag queue rejects", async () => {
    const onDetach = vi.fn().mockRejectedValue(new Error("queue unavailable"));
    render(
      <TagsEditor
        tags={[{ id: "tag-1", name: "Existing", attachedBy: "human" }]}
        onAttach={vi.fn()}
        onDetach={onDetach}
        allowCreation={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove Existing" }));

    await waitFor(() => expect(onDetach).toHaveBeenCalledWith({
      tagId: "tag-1",
      tagName: "Existing",
    }));
    expect(screen.getByText("Existing")).toBeTruthy();
  });
});
