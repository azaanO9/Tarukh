import { inject } from "@vercel/analytics";

declare const __VERCEL_ANALYTICS_CONFIG__: string;

inject({
  mode: "production",
  beforeSend(event) {
    if (event.type !== "pageview") return null;
    const url = new URL(event.url, window.location.origin);
    url.search = "";
    url.hash = "";
    return { ...event, url: url.href };
  },
}, __VERCEL_ANALYTICS_CONFIG__);
