import type { Metadata } from "next";
import type { ReactNode } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app";

export const metadata: Metadata = {
  title: "Blog — ListWise",
  description:
    "Guías, tutoriales y recursos para vendedores de ecommerce. Aprende a optimizar tus listings de Amazon, Shopify y marketplaces con IA.",
  openGraph: {
    title: "Blog de ListWise — Recursos para ecommerce",
    description: "Guías prácticas sobre SEO de producto, Amazon listings, bullet points y copywriting con IA.",
    url: `${BASE_URL}/blog`,
    images: [{ url: `/api/og?page=blog`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    images: [`/api/og?page=blog`],
  },
  alternates: {
    canonical: `${BASE_URL}/blog`,
  },
};

export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}
