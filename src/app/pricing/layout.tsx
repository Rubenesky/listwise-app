import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BASE_URL } from "@/lib/config";

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
        url: `/api/og?page=pricing`,
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
    images: [`/api/og?page=pricing`],
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
        description: "20 créditos gratuitos. Sin tarjeta de crédito.",
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

const pricingExtrasJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Precios", item: `${BASE_URL}/pricing` },
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "¿Cuánto cuesta ListWise?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ListWise tiene un plan gratuito con 20 créditos sin tarjeta de crédito. El plan Pro cuesta 29€/mes (o 276€/año) e incluye 1.200 créditos mensuales y todas las funciones avanzadas. El plan Enterprise cuesta 99€/mes para equipos y alto volumen.",
          },
        },
        {
          "@type": "Question",
          name: "¿Hay contrato de permanencia?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. ListWise funciona mes a mes sin permanencia. Puedes cancelar en cualquier momento desde tu panel de usuario y no se te cobrará el siguiente mes.",
          },
        },
        {
          "@type": "Question",
          name: "¿Los créditos caducan?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. Los créditos de ListWise no tienen fecha de caducidad. Se acumulan mes a mes si no los usas todos.",
          },
        },
        {
          "@type": "Question",
          name: "¿Puedo cambiar de plan en cualquier momento?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sí. Puedes actualizar o degradar tu plan en cualquier momento. El cambio se aplica en el siguiente ciclo de facturación.",
          },
        },
      ],
    },
  ],
};

export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingExtrasJsonLd).replace(/</g, "\\u003c") }}
      />
      {children}
    </>
  );
}
