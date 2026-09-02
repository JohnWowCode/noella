import type { NextConfig } from "next";

/**
 * Noella has no server side: no API routes, no server actions, no dynamic
 * params. Every page prerenders and the data lives in the browser, so it can
 * ship as a plain folder that any static host will serve. No platform is
 * required, and none is assumed.
 *
 * STATIC_EXPORT=1   write ./out instead of a server build
 * BASE_PATH=/repo   serve from a subdirectory, which is what GitHub Pages does
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // Read by the client so the service worker registers at the right URL.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
  ...(process.env.STATIC_EXPORT
    ? {
        output: "export" as const,
        // Directories with index.html, which is what plain file hosts expect.
        trailingSlash: true,
        // The optimiser needs a server; there is none in a folder of files.
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
