// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UrlDisplay } from "./UrlDisplay";

describe("UrlDisplay", () => {
  it.each([
    {
      label: "Share Link",
      value: "https://example.com/public/lists/list-id",
    },
    {
      label: "RSS Feed URL",
      value: "https://api.example.com/v1/rss/lists/list-id?token=rss-token",
    },
  ])("renders $label without textbox semantics", ({ label, value }) => {
    render(<UrlDisplay value={value} label={label} />);

    const display = screen.getByRole("group", { name: `${label}: ${value}` });
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
