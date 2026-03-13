const CACHE_NAME = "ssm-billing-v1";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  const isDocument = request.mode === "navigate";
  const isStaticAsset = ["style", "script", "image", "font"].includes(request.destination);
  if (!isDocument && !isStaticAsset) return;

  if (isDocument) {
    // Network-first for HTML keeps users on the latest deployed app shell.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseClone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, responseClone))
            .catch(() => Promise.resolve());

          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match("/") || new Response("Offline", { status: 503 });
          })
        )
    );
    return;
  }

  // Cache-first for static assets improves repeat-load performance.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseClone = response.clone();
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, responseClone))
          .catch(() => Promise.resolve());

        return response;
      });
    })
  );
});
