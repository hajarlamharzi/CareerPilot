import type { NextConfig } from "next";

/**
 * CareerPilot is a frontend-only application: every page is a thin shell around
 * client components that read data from browser storage. Cache Components (and
 * Partial Prerendering) validate routes to produce a static shell from
 * server-rendered data — but this app has no server data to prerender, while
 * client hooks such as `usePathname` and dynamic `params` access are flagged as
 * "uncached runtime data" during that validation.
 *
 * We therefore keep the standard Next.js rendering model, which is fully
 * compatible with Vercel's free tier. `turbopack` remains configured so the
 * Tailwind CSS loader works under Turbopack (the default bundler in Next 16).
 */
const nextConfig: NextConfig = {
  cacheComponents: false,
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
