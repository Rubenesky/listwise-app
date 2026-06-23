import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ListWise - Generador de descripciones de productos con IA",
  description: "Ahorra horas de trabajo y aumenta tus ventas con descripciones optimizadas para SEO y conversión.",
  openGraph: {
    title: "ListWise - Generador de descripciones de productos con IA",
    description: "Ahorra horas de trabajo y aumenta tus ventas con descripciones optimizadas para SEO y conversión.",
    url: "https://listwise-app.onrender.com",
    siteName: "ListWise",
    images: [
      {
        url: "https://listwise-app.onrender.com/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ListWise - Generador de descripciones de productos con IA",
    description: "Ahorra horas de trabajo y aumenta tus ventas con descripciones optimizadas para SEO y conversión.",
    images: ["https://listwise-app.onrender.com/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
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