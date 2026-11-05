
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        id: "/",
        name: "MOA AI",
        short_name: "모아 AI",
        description: "AI 콘텐츠 라이브러리",

        start_url: "/",
        scope: "/",
        display: "standalone",

        theme_color: "#7661e9",
        background_color: "#f6f8ff",

        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],

        share_target: {
          action: "/",
          method: "GET",
          params: {
            title: "title",
            text: "text",
            url: "url",
          },
        },
      },
    }),
  ],
});
