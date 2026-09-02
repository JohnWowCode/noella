import type { NextConfig } from "next";

/**
 * Noella has no server side: no API routes, no server actions, no dynamic
 * params. Every page prerenders, and all the data lives in the browser. So it
 * can be published as a plain folder of files that any static host will serve
 * — which is a much smaller ask than wiring up a hosting platform.
 *
 * `npm run export` turns that on and writes ./out. The normal `npm run build`
 * is untouched, so deploying to Vercel or running a real server still works.
 */
const nextConfig: NextConfig = {
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
