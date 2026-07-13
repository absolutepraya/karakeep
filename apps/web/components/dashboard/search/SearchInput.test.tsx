// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SearchInput } from "./SearchInput";

class ResizeObserver {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

vi.stubGlobal("ResizeObserver", ResizeObserver);

vi.mock("@/lib/hooks/bookmark-search", () => ({
  useDoBookmarkSearch: () => ({
    debounceSearch: vi.fn(),
    searchQuery: "",
    doSearch: vi.fn(),
    parsedSearchQuery: { result: "empty" },
    isInSearchPage: false,
  }),
}));

vi.mock("@/lib/offline-library/provider", () => ({
  useOfflineLibraryStatus: () => ({ kind: "online", lastSyncedAt: new Date(), pendingWrites: 0 }),
}));

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@karakeep/shared-react/hooks/search-history", () => ({
  useSearchHistory: () => ({ addTerm: vi.fn(), history: [] }),
}));

vi.mock("../lists/EditListModal", () => ({
  EditListModal: () => null,
}));

vi.mock("./QueryExplainerTooltip", () => ({
  default: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

vi.mock("./useSearchAutocomplete", () => ({
  useSearchAutocomplete: ({ isPopoverOpen }: { isPopoverOpen: boolean }) => ({
    suggestionGroups: [
      {
        id: "history",
        label: "Recent searches",
        items: [
          {
            type: "history",
            id: "recent-query",
            label: "Recent query",
            term: "recent query",
            Icon: () => null,
          },
        ],
      },
    ],
    hasSuggestions: true,
    isPopoverVisible: isPopoverOpen,
    handleSuggestionSelect: vi.fn(),
    handleCommandKeyDown: vi.fn(),
  }),
}));

describe("SearchInput", () => {
  it("keeps the input focused when opening autocomplete suggestions", async () => {
    render(<SearchInput />);

    const input = screen.getByPlaceholderText("common.search");
    expect(fireEvent.pointerDown(input, { button: 0, ctrlKey: false })).toBe(
      true,
    );
    input.focus();

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });
  });
});
