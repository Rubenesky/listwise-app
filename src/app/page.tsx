import Image from "next/image";
import Link from "next/link";
import { AuthRedirect } from "@/components/AuthRedirect";
import { HeroEmailForm } from "@/components/HeroEmailForm";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://listwise.app";

const schemaOrg = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${BASE_URL}/#organization`,
      name: "ListWise",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/logo-transparent.png`,
      },
      contactPoint: {
        "@type": "ContactPoint",
        email: "contacto@listwise.app",
        contactType: "customer support",
        availableLanguage: "Spanish",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${BASE_URL}/#app`,
      name: "ListWise",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: BASE_URL,
      author: { "@id": `${BASE_URL}/#organization` },
      description:
        "Generador de descripciones de productos con inteligencia artificial para ecommerce. Genera títulos SEO optimizados, bullet points y descripciones emocionales para marketplaces como Amazon, eBay y Shopify.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "EUR",
        description: "Plan gratuito con 20 créditos. Sin tarjeta de crédito.",
      },
      featureList: [
        "Agente de Copywriting IA conversacional",
        "Generación de títulos SEO con IA",
        "Bullet points de beneficios estructurados",
        "Descripciones para múltiples marketplaces",
        "Procesamiento masivo por CSV",
        "Análisis de competidores con IA",
        "Exportación CSV",
        "Voz de marca personalizada por categoría",
      ],
    },
    {
      "@type": "HowTo",
      name: "Cómo generar descripciones de productos con ListWise",
      description:
        "Genera títulos SEO, bullet points y descripciones para tus productos de ecommerce en 3 pasos con inteligencia artificial.",
      totalTime: "PT2M",
      estimatedCost: { "@type": "MonetaryAmount", currency: "EUR", value: "0" },
      step: [
        {
          "@type": "HowToStep",
          position: 1,
          name: "Descarga la plantilla CSV",
          text: "Descarga la plantilla CSV de ListWise y añade los nombres de tus productos, categoría y atributos básicos.",
        },
        {
          "@type": "HowToStep",
          position: 2,
          name: "Sube tu catálogo",
          text: "Sube el archivo CSV a ListWise. La IA procesa cada producto automáticamente en menos de 60 segundos.",
        },
        {
          "@type": "HowToStep",
          position: 3,
          name: "Edita y exporta",
          text: "Revisa los títulos SEO, bullet points y descripciones generadas. Edita lo que necesites y exporta el resultado listo para subir a tu marketplace.",
        },
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
            text: "El plan gratuito incluye 20 créditos sin necesidad de tarjeta de crédito. El plan Pro ofrece productos ilimitados y acceso a todas las funcionalidades avanzadas.",
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
    a: "En cualquiera: Amazon, eBay, Shopify, WooCommerce, Etsy, Wix, Milanuncios y cualquier tienda online.",
  },
  {
    q: "¿Las descripciones son únicas?",
    a: "Sí. Cada texto es generado específicamente para tu producto. No hay plantillas genéricas — la IA usa el nombre, categoría y atributos de cada artículo.",
  },
  {
    q: "¿Cuántos productos incluye el plan gratuito?",
    a: "20 créditos sin tarjeta de crédito. El plan Pro tiene productos ilimitados.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Auth redirect (client island — only JS that runs) */}
      <AuthRedirect />

      {/* Schema.org JSON-LD — server-rendered, visible to all crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(schemaOrg).replace(/</g, "\\u003c"),
        }}
      />

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Top announcement bar */}
        <div className="bg-blue-700 text-white text-center py-2.5 text-sm px-4">
          🎯 Precios de lanzamiento activos — regístrate ahora y fija tu tarifa.{" "}
          <Link href="/sign-up" className="underline font-semibold ml-1">
            10 productos gratis →
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
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-5 tracking-wide uppercase">
              🚀 IA para ecommerce
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              Listings que venden más,{" "}
              <span className="text-blue-600">generados en segundos</span>
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto mb-5">
              IA que crea títulos SEO, bullets de conversión y descripciones con la voz de tu marca.
              Para Amazon, Zalando, Shopify, Etsy y cualquier marketplace.
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-sm text-gray-500 mb-8">
              {[
                "Agente de copywriting IA conversacional",
                "Análisis de competidores con IA",
                "Procesa catálogos enteros por CSV",
                "Mantiene la voz de tu marca",
              ].map((b) => (
                <li key={b} className="flex items-center gap-1.5">
                  <span className="text-green-500 font-bold">✓</span> {b}
                </li>
              ))}
            </ul>

            {/* Email form — client island */}
            <HeroEmailForm />

            <p className="text-sm text-gray-500 mb-3">
              Sin tarjeta de crédito · 20 créditos gratis · Cancela cuando quieras
            </p>
            <Link href="/pricing" className="text-sm text-blue-600 hover:underline">
              Ver planes y precios →
            </Link>
          </section>

          {/* ── Social proof bar ─────────────────────────────── */}
          <div className="bg-white/80 rounded-2xl p-6 shadow-sm mb-12 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">&lt; 60 seg</p>
              <p className="text-xs text-gray-500 mt-1">Listing completo por producto</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">8+</p>
              <p className="text-xs text-gray-500 mt-1">Marketplaces compatibles</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">100%</p>
              <p className="text-xs text-gray-500 mt-1">Contenido único por producto</p>
            </div>
          </div>

          {/* ── Marketplaces compatibles ─────────────────────── */}
          <div className="mb-10 text-center">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-medium">Compatible con todos los marketplaces</p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Amazon", "Zalando", "Shopify", "Etsy", "Wallapop", "Milanuncios", "eBay", "WooCommerce"].map((mp) => (
                <span key={mp} className="px-4 py-1.5 bg-white rounded-full text-sm text-gray-600 shadow-sm border border-gray-100 font-medium hover:border-blue-200 transition-colors">
                  {mp}
                </span>
              ))}
            </div>
          </div>

          {/* ── Demo: antes y después ─────────────────────────── */}
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
              Ve el resultado antes de registrarte
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">De un nombre de producto a un listing completo y optimizado</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start max-w-4xl mx-auto">
              {/* Before */}
              <div className="bg-gray-50 rounded-xl p-6 border-2 border-dashed border-gray-200">
                <span className="inline-block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Tu CSV de entrada</span>
                <div className="space-y-2.5">
                  {[
                    { label: "Nombre", value: "Auriculares BT 500" },
                    { label: "Categoría", value: "Electrónica" },
                    { label: "Precio", value: "59,99€" },
                    { label: "Material", value: "Plástico ABS, espuma" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3 text-sm">
                      <span className="text-gray-400 w-20 shrink-0">{label}:</span>
                      <span className="text-gray-700 font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* After */}
              <div className="bg-white rounded-xl p-6 border-2 border-blue-200 shadow-lg relative">
                <span className="absolute -top-3 left-4 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
                  ListWise genera →
                </span>
                <span className="inline-block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Listing optimizado</span>
                <p className="font-bold text-sm text-gray-900 mb-3 leading-snug">
                  Auriculares Bluetooth BT 500 Inalámbricos | 40h Batería | Cancelación Activa de Ruido | Sonido Premium
                </p>
                <ul className="space-y-1.5 mb-4">
                  {[
                    "SONIDO ENVOLVENTE: Drivers 40mm para graves profundos y agudos nítidos en cada nota",
                    "BATERÍA 40H: Escucha música ininterrumpida todo el día sin buscar el cargador",
                    "CANCELACIÓN ACTIVA: Elimina hasta el 95% del ruido ambiental para máxima concentración",
                  ].map((b) => (
                    <li key={b} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <span className="text-blue-500 shrink-0 mt-0.5 font-bold">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 italic leading-relaxed border-t border-gray-100 pt-3">
                  &ldquo;Imagina cerrar el mundo exterior y entrar en tu propia burbuja de sonido. Con los BT 500, cada nota llega exactamente como fue grabada...&rdquo;
                </p>
              </div>
            </div>
          </section>

          {/* ── CTA intermedio post-demo ─────────────────────── */}
          <div className="text-center mb-12 -mt-4">
            <Link
              href="/sign-up"
              className="inline-block px-8 py-3.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 hover:scale-105 transition-all shadow-md"
            >
              Pruébalo gratis con tu propio producto →
            </Link>
            <p className="text-xs text-gray-400 mt-2">Sin tarjeta · 10 productos gratis</p>
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
                { icon: "🤖", title: "Agente de Copywriting IA", desc: "Chat conversacional para refinar títulos, bullets y descripciones con instrucciones en lenguaje natural." },
                { icon: "⚡", title: "Procesamiento masivo CSV", desc: "Sube tu catálogo entero y obtén todos los listings optimizados en minutos." },
                { icon: "📊", title: "SEO + GEO optimizado", desc: "Estructura y keywords diseñados para rankear en Amazon, Google y motores de búsqueda IA." },
                { icon: "🎯", title: "Voz de marca por categoría", desc: "Prompts especializados por categoría: Moda, Electrónica, Hogar, Deporte, Alimentación, Belleza." },
                { icon: "🔍", title: "Análisis de competidores", desc: "Detecta qué keywords usa la competencia, compara scores y recibe sugerencias para superar sus listings." },
                { icon: "🏆", title: "Sistema de logros", desc: "Gana puntos, desbloquea niveles y obtén descuentos exclusivos al mejorar tus productos." },
                { icon: "📁", title: "Exportación CSV", desc: "Descarga el resultado listo para subir a cualquier plataforma o feed de datos." },
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

          {/* ── Agente de Copywriting ────────────────────────── */}
          <section className="mb-12 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 md:p-12 border border-indigo-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div>
                <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-4 uppercase tracking-wide">
                  🤖 Exclusivo: Agente IA
                </span>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Refina cada listing en segundos con lenguaje natural
                </h2>
                <p className="text-gray-600 mb-5 leading-relaxed">
                  No solo genera el contenido — puedes perfeccionarlo con instrucciones conversacionales. Como tener un copywriter experto disponible 24/7.
                </p>
                <ul className="space-y-2.5">
                  {[
                    "\"Cambia el tono a más juvenil y añade urgencia\"",
                    "\"Añade las keywords SEO más relevantes\"",
                    "\"Hazlo más corto para Wallapop\"",
                    "\"Analiza al competidor y mejora mi listing\"",
                    "\"Auto-optimiza hasta superar 85 puntos\"",
                  ].map((cmd) => (
                    <li key={cmd} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-indigo-500 shrink-0 mt-0.5">→</span>
                      <span className="italic">{cmd}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Chat mockup */}
              <div className="bg-white rounded-xl shadow-lg p-5 border border-indigo-100">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                  <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">L</div>
                  <span className="text-sm font-semibold text-gray-800">Agente ListWise</span>
                  <span className="ml-auto text-xs text-green-500 font-medium">● En línea</span>
                </div>
                <div className="space-y-3 mb-4">
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white text-xs px-3 py-2 rounded-xl rounded-tr-sm max-w-[80%] leading-relaxed">
                      Cambia el tono a más juvenil y añade urgencia
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 text-xs">🤖</div>
                    <div className="bg-gray-50 text-xs px-3 py-2 rounded-xl rounded-tl-sm border border-gray-100 max-w-[80%] leading-relaxed text-gray-700">
                      ¡Perfecto! Aquí tienes la nueva descripción con tono más dinámico:
                      <div className="mt-2 bg-indigo-50 rounded-lg p-2 text-indigo-800 italic leading-snug">
                        &ldquo;¿Buscas el sonido que te lleve al siguiente nivel? Los BT 500 son TU movida. 40h de batería, cero ruido del mundo, 100% tú. 🎧 Stock limitado — hazte con los tuyos →&rdquo;
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-blue-600 text-white text-xs px-3 py-2 rounded-xl rounded-tr-sm max-w-[80%] leading-relaxed">
                      Perfecto, ahora analiza al competidor principal
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 text-xs">🤖</div>
                    <div className="bg-gray-50 text-xs px-3 py-2 rounded-xl rounded-tl-sm border border-gray-100 max-w-[80%] leading-relaxed text-gray-700">
                      Analizado. Tu competidor usa &ldquo;plegable&rdquo; y &ldquo;gaming&rdquo; — keywords que tú no tienes. ¿Los añado?
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-gray-100 pt-3">
                  <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-400 border border-gray-200">
                    Escribe una instrucción...
                  </div>
                  <button className="bg-blue-600 text-white text-xs px-3 py-2 rounded-lg font-medium">→</button>
                </div>
              </div>
            </div>
          </section>

          {/* ── Precios en landing ───────────────────────────── */}
          <section className="mb-12">
            <div className="flex justify-center mb-3">
              <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                🔖 Precio de lanzamiento — puede subir en cualquier momento
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
              Precios simples, sin sorpresas
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">
              Sin permanencia · Cancela cuando quieras · Créditos sin caducidad
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                {
                  name: "Gratuito",
                  price: "0€",
                  desc: "Para probar sin riesgo",
                  features: ["20 créditos/mes", "50 productos por CSV", "Agente IA incluido", "Exportación CSV"],
                  cta: "Empezar gratis",
                  href: "/sign-up",
                  highlight: false,
                },
                {
                  name: "Pro",
                  price: "29€",
                  desc: "Para tiendas en crecimiento",
                  features: ["1.500 créditos/mes", "200 productos por CSV", "Agente IA ilimitado", "Análisis competidor ilimitado", "Soporte prioritario"],
                  cta: "Empezar con Pro",
                  href: "/pricing",
                  highlight: true,
                },
                {
                  name: "Enterprise",
                  price: "99€",
                  desc: "Para alto volumen",
                  features: ["7.000 créditos/mes", "Productos ilimitados", "API personalizada", "Account manager 24/7"],
                  cta: "Ver Enterprise",
                  href: "/pricing",
                  highlight: false,
                },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={`bg-white rounded-xl p-6 shadow-md flex flex-col ${plan.highlight ? "ring-2 ring-blue-600 relative" : ""}`}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap">
                      Más popular
                    </span>
                  )}
                  <h3 className="font-bold text-gray-900 text-base mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                    {plan.price !== "0€" && <span className="text-sm text-gray-400">/mes</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{plan.desc}</p>
                  <ul className="space-y-1.5 mb-5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="text-green-500 font-bold shrink-0">✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={plan.href}
                    className={`block text-center py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 ${
                      plan.highlight
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">
              ¿Prefieres facturación anual?{" "}
              <Link href="/pricing" className="text-blue-600 hover:underline">
                Ahorra un 20% →
              </Link>
            </p>
          </section>

          {/* ── Comparativa vs redactor humano ──────────────── */}
          <section className="mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-3">
              ¿Por qué no simplemente contratar un redactor?
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">
              Una comparativa honesta para que decidas tú mismo
            </p>
            <div className="max-w-3xl mx-auto overflow-x-auto">
              <table className="w-full text-sm rounded-2xl overflow-hidden shadow-md">
                <thead>
                  <tr>
                    <th className="bg-gray-50 px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide w-1/3"></th>
                    <th className="bg-gray-50 px-5 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Redactor freelance</th>
                    <th className="bg-blue-600 px-5 py-3 text-center text-xs font-semibold text-white uppercase tracking-wide">ListWise IA</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-50">
                  {[
                    { label: "Coste por producto", human: "15 – 50 €", lw: "< 0,02 €", lwWins: true },
                    { label: "Tiempo por producto", human: "30 – 90 min", lw: "< 60 seg", lwWins: true },
                    { label: "Disponibilidad", human: "Horario laboral", lw: "24 / 7", lwWins: true },
                    { label: "Escala a 500 productos", human: "Semanas + coste alto", lw: "Minutos, mismo precio", lwWins: true },
                    { label: "Consistencia de tono", human: "Variable por redactor", lw: "100% uniforme", lwWins: true },
                    { label: "Matiz y creatividad humana", human: "✓ Alto", lw: "Bueno con el Agente", lwWins: false },
                  ].map((row) => (
                    <tr key={row.label} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-xs font-medium text-gray-700">{row.label}</td>
                      <td className="px-5 py-3 text-center text-xs text-gray-500">{row.human}</td>
                      <td className={`px-5 py-3 text-center text-xs font-semibold ${row.lwWins ? "text-blue-700 bg-blue-50/60" : "text-gray-600 bg-blue-50/30"}`}>
                        {row.lw}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-center text-xs text-gray-400 mt-3">
              * Precios de freelance basados en tarifas medias de mercado en España (Fiverr, Workana, 2024)
            </p>
          </section>

          {/* ── CTA central ──────────────────────────────────── */}
          <section className="bg-blue-700 rounded-2xl p-10 text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
              Tu primer listing optimizado en menos de 60 segundos
            </h2>
            <p className="text-blue-100 mb-6 text-base">
              Empieza gratis, sin tarjeta de crédito. Sube tu CSV y ve el resultado ahora mismo.
            </p>
            <Link
              href="/sign-up"
              className="inline-block px-8 py-4 bg-white text-blue-700 rounded-lg font-bold text-lg hover:bg-blue-50 hover:scale-105 transition-all shadow-md"
            >
              Crear cuenta gratuita →
            </Link>
            <p className="text-blue-200 text-xs mt-4">Sin tarjeta · 10 productos gratis · Cancela cuando quieras</p>
          </section>

          {/* ── FAQ — server-rendered, no JS needed ──────────── */}
          <section className="mb-16">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12">
              Preguntas frecuentes
            </h2>
            <div className="max-w-3xl mx-auto space-y-3">
              {faqs.map(({ q, a }) => (
                <details key={q} className="bg-white rounded-xl shadow-sm overflow-hidden group">
                  <summary className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors cursor-pointer list-none">
                    <span className="font-medium text-gray-900">{q}</span>
                    <span className="text-gray-400 text-xl shrink-0 group-open:hidden">+</span>
                    <span className="text-gray-400 text-xl shrink-0 hidden group-open:block">−</span>
                  </summary>
                  <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">{a}</div>
                </details>
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
              <Link href="/blog" className="hover:text-blue-600 transition-colors">Blog</Link>
              <Link href="/sign-up" className="hover:text-blue-600 transition-colors">Registrarse</Link>
              <a href="mailto:contacto@listwise.app" className="hover:text-blue-600 transition-colors">Contacto</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
