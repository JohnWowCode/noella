"use client";

import { useEffect } from "react";

/** Registers the offline shell. Nothing depends on it — it only adds reach. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline support is a bonus; the app works without it.
    });
  }, []);

  return null;
}
