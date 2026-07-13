import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { describe, expect, it, vi } from "vitest";

const workerSource = readFileSync("public/sw.js", "utf8");
const APP_ORIGIN = "https://karakeep.test";
const WORKER_SCOPE = `${APP_ORIGIN}/`;
const BUILD_VERSION = "test-build";
const SHELL_CACHE = `karakeep-shell:${WORKER_SCOPE}:${BUILD_VERSION}`;
const THUMBNAIL_CACHE = `karakeep-thumbnails:${WORKER_SCOPE}:${BUILD_VERSION}`;

type WorkerEvent = {
  clientId?: string;
  data?: unknown;
  request?: {
    headers: Headers;
    method: string;
    mode: RequestMode;
    url: string;
  };
  source?: { id: string };
  respondWith: (response: Promise<Response> | Response) => void;
  waitUntil: (work: Promise<unknown>) => void;
};

function createWorkerHarness() {
  const listeners = new Map<string, (event: WorkerEvent) => void>();
  const cacheEntries = new Map<string, Map<string, Response>>();
  const fetch = vi.fn<(request: Request | string) => Promise<Response>>();
  const clients = {
    claim: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(undefined),
  };

  const keyOf = (request: Request | string) =>
    typeof request === "string"
      ? new URL(request, APP_ORIGIN).href
      : request.url;
  const getCache = (name: string) => {
    let entries = cacheEntries.get(name);
    if (!entries) {
      entries = new Map();
      cacheEntries.set(name, entries);
    }
    return entries;
  };
  const caches = {
    delete: vi.fn(async (name: string) => cacheEntries.delete(name)),
    keys: vi.fn(async () => [...cacheEntries.keys()]),
    open: vi.fn(async (name: string) => {
      const entries = getCache(name);
      return {
        add: vi.fn(async (request: Request | string) => {
          entries.set(keyOf(request), new Response("offline"));
        }),
        match: vi.fn(async (request: Request | string) => {
          return entries.get(keyOf(request))?.clone();
        }),
        put: vi.fn(async (request: Request | string, response: Response) => {
          entries.set(keyOf(request), response);
        }),
      };
    }),
  };
  const self = {
    addEventListener: (type: string, listener: (event: WorkerEvent) => void) => {
      listeners.set(type, listener);
    },
    clients,
    location: {
      href: `${APP_ORIGIN}/sw.js?v=${BUILD_VERSION}`,
      origin: APP_ORIGIN,
    },
    registration: { scope: WORKER_SCOPE },
    skipWaiting: vi.fn(),
  };

  runInNewContext(workerSource, {
    Date,
    Headers,
    Map,
    Promise,
    Response,
    Set,
    URL,
    caches,
    fetch,
    self,
  });

  const dispatch = async (type: string, event: Omit<WorkerEvent, "respondWith" | "waitUntil">) => {
    const work: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners.get(type)?.({
      ...event,
      respondWith: (value) => {
        response = Promise.resolve(value);
      },
      waitUntil: (value) => {
        work.push(Promise.resolve(value));
      },
    });
    return { response, work };
  };

  return {
    cacheEntries,
    caches,
    clients,
    dispatch,
    fetch,
    self,
  };
}

function getRequest(
  path: string,
  { headers = new Headers(), mode = "cors" as RequestMode } = {},
) {
  return {
    headers,
    method: "GET",
    mode,
    url: new URL(path, APP_ORIGIN).href,
  };
}

