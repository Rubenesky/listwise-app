import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/dashboard/', '/sign-in/', '/sign-up/'],
    },
    sitemap: 'https://listwise-app.onrender.com/sitemap.xml',
  };
}
