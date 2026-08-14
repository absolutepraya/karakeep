// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UrlDisplay } from "./UrlDisplay";

describe("UrlDisplay", () => {
  it("renders URL text without textbox semantics", () => {
    const value = "https://example.com/public/lists/list-id";

    render(<UrlDisplay value={value} label="Public list URL" />);

    const display = screen.getByLabelText("Public list URL");
    expect(display.tagName).toBe("DIV");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(display.getAttribute("contenteditable")).toBeNull();
    expect(display.getAttribute("tabindex")).toBeNull();
    expect(display.textContent).toBe(value);
    expect(display.classList.contains("min-w-0")).toBe(true);
    expect(display.classList.contains("flex-1")).toBe(true);
    expect(display.firstElementChild?.classList.contains("min-w-0")).toBe(true);
    expect(display.firstElementChild?.classList.contains("flex-1")).toBe(true);
    expect(display.firstElementChild?.classList.contains("truncate")).toBe(
      true,
    );
  });
});
