import type { MetadataRoute } from "next";

import { SITE_URL } from "~/lib/site";

/**
 * Crawlers may index the canonical pages listed in the sitemap. They are kept off the
 * unlisted admin pages, the tRPC endpoint, and every query-string permutation: the
 * compound index, evidence and mechanism filters, and compare presets are all GET
 * forms, so without this rule a crawler can generate an unbounded number of
 * database-backed URLs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api/", "/*?"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
