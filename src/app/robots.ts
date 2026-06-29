import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/sign-in/', '/sign-up/'],
    },
    sitemap: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app"}/sitemap.xml`,
  };
}
