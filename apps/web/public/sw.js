const BUILD_VERSION =
  new URL(self.location.href).searchParams.get("v") ?? "development";
const NAVIGATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const NAVIGATION_CACHED_AT_HEADER = "x-karakeep-navigation-cached-at";
const NAVIGATION_SESSION_HEADER = "x-karakeep-navigation-session";

const KARAKEEP_SHELL_CACHE = `karakeep-shell:${self.registration.scope}:${BUILD_VERSION}`;
const KARAKEEP_THUMBNAIL_CACHE = `karakeep-thumbnails:${self.registration.scope}:${BUILD_VERSION}`;
const KARAKEEP_SHELL_CACHE_PREFIX = `karakeep-shell:${self.registration.scope}:`;
const KARAKEEP_THUMBNAIL_CACHE_PREFIX = "karakeep-thumbnails:";
const CACHEABLE_THUMBNAIL_CONTENT_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/tiff",
  "image/webp",
]);
const NETWORK_ONLY_DOCUMENT_PREFIXES = [
  "/admin",
  "/check-email",
  "/forgot-password",
  "/invite",
  "/logout",
  "/public",
  "/reset-password",
  "/settings",
  "/signin",
  "/signup",
  "/verify-email",
];
const documentCacheSessions = new Map();

const isStaticAsset = ({ url }) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest");

const isThumbnail = ({ url }) =>
  url.origin === self.location.origin &&
  url.pathname.startsWith("/api/assets/");

const isRscOrDataRequest = ({ request, url }) =>
  request.headers.has("RSC") ||
  request.headers.has("Next-Router-State-Tree") ||
  request.headers.get("accept")?.includes("text/x-component") ||
  url.searchParams.has("_rsc");

const isNetworkOnlyRequest = ({ request, url }) =>
  isRscOrDataRequest({ request, url }) ||
  (url.origin === self.location.origin &&
    ((url.pathname.startsWith("/api/") && !isThumbnail({ url })) ||
      NETWORK_ONLY_DOCUMENT_PREFIXES.some(
        (prefix) =>
          url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
      )));

const isCacheableNavigation = ({ url }) =>
  url.origin === self.location.origin &&
  (url.pathname === "/dashboard" ||
    url.pathname.startsWith("/dashboard/") ||
    url.pathname === "/reader" ||
    url.pathname.startsWith("/reader/"));

const isCacheableThumbnail = (response) => {
  const contentType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();

  return (
    response.status === 200 &&
    contentType !== undefined &&
    CACHEABLE_THUMBNAIL_CONTENT_TYPES.has(contentType)
  );
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(KARAKEEP_SHELL_CACHE)
      .then((cache) => cache.add("/offline.html")),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(KARAKEEP_SHELL_CACHE_PREFIX) &&
                cacheName !== KARAKEEP_SHELL_CACHE,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_DOCUMENT_CACHE_SESSION") {
    if (typeof event.source?.id !== "string") {
      return;
    }

    if (typeof event.data.sessionId === "string") {
      documentCacheSessions.set(event.source.id, event.data.sessionId);
    } else {
      documentCacheSessions.delete(event.source.id);
    }
    return;
  }

  if (event.data?.type !== "CLEAR_USER_CACHES") {
    return;
  }

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName === "karakeep-thumbnails" ||
                cacheName.startsWith(KARAKEEP_THUMBNAIL_CACHE_PREFIX),
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (isNetworkOnlyRequest({ request: event.request, url })) {
    return;
  }

  if (isStaticAsset({ url })) {
    event.respondWith(handleStaticAsset(event.request));
    return;
  }

  if (isThumbnail({ url })) {
    event.respondWith(handleThumbnail(event));
    return;
  }

  if (event.request.mode === "navigate" && isCacheableNavigation({ url })) {
    event.respondWith(handleNavigation(event));
  }
});

async function handleStaticAsset(request) {
  const cache = await caches.open(KARAKEEP_SHELL_CACHE);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

async function handleNavigation(event) {
  const sessionId = documentCacheSessions.get(event.clientId);
  if (!sessionId) {
    return await fetch(event.request);
  }

  const cache = await caches.open(KARAKEEP_SHELL_CACHE);
  try {
    const response = await fetch(event.request);
    if (response.ok) {
      event.waitUntil(
        cacheNavigationResponse(cache, event.request, response, sessionId),
      );
    }
    return response;
  } catch {
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse && isRecentNavigation(cachedResponse, sessionId)) {
      return cachedResponse;
    }

    return await cache.match("/offline.html");
  }
}

async function cacheNavigationResponse(cache, request, response, sessionId) {
  const cachedResponse = response.clone();
  const headers = new Headers(cachedResponse.headers);
  headers.set(NAVIGATION_CACHED_AT_HEADER, String(Date.now()));
  headers.set(NAVIGATION_SESSION_HEADER, sessionId);

  await cache.put(
    request,
    new Response(await cachedResponse.blob(), {
      headers,
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
    }),
  );
}

function isRecentNavigation(response, sessionId) {
  const cachedAt = Number(response.headers.get(NAVIGATION_CACHED_AT_HEADER));
  return (
    response.headers.get(NAVIGATION_SESSION_HEADER) === sessionId &&
    Number.isFinite(cachedAt) &&
    Date.now() - cachedAt < NAVIGATION_CACHE_MAX_AGE_MS
  );
}

async function handleThumbnail(event) {
  const cache = await caches.open(KARAKEEP_THUMBNAIL_CACHE);
  const cachedResponse = await cache.match(event.request);

  if (cachedResponse) {
    event.waitUntil(revalidateThumbnail(cache, event));
    return cachedResponse;
  }

  const response = await fetch(event.request);
  if (isCacheableThumbnail(response)) {
    event.waitUntil(
      cache
        .put(event.request, response.clone())
        .then(() => notifyThumbnailUse(event)),
    );
  }
  return response;
}

async function revalidateThumbnail(cache, event) {
  try {
    const response = await fetch(event.request);
    if (isCacheableThumbnail(response)) {
      await cache.put(event.request, response.clone());
      await notifyThumbnailUse(event);
    }
  } catch {
    // A cached thumbnail is still usable while the revalidation request fails.
  }
}

async function notifyThumbnailUse(event) {
  const client = await self.clients.get(event.clientId);
  client?.postMessage({
    type: "THUMBNAIL_USED",
    url: event.request.url,
  });
}
