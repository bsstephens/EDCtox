import type { MetadataRoute } from "next";

import { SITE_URL } from "~/lib/site";
import { cachedQuery } from "~/server/cache";
import { db } from "~/server/db";

const loadSitemapEntries = cachedQuery("sitemap", async () => {
  const [compounds, mechanisms] = await Promise.all([
    db.compound.findMany({ select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    db.mechanism.findMany({ select: { code: true }, orderBy: { code: "asc" } }),
  ]);
  return {
    compounds: compounds.map((compound) => ({ slug: compound.slug, updatedAt: compound.updatedAt.toISOString() })),
    mechanismCodes: mechanisms.map((mechanism) => mechanism.code),
  };
});

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await loadSitemapEntries();
  const statics: MetadataRoute.Sitemap = ["/", "/compare", "/evidence", "/mechanisms", "/methodology"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
  }));
  const compounds: MetadataRoute.Sitemap = entries.compounds.map((compound) => ({
    url: `${SITE_URL}/compounds/${compound.slug}`,
    lastModified: compound.updatedAt,
    changeFrequency: "monthly",
  }));
  const mechanisms: MetadataRoute.Sitemap = entries.mechanismCodes.map((code) => ({
    url: `${SITE_URL}/mechanisms/${code}`,
    changeFrequency: "monthly",
  }));
  return [...statics, ...compounds, ...mechanisms];
}
