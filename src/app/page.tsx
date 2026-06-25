"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

// Schema.org JSON-LD for GEO (AI search engine optimization)
const schemaOrg = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "ListWise",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://listwise.app",
      description:
        "Generador de descripciones de productos con inteligencia artificial para ecommerce. Genera títulos SEO optimizados, bullet points y descripciones emocionales para marketplaces como Amazon, eBay y Shopify.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        description: "Plan gratuito con 10 productos. Sin tarjeta de crédito.",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        ratingCount: "142",
        bestRating: "5",
      },
      featureList: [
        "Generación de títulos SEO con IA",
        "Bullet points de beneficios",
        "Descripciones para múltiples marketplaces",
        "Procesamiento masivo por CSV",
        "Modos: Creativo, Profesional, SEO",
        "Análisis de competencia",
        "Exportación CSV",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "¿Qué es ListWise y para qué sirve?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "ListWise es una plataforma de inteligencia artificial que genera automáticamente títulos SEO, bullet points y descripciones optimizadas para productos de ecommerce. Está diseñada para vendedores de Amazon, eBay, Shopify y otros marketplaces que necesitan procesar grandes catálogos de productos.",
          },
        },
        {
          "@type": "Question",
          name: "¿Cómo funciona ListWise?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "El proceso es muy sencillo: 1) Sube tu catálogo de productos en formato CSV con la plantilla que te proporcionamos. 2) La IA genera automáticamente títulos, bullet points y descripciones optimizadas. 3) Revisa, edita si necesitas y exporta el resultado. Todo en minutos.",
          },
        },
        {
          "@type": "Question",
          name: "¿En qué plataformas puedo usar las descripciones generadas?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Las descripciones de ListWise funcionan en cualquier plataforma de ecommerce: Amazon, eBay, Shopify, WooCommerce, Wix, Etsy, Wallapop, Milanuncios y cualquier otra tienda online o marketplace.",
          },
        },
        {
          "@type": "Question",
          name: "¿Necesito conocimientos técnicos para usar ListWise?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. ListWise está diseñado para que cualquier persona pueda usarlo sin conocimientos técnicos. Solo necesitas preparar un archivo CSV con los nombres de tus productos y la herramienta hace el resto.",
          },
        },
        {
          "@type": "Question",
          name: "¿Cuántos productos puedo procesar?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "El plan gratuito incluye hasta 10 productos sin necesidad de tarjeta de crédito. El plan Pro ofrece productos ilimitados y acceso a todas las funcionalidades avanzadas.",
          },
        },
        {
          "@type": "Question",
          name: "¿Las descripciones generadas son únicas?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Sí. Cada descripción es generada específicamente para tu producto combinando el nombre, categoría y atributos que proporcionas. La IA crea contenido único y original para cada artículo.",
          },
        },
      ],
    },
  ],
};

const faqs = [
  {
    q: "¿Qué es ListWise?",
    a: "ListWise es una plataforma de IA que genera títulos SEO, bullet points y descripciones de productos para ecommerce. Perfecta para Amazon, eBay, Shopify y cualquier marketplace.",
  },
  {
    q: "¿Cómo funciona?",
    a: "Sube tu CSV con los nombres de productos, la IA genera el contenido y puedes exportarlo todo en minutos. Sin conocimientos técnicos.",
  },
  {
    q: "¿En qué plataformas puedo usar las descripciones?",
    a: "En cualquiera: Amazon, eBay, Shopify, WooCommerce, Etsy, Wix, Woocommerce, Milanuncios y cualquier tienda online.",
  },
  {
    q: "¿Las descripciones son únicas?",
    a: "Sí. Cada texto es generado específicamente para tu producto. No hay plantillas genéricas — la IA usa el nombre, categoría y atributos de cada artículo.",
  },
  {
    q: "¿Cuántos productos incluye el plan gratuito?",
    a: "10 productos sin tarjeta de crédito. El plan Pro tiene productos ilimitados.",
  },
];

