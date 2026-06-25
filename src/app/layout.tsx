import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app";

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
        url: "/og-image.png",
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
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  alternates: {
    canonical: BASE_URL,
  },
  category: "technology",
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
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}