const CACHE_VERSION = "2026-07-13";
const NAVIGATION_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
const NAVIGATION_CACHED_AT_HEADER = "x-karakeep-navigation-cached-at";

const KARAKEEP_SHELL_CACHE = `karakeep-shell:${self.registration.scope}:${CACHE_VERSION}`;
const KARAKEEP_THUMBNAIL_CACHE = `karakeep-thumbnails:${self.registration.scope}:${CACHE_VERSION}`;
const KARAKEEP_SHELL_CACHE_PREFIX = `karakeep-shell:${self.registration.scope}:`;
const KARAKEEP_THUMBNAIL_CACHE_PREFIX = "karakeep-thumbnails:";

const isStaticAsset = ({ url }) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest");

const isThumbnail = ({ url }) =>
  url.origin === self.location.origin && url.pathname.startsWith("/api/assets/");

const isCacheableThumbnail = (response) => {
  const contentType = response.headers.get("content-type") ?? "";
  return (
    response.ok &&
    !/(?:pdf|zip|tar|rar|7z|gzip|bzip|archive|compress)/i.test(contentType)
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
  if (event.data?.type !== "CLEAR_USER_CACHES") {
    return;
  }

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) =>
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
  if (event.request.mode === "navigate") {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (isStaticAsset({ url })) {
    event.respondWith(handleStaticAsset(event.request));
    return;
  }

  if (isThumbnail({ url })) {
    event.respondWith(handleThumbnail(event));
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
  const cache = await caches.open(KARAKEEP_SHELL_CACHE);

  try {
    const response = await fetch(event.request);
    if (response.ok) {
      event.waitUntil(cacheNavigationResponse(cache, event.request, response));
    }
    return response;
  } catch {
    const cachedResponse = await cache.match(event.request);
    if (cachedResponse && isRecentNavigation(cachedResponse)) {
      return cachedResponse;
    }

    return await cache.match("/offline.html");
  }
}

async function cacheNavigationResponse(cache, request, response) {
  const cachedResponse = response.clone();
  const headers = new Headers(cachedResponse.headers);
  headers.set(NAVIGATION_CACHED_AT_HEADER, String(Date.now()));

  await cache.put(
    request,
    new Response(await cachedResponse.blob(), {
      headers,
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
    }),
  );
}

function isRecentNavigation(response) {
  const cachedAt = Number(response.headers.get(NAVIGATION_CACHED_AT_HEADER));
  return Number.isFinite(cachedAt) && Date.now() - cachedAt < NAVIGATION_CACHE_MAX_AGE_MS;
}

async function handleThumbnail(event) {
  const cache = await caches.open(KARAKEEP_THUMBNAIL_CACHE);
  const cachedResponse = await cache.match(event.request);

  if (cachedResponse) {
    event.waitUntil(
      Promise.all([
        notifyThumbnailUse(event),
        revalidateThumbnail(cache, event.request),
      ]),
    );
    return cachedResponse;
  }

  const response = await fetch(event.request);
  if (isCacheableThumbnail(response)) {
    event.waitUntil(
      Promise.all([
        cache.put(event.request, response.clone()),
        notifyThumbnailUse(event),
      ]),
    );
  }
  return response;
}

async function revalidateThumbnail(cache, request) {
  try {
    const response = await fetch(request);
    if (isCacheableThumbnail(response)) {
      await cache.put(request, response.clone());
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
