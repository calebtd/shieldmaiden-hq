import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: {
      "@domain": fileURLToPath(new URL("./src/domain", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
    },
  },
  plugins: [
    react(),
    cloudflare(),
    VitePWA({
      // The app shell is cached so it opens with no signal; data lives in IndexedDB.
      registerType: "autoUpdate",
      // Cloudflare Access protects every file, so the manifest must be fetched signed in.
      useCredentials: true,
      includeAssets: ["icon.svg", "favicon-32.png", "apple-touch-icon.png"],
      manifest: {
        name: "Shieldmaiden HQ",
        short_name: "Shieldmaiden",
        description: "Waitlist, tickets, time, and payouts for Shieldmaiden Braidin'",
        theme_color: "#344e41",
        background_color: "#dad7cd",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/cdn-cgi\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
});
