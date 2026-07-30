import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
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
};

export const viewport: Viewport = {
  themeColor: "#f4f2ed",
};

// Applied before first paint so the theme never flashes.
const THEME_BOOT = `try{var t=localStorage.getItem("noella.theme");if(t==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

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
        <NoellaProvider>{children}</NoellaProvider>
      </body>
    </html>
  );
}
