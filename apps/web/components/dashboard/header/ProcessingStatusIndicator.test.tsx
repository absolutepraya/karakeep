// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProcessingStatusIndicator from "./ProcessingStatusIndicator";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: {
      total: 3,
      tasks: [
        { kind: "crawling", count: 1 },
        { kind: "embedding", count: 2 },
      ],
    },
  }),
}));

vi.mock("@karakeep/shared-react/trpc", () => ({
  useTRPC: () => ({
    bookmarks: {
      getProcessingStatus: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("ProcessingStatusIndicator", () => {
  it("shows the current account's total and processing breakdown", () => {
    render(<ProcessingStatusIndicator />);

    const button = screen.getByRole("button", {
      name: "3 background tasks processing",
    });
    expect(button.textContent).toContain("3");
    expect(screen.getByText("Crawling")).toBeTruthy();
    expect(screen.getByText("Embedding")).toBeTruthy();
  });
});
