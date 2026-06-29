import type { Metadata } from "next";
import type { ReactNode } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app";

export const metadata: Metadata = {
  title: "Planes y Precios — Empieza Gratis",
  description:
    "ListWise: plan gratuito con 10 productos, Pro desde 23€/mes (276€/año) y Enterprise desde 79€/mes. Sin tarjeta de crédito para empezar. Cancela cuando quieras.",
  openGraph: {
    title: "Planes y Precios de ListWise — Generador de listings con IA",
    description:
      "Elige el plan que mejor se adapta a tu catálogo. Gratis para empezar, Pro para crecer, Enterprise para equipos.",
    url: `${BASE_URL}/pricing`,
    images: [
      {
        url: `/api/og?title=Planes%20y%20Precios&sub=Gratis%20%C2%B7%20Pro%2023%E2%82%AC%2Fmes%20%C2%B7%20Enterprise%2079%E2%82%AC%2Fmes`,
        width: 1200,
        height: 630,
        alt: "Planes y precios de ListWise",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Planes y Precios — ListWise",
    description: "Gratis para empezar. Pro desde 23€/mes. Enterprise desde 79€/mes.",
    images: [`/api/og?title=Planes%20y%20Precios&sub=Gratis%20para%20empezar%20%C2%B7%20Pro%2023%E2%82%AC%2Fmes`],
  },
  alternates: {
    canonical: `${BASE_URL}/pricing`,
  },
};

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Planes y Precios — ListWise",
  url: `${BASE_URL}/pricing`,
  description: "Precios de ListWise: generador de descripciones de productos con IA para ecommerce.",
  mainEntity: {
    "@type": "Product",
    name: "ListWise",
    description:
      "Generador de títulos, bullets y descripciones de productos con IA para Amazon, Shopify, Etsy, Wallapop y cualquier marketplace.",
    brand: { "@type": "Brand", name: "ListWise" },
    offers: [
      {
        "@type": "Offer",
        name: "Plan Gratuito",
        price: "0",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        description: "10 productos gratuitos. Sin tarjeta de crédito.",
        url: `${BASE_URL}/sign-up`,
      },
      {
        "@type": "Offer",
        name: "Plan Pro",
        price: "29",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        description:
          "Productos ilimitados, Agente de Copywriting IA, exportación CSV, soporte prioritario.",
        url: `${BASE_URL}/pricing`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "276",
          priceCurrency: "EUR",
          billingDuration: "P1Y",
          name: "Anual (276€/año — ahorra 72€)",
        },
      },
      {
        "@type": "Offer",
        name: "Plan Enterprise",
        price: "99",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
        description:
          "Todo Pro más: acceso para equipos, voz de marca avanzada, análisis de competidores ilimitado, soporte dedicado.",
        url: `${BASE_URL}/pricing`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: "948",
          priceCurrency: "EUR",
          billingDuration: "P1Y",
          name: "Anual (948€/año — ahorra 240€)",
        },
      },
    ],
  },
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      />
      {children}
    </>
  );
}
