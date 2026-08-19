// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ProfileOptions from "./ProfileOptions";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toggleTheme: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/components/theme-provider", () => ({
  useToggleTheme: () => mocks.toggleTheme,
}));

vi.mock("@teispace/next-themes", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({
    data: {
      user: {
        email: "daffa@example.com",
        name: "Daffa",
        role: "user",
      },
    },
  }),
}));

vi.mock("@karakeep/shared-react/hooks/users", () => ({
  useWhoAmI: () => ({ data: { image: null } }),
}));

vi.mock("@/lib/i18n/client", () => ({
  useTranslation: (namespace?: string) => ({
    t: (key: string) => {
      if (namespace === "profile_menu") {
        const profileTranslations: Record<string, string> = {
          apps_extensions: "Apps & extensions",
          coming_soon: "Coming soon",
          documentation: "Documentation",
          update_now: "Update now",
        };
        return profileTranslations[key] ?? key;
      }

      const translations: Record<string, string> = {
        "actions.sign_out": "Sign out",
        "cleanups.cleanups": "Cleanups",
        "options.dark_mode": "Dark mode",
        "options.light_mode": "Light mode",
        "settings.user_settings": "Settings",
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock("../../admin/AdminNotices", () => ({
  AdminNoticeBadge: () => null,
}));

vi.mock("@/components/shared/sidebar/SidebarVersion", () => ({
  default: ({ placement }: { placement?: string }) => (
    <div data-placement={placement} data-testid="sidebar-version" />
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ className }: { className?: string }) => (
    <div className={className} role="separator" />
  ),
}));

vi.mock("@/components/ui/user-avatar", () => ({
  UserAvatar: ({ name }: { name?: string | null }) => (
    <div data-testid="user-avatar">{name}</div>
  ),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    disabled,
  }: {
    children: React.ReactNode;
    disabled?: boolean;
  }) => <div data-disabled={disabled ? "true" : "false"}>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("ProfileOptions", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.toggleTheme.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("replaces upstream actions with disabled Marka coming-soon features", () => {
    const { container } = render(<ProfileOptions />);

    expect(container.textContent).toContain("Apps & extensions");
    expect(container.textContent).toContain("Documentation");
    expect(container.textContent?.match(/Coming soon/g)?.length).toBe(2);

    const hrefs = [...container.querySelectorAll("a")].map((link) =>
      link.getAttribute("href"),
    );
    expect(hrefs).not.toContain("https://karakeep.app/apps");
    expect(hrefs).not.toContain("https://docs.karakeep.app");
    expect(hrefs).not.toContain("https://x.com/karakeep_app");
    expect(container.textContent).not.toContain(
      "Follow upstream Karakeep on X",
    );

    const disabledItems = container.querySelectorAll('[data-disabled="true"]');
    expect(disabledItems).toHaveLength(2);
  });

  it("shows the shared build footer in the profile menu", () => {
    render(<ProfileOptions />);

    const version = screen.getByTestId("sidebar-version");
    expect(version.getAttribute("data-placement")).toBe("profile");
  });
});
