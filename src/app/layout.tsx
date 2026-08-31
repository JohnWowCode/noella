import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { Palette, UndoBar } from "@/components/Palette";
import { QuickCapture } from "@/components/QuickCapture";
import { ServiceWorker } from "@/components/ServiceWorker";
import { NoellaProvider } from "@/lib/store/provider";
import "./globals.css";

/**
 * Literata carries the note bodies: a screen-first serif with enough ink to
 * hold up on saturated cards, and enough voice that your own writing reads as
 * considered rather than logged. Chrome stays mono — the contrast is the design.
 */
const literata = localFont({
  src: "../fonts/literata-variable.woff2",
  weight: "200 900",
  style: "normal",
  display: "swap",
  variable: "--font-literata",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const metadata: Metadata = {
  title: "Noella",
  description: "A wall of notes. Colour is the filing system.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Noella", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  // Matches the paper and the dark canvas, so the phone chrome follows suit.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0b" },
  ],
  viewportFit: "cover",
};

// Applied before first paint so the theme never flashes. Default is auto, so a
// phone in night mode opens Noella in night mode without being told to.
const THEME_BOOT = `try{var t=localStorage.getItem("noella.theme")||"auto";var d=t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${literata.variable} ${GeistMono.variable} h-full`}
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
