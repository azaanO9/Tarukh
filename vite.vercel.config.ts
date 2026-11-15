import { defineConfig, mergeConfig } from "vite";
import pagesConfig from "./vite.pages.config";

const vercelEnvironment = process.env.VERCEL_ENV ?? process.env.VITE_VERCEL_ENV;
const analyticsEnabled = vercelEnvironment === "production";

export default defineConfig(mergeConfig(pagesConfig, {
  base: "/",
  build: { outDir: "../dist-vercel" },
  plugins: analyticsEnabled ? [{
    name: "tarukh-vercel-analytics",
    transformIndexHtml: {
      order: "pre",
      handler: () => [{
        tag: "script",
        attrs: { type: "module", src: "/vercelAnalytics.ts" },
        injectTo: "body",
      }],
    },
  }] : [],
  define: analyticsEnabled ? {
    __VERCEL_ANALYTICS_CONFIG__: JSON.stringify(process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG ?? ""),
  } : {},
}));
