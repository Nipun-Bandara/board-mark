const SHELL_CACHE = "boardmark-shell-v1";
const ASSET_CACHE = "boardmark-assets-v1";
const OFFLINE_URL = "/offline.html";
const ICON_URLS = [
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png"
];

function canCacheShell(response) {
  const cacheControl = response.headers.get("cache-control") || "";
  return response.ok &&
    response.headers.get("content-type")?.includes("text/html") &&
    !/private|no-store/i.test(cacheControl);
}

async function saveShell(response) {
  if (!canCacheShell(response)) return;

  const html = await response.clone().text();
  const assetPaths = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+(?:\?[^\"]*)?)"/g)]
    .map((match) => match[1].replaceAll("&amp;", "&"));

  const assetCache = await caches.open(ASSET_CACHE);
  await Promise.all([...new Set(assetPaths)].map(async (path) => {
    const asset = await fetch(path);
    if (!asset.ok) throw new Error(`Could not cache ${path}`);
    await assetCache.put(path, asset);
  }));

  const shellCache = await caches.open(SHELL_CACHE);
  await shellCache.put("/", response);
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.add(OFFLINE_URL);
    await Promise.allSettled(ICON_URLS.map((path) => cache.add(path)));

    try {
      await saveShell(await fetch("/", { cache: "no-store" }));
    } catch {
      // The fallback page still works if the first install happens offline.
    }

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter((name) => name.startsWith("boardmark-") && name !== SHELL_CACHE && name !== ASSET_CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (url.pathname === "/" && canCacheShell(response)) {
          event.waitUntil(saveShell(response.clone()).catch(() => {}));
        }
        return response;
      } catch {
        if (url.pathname === "/") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        return (await caches.match(OFFLINE_URL)) || Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || ICON_URLS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(url.pathname.startsWith("/_next/static/") ? ASSET_CACHE : SHELL_CACHE);
        event.waitUntil(cache.put(request, response.clone()));
      }
      return response;
    })());
  }
});
