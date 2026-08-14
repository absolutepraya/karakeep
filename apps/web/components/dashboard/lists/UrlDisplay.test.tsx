// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UrlDisplay } from "./UrlDisplay";

describe("UrlDisplay", () => {
  it("renders a focusable read-only URL without using an input", () => {
    const value = "https://example.com/public/lists/list-id";

    render(<UrlDisplay value={value} label="Public list URL" />);

    const display = screen.getByRole("textbox", { name: "Public list URL" });
    expect(display.tagName).toBe("DIV");
    expect(display.getAttribute("contenteditable")).toBeNull();
    expect(display.getAttribute("aria-readonly")).toBe("true");
    expect(display.tabIndex).toBe(0);
    expect(display.textContent).toBe(value);
  });
});
