// @vitest-environment jsdom

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  messagePort: { postMessage: vi.fn() },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

describe("ServiceWorkerRegistration", () => {
  afterEach(() => {
    mocks.register.mockReset();
    mocks.messagePort.postMessage.mockReset();
    mocks.addEventListener.mockReset();
    mocks.removeEventListener.mockReset();
  });

  it("registers the worker without caching updates and clears user caches when unauthenticated", async () => {
    mocks.register.mockResolvedValue({ active: mocks.messagePort });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        addEventListener: mocks.addEventListener,
        controller: mocks.messagePort,
        register: mocks.register,
        removeEventListener: mocks.removeEventListener,
      },
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    });

    await waitFor(() => {
      expect(mocks.messagePort.postMessage).toHaveBeenCalledWith({
        type: "CLEAR_USER_CACHES",
      });
    });
  });
});