describe("service worker cache boundaries", () => {
  it("leaves auth, public account, API, and RSC/data requests network-only", async () => {
    const worker = createWorkerHarness();

    for (const request of [
      getRequest("/signin", { mode: "navigate" }),
      getRequest("/public/account", { mode: "navigate" }),
      getRequest("/api/trpc/bookmarks.list"),
      getRequest("/dashboard?_rsc=abc", { mode: "navigate" }),
      getRequest("/dashboard", {
        headers: new Headers({ RSC: "1" }),
        mode: "navigate",
      }),
    ]) {
      const { response } = await worker.dispatch("fetch", { request });
      expect(response).toBeUndefined();
    }

    expect(worker.fetch).not.toHaveBeenCalled();
  });

  it("caches only successful, full responses with an explicitly allowed image MIME type", async () => {
    const worker = createWorkerHarness();
    const thumbnailRequest = getRequest("/api/assets/thumbnail");

    for (const response of [
      new Response("missing type", { status: 200 }),
      new Response("generic", {
        headers: { "content-type": "application/octet-stream" },
        status: 200,
      }),
      new Response("video", {
        headers: { "content-type": "video/mp4" },
        status: 200,
      }),
      new Response("pdf", {
        headers: { "content-type": "application/pdf" },
        status: 200,
      }),
      new Response("archive", {
        headers: { "content-type": "application/zip" },
        status: 200,
      }),
      new Response("range", {
        headers: { "content-type": "image/webp" },
        status: 206,
      }),
    ]) {
      worker.fetch.mockResolvedValueOnce(response);
      const dispatched = await worker.dispatch("fetch", {
        clientId: "client-1",
        request: thumbnailRequest,
      });
      await dispatched.response;
      await Promise.all(dispatched.work);
    }

    expect(worker.cacheEntries.get(THUMBNAIL_CACHE)?.size ?? 0).toBe(0);

    worker.fetch.mockResolvedValueOnce(
      new Response("image", {
        headers: { "content-type": "image/webp; charset=binary" },
        status: 200,
      }),
    );
    const dispatched = await worker.dispatch("fetch", {
      clientId: "client-1",
      request: thumbnailRequest,
    });
    await dispatched.response;
    await Promise.all(dispatched.work);

    expect(worker.cacheEntries.get(THUMBNAIL_CACHE)?.size).toBe(1);
  });

  it("purges thumbnail caches only and activates after deleting older shell versions", async () => {
    const worker = createWorkerHarness();
    worker.cacheEntries.set(`${SHELL_CACHE}-old`, new Map());
    worker.cacheEntries.set(SHELL_CACHE, new Map());
    worker.cacheEntries.set(THUMBNAIL_CACHE, new Map());
    worker.cacheEntries.set("karakeep-thumbnails:legacy", new Map());
    worker.cacheEntries.set("unrelated-cache", new Map());

    const purge = await worker.dispatch("message", {
      data: { type: "CLEAR_USER_CACHES" },
    });
    await Promise.all(purge.work);

    expect(worker.cacheEntries.has(THUMBNAIL_CACHE)).toBe(false);
    expect(worker.cacheEntries.has("karakeep-thumbnails:legacy")).toBe(false);
    expect(worker.cacheEntries.has(SHELL_CACHE)).toBe(true);
    expect(worker.cacheEntries.has("unrelated-cache")).toBe(true);

    const activate = await worker.dispatch("activate", {});
    await Promise.all(activate.work);

    expect(worker.cacheEntries.has(`${SHELL_CACHE}-old`)).toBe(false);
    expect(worker.cacheEntries.has(SHELL_CACHE)).toBe(true);
    expect(worker.clients.claim).toHaveBeenCalledOnce();
    expect(worker.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("uses the offline fallback when a navigation cache entry is expired or belongs to another session", async () => {
    const worker = createWorkerHarness();
    const request = getRequest("/dashboard", { mode: "navigate" });
    const offlineUrl = new URL("/offline.html", APP_ORIGIN).href;
    const cache = new Map<string, Response>([
      [offlineUrl, new Response("offline")],
      [
        request.url,
        new Response("cached dashboard", {
          headers: {
            "x-karakeep-navigation-cached-at": String(Date.now()),
            "x-karakeep-navigation-session": "other-user",
          },
        }),
      ],
    ]);
    worker.cacheEntries.set(SHELL_CACHE, cache);
    worker.fetch.mockRejectedValue(new Error("offline"));

    const session = await worker.dispatch("message", {
      data: { type: "SET_DOCUMENT_CACHE_SESSION", sessionId: "user-1" },
      source: { id: "client-1" },
    });
    await Promise.all(session.work);

    let dispatched = await worker.dispatch("fetch", {
      clientId: "client-1",
      request,
    });
    await expect(dispatched.response).resolves.toHaveProperty("status", 200);
    await expect(dispatched.response?.then((response) => response.text())).resolves.toBe(
      "offline",
    );

    cache.set(
      request.url,
      new Response("stale dashboard", {
        headers: {
          "x-karakeep-navigation-cached-at": String(Date.now() - 300_001),
          "x-karakeep-navigation-session": "user-1",
        },
      }),
    );
    dispatched = await worker.dispatch("fetch", {
      clientId: "client-1",
      request,
    });

    await expect(dispatched.response?.then((response) => response.text())).resolves.toBe(
      "offline",
    );
  });
});
