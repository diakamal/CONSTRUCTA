import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // cacheComponents / partialPrefetching are off: the dashboard is client-rendered with live
  // polling, so there is nothing to prerender and the instant-navigation checks only add noise.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
