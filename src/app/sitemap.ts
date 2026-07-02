import { MetadataRoute } from 'next';
import { BASE_URL } from "@/lib/config";

export const revalidate = 86400; // Regenerar sitemap cada 24h

export default function sitemap(): MetadataRoute.Sitemap {
  // Solo páginas públicas — sin dashboard, admin, sign-in, sign-up ni páginas con auth
  return [
    {
      url: BASE_URL,
      lastModified: new Date("2026-06-29"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date("2026-06-29"),
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
  ];
}
