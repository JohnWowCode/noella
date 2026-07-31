/**
 * Offline shell for Noella.
 *
 * The data already lives in the browser, so the only thing standing between
 * you and your wall on a train is the HTML and JS. Navigations go
 * network-first — a stale shell after a deploy is worse than a slow one —
 * and everything else is cache-first with a background refresh.
 */

const VERSION = "noella-v1";
const SHELL = ["/", "/today", "/projects", "/money"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((c) => c.put(request, copy));
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match("/"))
            .then((hit) => hit || Response.error()),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((c) => c.put(request, copy));
          }
          return response;
        })
        .catch(() => hit || Response.error());
      return hit || network;
    }),
  );
});
