// @vitest-environment jsdom

import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  getRegistration: vi.fn(),
  fetch: vi.fn(),
  messagePort: { postMessage: vi.fn() },
  waitingWorker: { postMessage: vi.fn() },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  useSession: () => ({ status: "unauthenticated" }),
}));

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

describe("ServiceWorkerRegistration", () => {
  beforeEach(() => {
    installServiceWorkerMock();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.getRegistration.mockResolvedValue(undefined);
    mocks.register.mockResolvedValue({ active: mocks.messagePort });
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ version: "development" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
  });

  afterEach(() => {
    mocks.register.mockReset();
    mocks.getRegistration.mockReset();
    mocks.fetch.mockReset();
    mocks.messagePort.postMessage.mockReset();
    mocks.waitingWorker.postMessage.mockReset();
    mocks.addEventListener.mockReset();
    mocks.removeEventListener.mockReset();
    vi.unstubAllGlobals();
  });

  it("registers the worker without caching updates and clears user caches when unauthenticated", async () => {
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

  it("checks the live deployed build without HTTP cache and registers a newer worker", async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: "bbbbbbb" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith("/api/version", {
        cache: "no-store",
      });
    });

    await waitFor(() => {
      expect(mocks.register).toHaveBeenCalledWith("/sw.js?v=bbbbbbb", {
        scope: "/",
        updateViaCache: "none",
      });
    });
  });

  it("requests activation from a worker that was already waiting before this document checked for updates", async () => {
    mocks.getRegistration.mockResolvedValue({
      active: mocks.messagePort,
      waiting: mocks.waitingWorker,
    });

    render(<ServiceWorkerRegistration />);

    await waitFor(() => {
      expect(mocks.getRegistration).toHaveBeenCalledWith("/");
    });
    await waitFor(() => {
      expect(mocks.waitingWorker.postMessage).toHaveBeenCalledWith({
        type: "ACTIVATE_UPDATE",
      });
    });
  });
});
