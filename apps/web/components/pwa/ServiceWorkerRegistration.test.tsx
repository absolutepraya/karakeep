// @vitest-environment jsdom

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
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

function renderRegistration(children?: React.ReactNode) {
  const Provider = ServiceWorkerRegistration as React.ComponentType<{
    children?: React.ReactNode;
  }>;
  return render(<Provider>{children}</Provider>);
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
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
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
    renderRegistration();

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

    renderRegistration();

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

    renderRegistration();

    await waitFor(() => {
      expect(mocks.getRegistration).toHaveBeenCalledWith("/");
    });
    await waitFor(() => {
      expect(mocks.waitingWorker.postMessage).toHaveBeenCalledWith({
        type: "ACTIVATE_UPDATE",
      });
    });
  });

  it("checks again when an existing document returns to the foreground", async () => {
    renderRegistration();

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    });
    mocks.fetch.mockClear();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith("/api/version", {
        cache: "no-store",
      });
    });
  });

  it("provides shared running-build and deployed-update state to descendants", async () => {
    const module = await import("./ServiceWorkerRegistration");
    expect(module).toHaveProperty("usePwaLifecycle");

    const usePwaLifecycle = (
      module as typeof module & {
        usePwaLifecycle: () => {
          appBuild: string;
          deployedBuild: string | null;
          updateStatus: string;
        };
      }
    ).usePwaLifecycle;

    function Probe() {
      const state = usePwaLifecycle();
      return (
        <div>
          <span data-testid="app-build">{state.appBuild}</span>
          <span data-testid="deployed-build">{state.deployedBuild}</span>
          <span data-testid="update-status">{state.updateStatus}</span>
        </div>
      );
    }

    mocks.fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: "bbbbbbb" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    mocks.register
      .mockResolvedValueOnce({ active: mocks.messagePort })
      .mockResolvedValueOnce({
        active: mocks.messagePort,
        waiting: mocks.waitingWorker,
      });

    renderRegistration(<Probe />);

    expect(screen.getByTestId("app-build")).toHaveTextContent("development");
    await waitFor(() => {
      expect(screen.getByTestId("deployed-build")).toHaveTextContent(
        "bbbbbbb",
      );
      expect(screen.getByTestId("update-status")).toHaveTextContent("ready");
    });
  });
});