const testimonials = [
  {
    name: "María García",
    role: "Tienda de moda online",
    avatar: "MG",
    text: "Pasé de tardar 2 horas por producto a 5 minutos con ListWise. Mi tienda en Shopify nunca ha vendido tan bien.",
    rating: 5,
  },
  {
    name: "Carlos Ruiz",
    role: "Vendedor en Amazon España",
    avatar: "CR",
    text: "Mis ventas en Amazon subieron un 35% en el primer mes. Las descripciones que genera la IA son increíblemente persuasivas.",
    rating: 5,
  },
  {
    name: "Ana López",
    role: "Decoración del hogar",
    avatar: "AL",
    text: "Nunca pensé que una IA podría capturar tan bien el tono de mi marca. Mis clientes dicen que los textos parecen escritos por un profesional.",
    rating: 5,
  },
];

export default function HomePage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    // Basic email validation before redirecting to Clerk sign-up
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    router.push(`/sign-up?emailAddress=${encodeURIComponent(trimmed)}`);
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <>
      {/* Schema.org JSON-LD for SEO and GEO.
          JSON.stringify output is escaped: < → < to prevent </script> injection. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schemaOrg).replace(/</g, "\\u003c"),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Top announcement bar */}
        <div className="bg-blue-700 text-white text-center py-2.5 text-sm px-4">
          🚀 Genera descripciones para 10 productos{" "}
          <strong>gratis</strong> — sin tarjeta de crédito.{" "}
          <Link href="/sign-up" className="underline font-semibold ml-1">
            Empieza ahora →
          </Link>
        </div>

        {/* Sticky navbar */}
        <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <Image
              src="/logo-transparent.png"
              alt="ListWise"
              width={140}
              height={46}
              className="h-9 w-auto"
              priority
            />
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/sign-in"
                className="text-sm text-gray-600 hover:text-blue-600 transition-colors hidden sm:block"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/sign-up"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 hover:scale-105 transition-all"
              >
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </nav>

        <div className="max-w-6xl mx-auto px-4">
          {/* ── Hero ─────────────────────────────────────────── */}
          <section className="text-center py-8 md:py-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Genera descripciones de productos{" "}
              <span className="text-blue-600">que venden</span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Usa IA para crear títulos SEO, bullet points y descripciones
              optimizadas para Amazon, eBay y Shopify. Procesa tu catálogo
              entero en minutos.
            </p>

            {/* Email registration form */}
            <form
              onSubmit={handleEmailSubmit}
              className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto mb-6"
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                aria-label="Tu correo electrónico"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                maxLength={254}
              />
              <button
                type="submit"
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 hover:scale-105 transition-all whitespace-nowrap"
              >
                Empezar gratis →
              </button>
            </form>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-12">
              <Link
                href="/pricing"
                className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium border-2 border-blue-600 hover:bg-blue-50 hover:scale-105 transition-all text-sm"
              >
                Ver precios
              </Link>
            </div>
            <p className="text-sm text-gray-500">
              Sin tarjeta de crédito · 10 productos gratis · Cancela cuando quieras
            </p>
          </section>

          {/* ── Social proof bar ─────────────────────────────── */}
          <div className="bg-white/80 rounded-2xl p-6 shadow-sm mb-12 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">+50.000</p>
              <p className="text-xs text-gray-500 mt-1">Descripciones generadas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">4.8/5</p>
              <p className="text-xs text-gray-500 mt-1">Valoración media</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">-80%</p>
              <p className="text-xs text-gray-500 mt-1">Tiempo de trabajo</p>
            </div>
          </div>

          {/* ── Cómo funciona ─────────────────────────────────── */}
          <section className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 md:p-12 shadow-xl mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
              Cómo funciona ListWise
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  n: 1,
                  title: "Sube tu CSV",
                  desc: "Descarga la plantilla, añade los nombres de tus productos y súbela. Compatible con cualquier catálogo.",
                },
                {
                  n: 2,
                  title: "La IA genera el contenido",
                  desc: "Títulos SEO, bullet points de beneficios y descripciones emocionales — todo en menos de 60 segundos.",
                },
                {
                  n: 3,
                  title: "Edita y exporta",
                  desc: "Revisa el contenido generado, ajusta lo que necesites y exporta un CSV listo para subir a tu plataforma.",
                },
              ].map(({ n, title, desc }) => (
                <div key={n} className="text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-blue-600">{n}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                  <p className="text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Características ──────────────────────────────── */}
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
              Todo lo que necesitas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: "🤖", title: "IA Avanzada", desc: "Modelos de última generación para descripciones únicas y persuasivas." },
                { icon: "⚡", title: "Procesamiento masivo", desc: "Procesa cientos de productos desde un CSV en pocos minutos." },
                { icon: "📊", title: "SEO + GEO", desc: "Optimizado para Google, Amazon y motores de búsqueda de IA." },
                { icon: "🎨", title: "3 modos de escritura", desc: "Creativo, Profesional o SEO según el estilo de tu tienda." },
                { icon: "🔍", title: "Análisis de competencia", desc: "Compara tu listing con competidores y mejora con sugerencias de IA." },
                { icon: "🏆", title: "Sistema de logros", desc: "Gana puntos, desbloquea niveles y obtén descuentos exclusivos." },
                { icon: "📁", title: "Exportación CSV", desc: "Descarga el resultado listo para subir a cualquier plataforma." },
                { icon: "🛡️", title: "Seguro y privado", desc: "Tus datos no se comparten ni se usan para entrenar modelos de IA." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="bg-white rounded-xl p-6 shadow-md text-center hover:shadow-lg transition-shadow">
                  <div className="text-3xl mb-3">{icon}</div>
                  <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                  <p className="text-sm text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Testimonios ──────────────────────────────────── */}
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
              Lo que dicen nuestros usuarios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map(({ name, role, avatar, text, rating }) => (
                <div key={name} className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex mb-3">
                    {Array.from({ length: rating }).map((_, i) => (
                      <span key={i} className="text-yellow-400 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-4">
                    &ldquo;{text}&rdquo;
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                      {avatar}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{name}</p>
                      <p className="text-xs text-gray-500">{role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── CTA central ──────────────────────────────────── */}
          <section className="bg-blue-700 rounded-2xl p-10 text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              ¿Listo para vender más?
            </h2>
            <p className="text-blue-100 mb-6 text-lg">
              Únete a más de 140 vendedores que ya usan ListWise. 10 productos gratis, sin tarjeta.
            </p>
            <Link
              href="/sign-up"
              className="inline-block px-8 py-4 bg-white text-blue-700 rounded-lg font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all shadow-md"
            >
              Crear cuenta gratuita →
            </Link>
          </section>

          {/* ── FAQ (GEO: para motores de IA) ────────────────── */}
          <section className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
              Preguntas frecuentes
            </h2>
            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map(({ q, a }, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <button
                    className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    aria-expanded={openFaq === i}
                  >
                    <span className="font-medium text-gray-900">{q}</span>
                    <span className="text-gray-400 text-xl shrink-0">
                      {openFaq === i ? "−" : "+"}
                    </span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">
                      {a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <footer className="bg-white/50 border-t border-gray-200 py-8">
          <div className="max-w-6xl mx-auto px-4 text-center text-gray-600 text-sm">
            <p className="mb-3">© 2026 ListWise. Todos los derechos reservados.</p>
            <div className="flex justify-center gap-6">
              <Link href="/pricing" className="hover:text-blue-600 transition-colors">Precios</Link>
              <Link href="/sign-up" className="hover:text-blue-600 transition-colors">Registrarse</Link>
              <a href="mailto:contacto@listwise.app" className="hover:text-blue-600 transition-colors">Contacto</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
