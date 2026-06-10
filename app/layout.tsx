import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import Web3Provider from "@/lib/providers/Web3Provider"
import { AuthProvider } from "@/lib/providers/AuthProvider"
import { WebSocketProvider } from "@/lib/providers/WebSocketProvider"
import { Header } from "@/components/header"
import { RootErrorBoundary } from "@/components/RootErrorBoundary"
import { SystemHealthGuard } from "@/components/SystemHealthGuard"
import { Toaster } from "sonner"
import { headers } from "next/headers"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Elysia Perp",
  description: "ZK-based Perpetual DEX, trading crypto and RWA",
  icons: {
    icon: "/icons/logo/el_favi.svg",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersObj = await headers()
  const cookies = headersObj.get("cookie")

  return (
    <html lang="en">
      <head>
        {/*
          Chunk-recovery guard — auto-reload when the browser is holding
          stale HTML whose embedded `_next/static/chunks/*.js` URLs have
          been rotated out by a newer Vercel deployment.

          The failure mode this fixes: a tab left open across one or more
          deploys still references the old build's chunk hashes. When the
          user wakes the laptop / clicks a link / triggers any dynamic
          import, the network returns 403 (or sometimes 404) for those
          chunks, React never hydrates, and the page is just black.

          Strategy: listen for resource-load errors and unhandled promise
          rejections, fingerprint the chunk-load patterns (Next's own
          `ChunkLoadError`, raw `Loading chunk N failed`, script tags
          pointing at `_next/static/`, etc.), and call `location.reload()`
          once per 5-minute window. The sessionStorage cooldown is the
          safety belt — without it a server that *actually* can't serve
          chunks would loop the user.

          This script is inlined intentionally so it runs *before* any
          framework JavaScript: if the framework itself fails to load, an
          external recovery script would fail too.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function () {
  var KEY = 'ee.chunkReloadAt';
  var COOLDOWN = 5 * 60 * 1000;
  function reloadOnce() {
    try {
      var last = parseInt(sessionStorage.getItem(KEY) || '0', 10);
      if (Date.now() - last < COOLDOWN) return;
      sessionStorage.setItem(KEY, String(Date.now()));
    } catch (_) {}
    location.reload();
  }
  function looksLikeChunkFailure(evt) {
    var err = evt && (evt.error || evt.reason);
    var msg = (err && (err.message || String(err))) || '';
    if (/ChunkLoadError|Loading chunk \\d+ failed|Loading CSS chunk \\d+ failed|Failed to fetch dynamically imported module|Importing a module script failed/.test(msg)) {
      return true;
    }
    var target = evt && evt.target;
    if (target && (target.tagName === 'SCRIPT' || target.tagName === 'LINK')) {
      var src = target.src || target.href || '';
      if (/\\/_next\\/static\\/(chunks|css)\\//.test(src)) return true;
    }
    return false;
  }
  window.addEventListener(
    'error',
    function (e) { if (looksLikeChunkFailure(e)) reloadOnce(); },
    true
  );
  window.addEventListener('unhandledrejection', function (e) {
    if (looksLikeChunkFailure(e)) reloadOnce();
  });
})();
`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RootErrorBoundary>
          <Web3Provider cookies={cookies}>
            <AuthProvider>
              <WebSocketProvider>
                <div className="flex h-screen flex-col bg-background">
                  <Header />
                  <SystemHealthGuard>{children}</SystemHealthGuard>
                </div>
              </WebSocketProvider>
            </AuthProvider>
          </Web3Provider>
        </RootErrorBoundary>
        <Toaster
          theme="dark"
          position="bottom-right"
          offset="16px"
          style={{ "--width": "264px" } as React.CSSProperties}
        />
      </body>
    </html>
  )
}
