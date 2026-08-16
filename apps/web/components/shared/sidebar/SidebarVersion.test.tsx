// @vitest-environment jsdom

import React from "react";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SidebarVersion from "./SidebarVersion";

const mocks = vi.hoisted(() => ({
  lifecycle: {
    appBuild: "aaaaaaa",
    deployedBuild: "bbbbbbb" as string | null,
    updateStatus: "ready" as "current" | "available" | "ready",
  },
}));

vi.mock("@/components/pwa/ServiceWorkerRegistration", () => ({
  usePwaLifecycle: () => mocks.lifecycle,
}));

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { build?: string }) => {
      const translations: Record<string, string> = {
        "profile_menu.build": `Build ${values?.build ?? ""}`,
        "profile_menu.update_available": `Update available · ${values?.build ?? ""}`,
        "profile_menu.update_ready": `Update ready · ${values?.build ?? ""}`,
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
  });

  it("shows the running app build and a ready deployed update", () => {
    const { container } = render(<SidebarVersion />);

    expect(container.textContent).toContain("absolutepraya/karakeep");
    expect(container.textContent).toContain("Build aaaaaaa");
    expect(container.textContent).toContain("Update ready · bbbbbbb");

    const buildLink = container.querySelector(
      'a[href="https://github.com/absolutepraya/karakeep/commit/aaaaaaa"]',
    );
    expect(buildLink).not.toBeNull();
  });

  it("shows an available update before its worker is ready", () => {
    mocks.lifecycle.updateStatus = "available";

    const { container } = render(<SidebarVersion />);

    expect(container.textContent).toContain("Build aaaaaaa");
    expect(container.textContent).toContain("Update available · bbbbbbb");
    expect(container.textContent).not.toContain("Update ready");
  });

  it("does not show an update line when the deployed build matches", () => {
    mocks.lifecycle.deployedBuild = "aaaaaaa";
    mocks.lifecycle.updateStatus = "current";

    const { container } = render(<SidebarVersion />);

    expect(container.textContent).toContain("Build aaaaaaa");
    expect(container.textContent).not.toContain("Update available");
    expect(container.textContent).not.toContain("Update ready");
  });
});
