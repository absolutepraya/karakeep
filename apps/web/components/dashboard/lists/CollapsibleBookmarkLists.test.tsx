// @vitest-environment jsdom

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ZBookmarkList } from "@karakeep/shared/types/lists";
import { listsToTree } from "@karakeep/shared/utils/listUtils";

import { CollapsibleBookmarkLists } from "./CollapsibleBookmarkLists";

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: () => ({ data: { stats: new Map<string, number>() } }),
  };
});

vi.mock("@karakeep/shared-react/trpc", () => ({
  useTRPC: () => ({
    lists: {
      list: {
        queryOptions: () => ({}),
      },
      stats: {
        queryOptions: () => ({}),
      },
    },
  }),
}));

function list(
  id: string,
  name: string,
  parentId: string | null = null,
): ZBookmarkList {
  return {
    id,
    name,
    parentId,
    description: null,
    icon: "📁",
    type: "manual",
    query: null,
    public: false,
    hasCollaborators: false,
    userRole: "owner",
  };
}

describe("CollapsibleBookmarkLists", () => {
  it("does not render an empty collapsible content region for a selected leaf list", async () => {
    const lists = [list("parent", "Parent"), list("leaf", "Leaf", "parent")];
    const listsData = { data: lists, ...listsToTree(lists) };

    render(
      <CollapsibleBookmarkLists
        listsData={listsData}
        isOpenFunc={(node) => node.item.id === "leaf"}
        render={({ node }) => (
          <div data-testid={`list-row-${node.item.id}`}>{node.item.name}</div>
        )}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("list-row-leaf")).toBeTruthy();
    });

    expect(
      document.querySelectorAll('[class*="animate-collapsible"]'),
    ).toHaveLength(1);
  });
});
