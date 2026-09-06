import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { Palette, UndoBar } from "@/components/Palette";
import { QuickCapture } from "@/components/QuickCapture";
import { ServiceWorker } from "@/components/ServiceWorker";
import { NoellaProvider } from "@/lib/store/provider";
import "./globals.css";

/**
 * Three typefaces, because the right one is not the same for everybody.
 *
 * Literata is the default and stays it: a screen-first serif with enough ink
 * to hold up on tinted cards and enough voice that your own writing reads as
 * considered rather than logged. Chrome stays mono — the contrast is the
 * design.
 *
 * The other two are here on evidence rather than taste. Atkinson Hyperlegible
 * was drawn by the Braille Institute to make every character unambiguous —
 * slashed zero, serifed capital I, tailed lowercase l — which is the failure
 * mode of a wall you scan rather than read. Lexend was built by Bonnie
 * Shaver-Troup around horizontal spacing and tested for reading speed.
 *
 * Deliberately absent: OpenDyslexic. Controlled studies find no improvement in
 * reading rate or accuracy from it, and one found readers doing worse on every
 * measure than with plain Arial. Where a benefit has shown up for any of these,
 * matching the spacing in the control font made it disappear — so the setting
 * that actually earns its place is the roomy one, not the typeface list.
 *
 * All three are subsetted to latin and served from this origin: no request to
 * Google, nothing to load before you can read, and it works on a plane.
 */
const literata = localFont({
  src: "../fonts/literata-variable.woff2",
  weight: "200 900",
  style: "normal",
  display: "swap",
  variable: "--font-literata",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const atkinson = localFont({
  src: "../fonts/atkinson-hyperlegible-next-variable.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-atkinson",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

const lexend = localFont({
  src: "../fonts/lexend-variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-lexend",
  fallback: ["system-ui", "Segoe UI", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Noella",
  description: "A wall of notes. Colour is the filing system.",
  appleWebApp: { capable: true, title: "Noella", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Matches the paper and the dark canvas, so the phone chrome follows suit.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
  viewportFit: "cover",
  /*
   * When the on-screen keyboard opens, resize the layout rather than sliding
   * it. This is a writing app: the compose box and the button that saves what
   * you just typed both have to stay reachable while the keyboard is up.
   */
  interactiveWidget: "resizes-content",
};

// Applied before first paint so the theme never flashes. Default is auto, so a
// phone in night mode opens Noella in night mode without being told to.
const THEME_BOOT = `try{var t=localStorage.getItem("noella.theme")||"auto";var d=t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.dataset.theme="dark"}catch(e){}
try{var r=JSON.parse(localStorage.getItem("noella.reading")||"{}");var e=document.documentElement;if(r.face)e.dataset.face=r.face;if(r.roomy)e.dataset.roomy="1";if(r.size)e.dataset.size=r.size}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${literata.variable} ${atkinson.variable} ${lexend.variable} ${GeistMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="min-h-full antialiased">
        <NoellaProvider>
          {children}
          <QuickCapture />
          <Palette />
          <UndoBar />
        </NoellaProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
