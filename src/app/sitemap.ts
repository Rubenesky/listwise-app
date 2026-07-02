import { MetadataRoute } from 'next';
import { BASE_URL } from "@/lib/config";
import { tools } from "@/lib/alternativas/tools";

export const revalidate = 86400;

export default function sitemap(): MetadataRoute.Sitemap {
  const alternativasEntries: MetadataRoute.Sitemap = tools.map((t) => ({
    url: `${BASE_URL}/alternativas/${t.slug}`,
    lastModified: new Date("2026-07-03"),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date("2026-07-03"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date("2026-07-03"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date("2026-06-27"),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/blog/como-generar-descripciones-productos-amazon-ia`,
      lastModified: new Date("2026-06-20"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/blog/bullet-points-amazon-como-escribirlos`,
      lastModified: new Date("2026-06-24"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/blog/seo-para-ecommerce-como-optimizar-fichas-producto`,
      lastModified: new Date("2026-06-27"),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...alternativasEntries,
  ];
}
