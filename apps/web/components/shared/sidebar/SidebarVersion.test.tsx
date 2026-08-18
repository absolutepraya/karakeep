// @vitest-environment jsdom

import React from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SidebarVersion from "./SidebarVersion";

const mocks = vi.hoisted(() => ({
  lifecycle: {
    appBuild: "aaaaaaa",
    deployedBuild: "bbbbbbb" as string | null,
    updateStatus: "ready" as "current" | "available" | "ready",
    activateUpdate: vi.fn(),
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/pwa/ServiceWorkerRegistration", () => ({
  usePwaLifecycle: () => mocks.lifecycle,
}));

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { build?: string }) => {
      const translations: Record<string, string> = {
        build: `Build ${values?.build ?? ""}`,
        update_available: `Update available · ${values?.build ?? ""}`,
        update_ready: `Update ready · ${values?.build ?? ""}`,
        update_now: "Update now",
      };
      return translations[key] ?? key;
    },
  }),
}));

describe("SidebarVersion", () => {
  beforeEach(() => {
    mocks.lifecycle.appBuild = "aaaaaaa";
    mocks.lifecycle.deployedBuild = "bbbbbbb";
    mocks.lifecycle.updateStatus = "ready";
    mocks.lifecycle.activateUpdate.mockReset();
  });

  it("shows the running app build and a ready deployed update", () => {
    const { container } = render(<SidebarVersion />);

    expect(container.textContent).toContain("absolutepraya/marka");
    expect(container.textContent).toContain("Build aaaaaaa");
    expect(container.textContent).toContain("Update now");
    expect(container.querySelector("button")).not.toBeNull();
    fireEvent.click(container.querySelector("button")!);
    expect(mocks.lifecycle.activateUpdate).toHaveBeenCalledOnce();

    const buildLink = container.querySelector(
      'a[href="https://github.com/absolutepraya/marka/commit/aaaaaaa"]',
    );
    expect(buildLink).not.toBeNull();
  });

  it("shows an available update before its worker is ready", () => {
    mocks.lifecycle.updateStatus = "available";

    const { container } = render(<SidebarVersion />);

    expect(container.textContent).toContain("Build aaaaaaa");
    expect(container.textContent).toContain("Update available · bbbbbbb");
    expect(container.textContent).not.toContain("Update ready");
    expect(container.querySelector("button")).toBeNull();
  });

  it("does not show an update line when the deployed build matches", () => {
    mocks.lifecycle.deployedBuild = "aaaaaaa";
    mocks.lifecycle.updateStatus = "current";

    const { container } = render(<SidebarVersion />);

    expect(container.textContent).toContain("Build aaaaaaa");
    expect(container.textContent).not.toContain("Update available");
    expect(container.textContent).not.toContain("Update ready");
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders a non-SHA build without a commit link", () => {
    mocks.lifecycle.appBuild = "development";
    mocks.lifecycle.deployedBuild = "development";
    mocks.lifecycle.updateStatus = "current";

    const { container } = render(<SidebarVersion />);

    expect(container.textContent).toContain("Build development");
    expect(container.querySelector('a[href*="/commit/"]')).toBeNull();
  });
});
