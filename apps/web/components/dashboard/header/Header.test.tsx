// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    cleanup();
  });

  it("uses a left-aligned Marka wordmark in the original reserved logo slot", async () => {
    render(await Header());

    const header = screen.getByRole("banner");
    const link = screen.getByRole("link", { name: "Marka" });
    const search = screen.getByRole("textbox", { name: "Search" });
    expect(link.getAttribute("href")).toBe("/dashboard/bookmarks");
    expect(link.classList.contains("justify-start")).toBe(true);
    expect(link.classList.contains("w-56")).toBe(true);
    expect(link.classList.contains("pl-2")).toBe(true);
    expect(screen.getByAltText("Marka").getAttribute("height")).toBe("30");
    expect(header.firstElementChild?.className).toContain(
      "lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]",
    );
    expect(search.parentElement?.className).toContain("lg:col-start-2");
  });

  it("groups the status rectangle and profile avatar with the avatar on top", async () => {
    render(await Header());

    const profile = screen.getByRole("button", { name: "Profile" });
    const avatarLayer = profile.parentElement;
    const controls = avatarLayer?.parentElement;

    expect(avatarLayer?.className).toContain("absolute");
    expect(avatarLayer?.className).toContain("right-0");
    expect(avatarLayer?.className).toContain("top-1/2");
    expect(avatarLayer?.className).toContain("-translate-y-1/2");
    expect(avatarLayer?.className).toContain("size-10");
    expect(avatarLayer?.className).toContain("z-10");
    expect(controls?.className).toContain("relative");
    expect(controls?.className).toContain("h-10");
    expect(controls?.className).toContain("pr-5");
  });
});
