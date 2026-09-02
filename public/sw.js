/**
 * Offline shell for Noella.
 *
 * The data already lives in the browser, so the only thing standing between
 * you and your wall on a train is the HTML and JS. Navigations go
 * network-first — a stale shell after a deploy is worse than a slow one —
 * and everything else is cache-first with a background refresh.
 */

const VERSION = "noella-v4";

/**
 * Where this copy of the app lives. Derived from the registration scope rather
 * than hardcoded, so the same file works at the domain root and under a
 * subdirectory like /noella/ on GitHub Pages.
 */
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");

/**
 * Both URL shapes on purpose. A server build serves /wall; a static export
 * serves /wall/ and 308s the bare path. addAll rejects the whole batch if any
 * single request redirects or 404s, which silently left the cache empty and
 * then answered /wall/ with the home page — so each entry is added on its own
 * and a miss is simply skipped.
 */
/**
 * A static export serves /wall/ and 308s the bare path; a server build serves
 * /wall. Rather than requesting both and guaranteeing a failed request for
 * every route, each page is tried as a directory first and only falls back.
 */
const ROUTES = ["", "/wall", "/projects", "/money"];

async function cacheShell(cache) {
  for (const route of ROUTES) {
    const candidates = [`${BASE}${route}/`, `${BASE}${route}` || "/"];
    for (const url of candidates) {
      try {
        await cache.add(url);
        break;
      } catch {
        // Try the other shape; if neither works the page simply is not cached.
      }
    }
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then(cacheShell)
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
        // Offline: answer with the page that was asked for. Falling back to
        // the home page would render Today at /wall/, which is worse than
        // failing honestly.
        .catch(() =>
          caches
            .match(request, { ignoreSearch: true })
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
