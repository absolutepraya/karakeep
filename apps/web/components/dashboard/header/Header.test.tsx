// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/components/dashboard/header/ProfileOptions", () => ({
  default: () => <button type="button">Profile</button>,
}));

vi.mock("@/components/dashboard/header/ProcessingStatusIndicator", () => ({
  default: () => <span>Processing status</span>,
}));

vi.mock("@/components/dashboard/search/SearchInput", () => ({
  SearchInput: ({ className }: { className?: string }) => (
    <input aria-label="Search" className={className} />
  ),
}));

vi.mock("@/server/auth", () => ({
  getServerAuthSession: vi.fn(async () => ({ user: { id: "user-1" } })),
}));

import Header from "./Header";

describe("Header", () => {
  it("uses a compact left-aligned Marka wordmark without a fixed logo slot", async () => {
    render(await Header());

    const link = screen.getByRole("link", { name: "Marka" });
    expect(link.getAttribute("href")).toBe("/dashboard/bookmarks");
    expect(link.classList.contains("justify-start")).toBe(true);
    expect(link.classList.contains("w-56")).toBe(false);
    expect(link.classList.contains("[&_img]:h-7")).toBe(true);
    expect(link.classList.contains("[&_img]:w-auto")).toBe(true);
    expect(screen.getByAltText("Marka").getAttribute("height")).toBe("28");
  });
});
