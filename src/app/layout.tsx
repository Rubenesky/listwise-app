import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Suspense } from "react";
import dynamic from "next/dynamic";

const PostHogProvider = dynamic(() => import("@/components/PostHogProvider"), { ssr: false });
const PostHogPageView = dynamic(() => import("@/components/PostHogPageView"), { ssr: false });
const WebVitals = dynamic(() => import("@/components/WebVitals"), { ssr: false });
import LeadMagnetPopup from "@/components/LeadMagnetPopup";
import { BASE_URL } from "@/lib/config";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "ListWise — Generador de Descripciones de Productos con IA",
    template: "%s | ListWise",
  },
  description: "Genera títulos SEO, bullet points y descripciones de productos optimizados con IA. Procesa cientos de productos en minutos desde un CSV. Prueba gratis con 10 productos.",
  keywords: ["generador descripciones productos", "IA ecommerce", "SEO productos", "optimizar listings Amazon", "descripciones marketplace", "inteligencia artificial tienda online"],
  authors: [{ name: "ListWise", url: BASE_URL }],
  creator: "ListWise",
  publisher: "ListWise",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "ListWise — Generador de Descripciones de Productos con IA",
    description: "Genera títulos SEO, bullet points y descripciones de productos con IA. Procesa cientos de productos desde un CSV en minutos.",
    url: BASE_URL,
    siteName: "ListWise",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "ListWise — Generador de listados de productos con IA",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ListWise — Generador de Descripciones de Productos con IA",
    description: "Genera títulos SEO, bullet points y descripciones de productos con IA. Prueba gratis.",
    images: ["/api/og"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: BASE_URL,
  },
  category: "technology",
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${BASE_URL}/#organization`,
  name: "ListWise",
  url: BASE_URL,
  logo: {
    "@type": "ImageObject",
    url: `${BASE_URL}/logo-transparent.png`,
    width: 280,
    height: 92,
  },
  contactPoint: {
    "@type": "ContactPoint",
    email: "contacto@listwise.app",
    contactType: "customer support",
    availableLanguage: "Spanish",
  },
  sameAs: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="es" suppressHydrationWarning>
        <body className={inter.className} suppressHydrationWarning>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c"),
            }}
          />
          <PostHogProvider>
            <Suspense fallback={null}>
              <PostHogPageView />
              <WebVitals />
            </Suspense>
            {children}
            <LeadMagnetPopup />
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
