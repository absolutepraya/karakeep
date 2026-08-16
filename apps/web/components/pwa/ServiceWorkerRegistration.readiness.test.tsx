// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ServiceWorkerRegistration, {
  usePwaLifecycle,
} from "./ServiceWorkerRegistration";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  getRegistration: vi.fn(),
  fetch: vi.fn(),
  messagePort: { postMessage: vi.fn() },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({
    data: { user: { id: "user-1" } },
    status: "authenticated",
  }),
}));

function Probe() {
  const { updateStatus } = usePwaLifecycle();
  return <span data-testid="update-status">{updateStatus}</span>;
}

function installServiceWorkerMock() {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      addEventListener: mocks.addEventListener,
      controller: mocks.messagePort,
      getRegistration: mocks.getRegistration,
      register: mocks.register,
      removeEventListener: mocks.removeEventListener,
    },
  });
}

describe("ServiceWorkerRegistration readiness", () => {
  beforeEach(() => {
    installServiceWorkerMock();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.getRegistration.mockResolvedValue(undefined);
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ version: "bbbbbbb" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    cleanup();
    mocks.register.mockReset();
    mocks.getRegistration.mockReset();
    mocks.fetch.mockReset();
    mocks.messagePort.postMessage.mockReset();
    mocks.addEventListener.mockReset();
    mocks.removeEventListener.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("marks an update ready when installation finished before the state listener was attached", async () => {
    const installedWorker = {
      state: "installed",
      onstatechange: null as (() => void) | null,
      scriptURL: "https://karakeep.test/sw.js?v=bbbbbbb",
    };
    let waitingReads = 0;
    const updateRegistration = {
      active: mocks.messagePort,
      installing: installedWorker,
      get waiting() {
        waitingReads += 1;
        return waitingReads === 1 ? null : installedWorker;
      },
    };

    mocks.register
      .mockResolvedValueOnce({ active: mocks.messagePort })
      .mockResolvedValueOnce(updateRegistration);

    render(
      <ServiceWorkerRegistration>
        <Probe />
      </ServiceWorkerRegistration>,
    );

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledWith("/sw.js?v=bbbbbbb", {
        scope: "/",
        updateViaCache: "none",
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("update-status").textContent).toBe("ready");
    });
  });
});
