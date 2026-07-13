// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LibrarySyncConflictDialog from "./LibrarySyncConflictDialog";

const bookmark = vi.hoisted(() => ({ title: "Read later" }));

vi.mock("@/lib/offline-library/repository", () => ({
  offlineLibraryDb: {
    bookmarks: { get: () => Promise.resolve(bookmark) },
  },
}));

const conflict = {
  bookmarkId: "bookmark-1",
  field: "title",
  localValue: "Offline title",
  serverValue: "Server title",
  serverVersion: 4,
};

afterEach(cleanup);

describe("LibrarySyncConflictDialog", () => {
  it("shows the bookmark, field, and both conflicting values", async () => {
    render(
      <LibrarySyncConflictDialog
        conflict={conflict}
        onChooseLocal={vi.fn().mockResolvedValue(undefined)}
        onChooseServer={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Resolve library sync conflict" }),
    ).toBeTruthy();
    expect(screen.getByText("title")).toBeTruthy();
    expect(screen.getByText("Offline title")).toBeTruthy();
    expect(screen.getByText("Server title")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Read later")).toBeTruthy());
  });

  it("keeps the dialog open when a resolution transaction fails", async () => {
    const onChooseLocal = vi
      .fn()
      .mockRejectedValue(new Error("transaction failed"));
    render(
      <LibrarySyncConflictDialog
        conflict={conflict}
        onChooseLocal={onChooseLocal}
        onChooseServer={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Keep offline value" }));

    await waitFor(() => expect(onChooseLocal).toHaveBeenCalledWith(conflict));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes only after the successful resolution callback clears the conflict", async () => {
    const onChooseServer = vi.fn();
    function Harness() {
      const [currentConflict, setCurrentConflict] = React.useState<
        typeof conflict | null
      >(conflict);
      return (
        <LibrarySyncConflictDialog
          conflict={currentConflict}
          onChooseLocal={vi.fn().mockResolvedValue(undefined)}
          onChooseServer={async (resolvedConflict) => {
            await onChooseServer(resolvedConflict);
            setCurrentConflict(null);
          }}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Use server value" }));

    await waitFor(() => expect(onChooseServer).toHaveBeenCalledWith(conflict));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
