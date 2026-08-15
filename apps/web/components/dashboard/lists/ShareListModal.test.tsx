// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("./PublicListLink", () => ({
  default: () => <div data-testid="public-list-link">Public list settings</div>,
}));

vi.mock("./RssLink", () => ({
  default: () => <div data-testid="rss-link">RSS settings</div>,
}));

import { ShareListModal } from "./ShareListModal";

describe("ShareListModal", () => {
  it("keeps interactive sharing controls outside the dialog description", () => {
    render(
      <ShareListModal
        open
        setOpen={() => undefined}
        list={{ id: "list-id" } as never}
      />,
    );

    const dialog = screen.getByRole("dialog");
    const descriptionId = dialog.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();

    const description = document.getElementById(descriptionId!);
    expect(description?.tagName).toBe("P");
    expect(description?.querySelector("div")).toBeNull();

    expect(screen.getByTestId("public-list-link")).toBeTruthy();
    expect(screen.getByTestId("rss-link")).toBeTruthy();
  });
});
