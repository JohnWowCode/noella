import type { MetadataRoute } from "next";

// A generated route is dynamic by default; a folder of files has nowhere to
// run it, so it is pinned to build time.
export const dynamic = "force-static";

/**
 * Generated rather than a static file, because every URL in it is absolute and
 * a subdirectory host — GitHub Pages, say — would otherwise have the icons and
 * the start URL point at the domain root.
 */
export default function manifest(): MetadataRoute.Manifest {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  return {
    name: "Noella",
    short_name: "Noella",
    description: "A wall of notes. Colour is the filing system.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#f4f2ed",
    theme_color: "#f4f2ed",
    orientation: "any",
    icons: [
      { src: `${base}/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-pressing the icon offers the one thing worth a separate entrance:
    // a blank box. The old shortcuts pointed at two screens that are now the
    // same screen, so they were two ways of doing nothing.
    shortcuts: [{ name: "Write something", url: `${base}/?capture=1` }],
  };
}
