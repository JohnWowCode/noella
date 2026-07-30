import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { NoellaProvider } from "@/lib/store/provider";
import "./globals.css";

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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full`}
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
