// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MobileAddButton from "./MobileAddButton";

vi.mock("@/components/dashboard/bookmarks/EditorCard", () => ({
  default: ({ className }: { className?: string }) => (
    <form className={className}>Bookmark editor</form>
  ),
}));

vi.mock("@/lib/haptic", () => ({
  haptic: vi.fn(),
}));

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("MobileAddButton", () => {
  it("opens the bookmark editor when tapped", () => {
    render(
      <ul>
        <MobileAddButton />
      </ul>,
    );

    fireEvent.click(screen.getByRole("button", { name: "editor.new_item" }));

    expect(screen.getByText("Bookmark editor")).toBeTruthy();
    expect(screen.getByRole("dialog").className).toContain("dialog-vv-bottom");
    expect(screen.getByRole("dialog").className).not.toContain(
      "dialog-vv-center",
    );
    expect(screen.getByText("Bookmark editor").className).toContain(
      "mb-[calc(env(safe-area-inset-bottom)+1.5rem)]",
    );
  });
});
