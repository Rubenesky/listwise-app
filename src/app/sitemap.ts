import { MetadataRoute } from 'next';

export const revalidate = 86400; // Regenerar sitemap cada 24h

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app";

export default function sitemap(): MetadataRoute.Sitemap {
  // Solo páginas públicas — sin dashboard, admin, sign-in, sign-up ni páginas con auth
  return [
    {
      url: BASE_URL,
      lastModified: new Date("2026-06-01"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date("2026-06-01"),
      changeFrequency: "monthly",
      priority: 0.9,
    },
  ];
}
