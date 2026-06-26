"use client";

import { useState } from "react";
import Link from "next/link";

interface FAQItem {
  q: string;
  a: string;
}

interface FAQSection {
  title: string;
  icon: string;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    title: "¿Qué es ListWise?",
    icon: "🚀",
    items: [
      {
        q: "¿Para qué sirve ListWise?",
        a: "ListWise es una plataforma de IA para vendedores de ecommerce que genera automáticamente títulos, bullets y descripciones optimizadas para marketplace a partir de un catálogo CSV. Ahorra horas de redacción y mejora el posicionamiento de tus productos.",
      },
      {
        q: "¿Quién puede usar ListWise?",
        a: "Cualquier vendedor online: tiendas Shopify, vendedores de Amazon, Etsy, Wallapop, Vinted, marcas con catálogos propios... Si tienes productos que describir, ListWise te ahorra tiempo y mejora tus conversiones.",
      },
      {
        q: "¿Necesito conocimientos técnicos?",
        a: "No. Solo tienes que subir un CSV con tus productos y la IA hace el resto. La plantilla CSV que proporcionamos es muy sencilla.",
      },
    ],
  },
  {
    title: "Créditos",
    icon: "💳",
    items: [
      {
        q: "¿Qué son los créditos?",
        a: "Los créditos son la moneda interna de ListWise. Cada acción consume una cantidad: generar un producto gasta 1 crédito, el análisis de competidor gasta 2 créditos. Los créditos nunca caducan.",
      },
      {
        q: "¿Cómo consigo créditos?",
        a: "De varias formas: (1) Al registrarte recibes créditos de bienvenida, (2) Con un plan Pro (1.500 créditos) o Enterprise (7.000 créditos), (3) Invitando a otros usuarios — tú y tu invitado recibís 10 créditos cada uno al registrarse, y 25 créditos más cuando convierten a un plan de pago.",
      },
      {
        q: "¿Dónde veo mi historial de créditos?",
        a: "En el icono de moneda en la barra superior puedes ver los últimos movimientos. Para el historial completo entra en Créditos desde ese mismo menú.",
      },
      {
        q: "¿Qué pasa si me quedo sin créditos?",
        a: "No podrás generar nuevos contenidos ni analizar competidores hasta recargar. Puedes comprar un plan o invitar amigos para obtener créditos gratis.",
      },
    ],
  },
  {
    title: "Subida de CSV",
    icon: "📂",
    items: [
      {
        q: "¿Qué formato debe tener el CSV?",
        a: "Descarga la plantilla desde el navbar (botón 'Plantilla CSV'). Las columnas mínimas son: nombre del producto, categoría y atributos opcionales. El separador debe ser coma (,) y la codificación UTF-8.",
      },
      {
        q: "¿Cuántos productos puedo subir a la vez?",
        a: "Hasta 50 productos por subida en plan Free, hasta 200 en plan Pro y sin límite en Enterprise.",
      },
      {
        q: "¿Qué modos de generación hay?",
        a: "Hay tres modos: Profesional (copy formal y técnico), Creativo (copy emocional y descriptivo) y SEO Optimizado (centrado en palabras clave para buscadores). Puedes elegirlo antes de subir el CSV.",
      },
      {
        q: "¿Puedo editar los resultados?",
        a: "Sí. Cada producto generado tiene un editor donde puedes modificar el título, los bullets y la descripción. Los cambios se guardan automáticamente.",
      },
    ],
  },
  {
    title: "Agente IA",
    icon: "🤖",
    items: [
      {
        q: "¿Qué es el Agente IA?",
        a: "El Agente es un asistente conversacional especializado en ecommerce. Puedes pedirle que reescriba descripciones, genere variantes, adapte el tono, traduzca o responda preguntas sobre copywriting de producto.",
      },
      {
        q: "¿Cuántos créditos gasta el Agente?",
        a: "Los créditos del Agente son independientes de los créditos de generación. El plan Free incluye 10 créditos de agente. Los planes Pro y Enterprise incluyen más créditos de agente.",
      },
      {
        q: "¿Qué diferencia hay entre el generador CSV y el Agente?",
        a: "El generador CSV procesa lotes de productos de forma automatizada. El Agente es conversacional y permite iteración manual: pides cambios concretos, el agente los aplica, tú los revisas y sigues refinando.",
      },
    ],
  },
  {
    title: "Análisis de Competidor",
    icon: "🔍",
    items: [
      {
        q: "¿Qué hace el analizador de competidor?",
        a: "Analiza el listing de un producto de un competidor (título, descripción, bullets, precio, tono de venta) y genera recomendaciones concretas para mejorar tu propio listing comparativamente.",
      },
      {
        q: "¿Funciona con cualquier URL?",
        a: "Con la mayoría de tiendas online: Amazon, Shopify, Etsy, Zalando, Mango, Zara, etc. Para SHEIN y plataformas con protección anti-bot muy agresiva, el análisis usa los datos disponibles del URL (que ya incluyen el título del producto).",
      },
      {
        q: "¿Cuánto cuesta cada análisis?",
        a: "2 créditos por análisis. No hay límite diario — el único límite son tus créditos disponibles.",
      },
      {
        q: "Los resultados de SHEIN parecen limitados, ¿por qué?",
        a: "SHEIN usa Cloudflare con protección anti-bot de nivel enterprise. Sin scrapers premium, el análisis se basa en el título del URL (que ya es el título real del producto) y aplica el análisis sobre ese dato. Para análisis completos con precio y descripción de SHEIN, necesitarías un proveedor de scraping premium.",
      },
    ],
  },
  {
    title: "Sistema de Referidos",
    icon: "🎁",
    items: [
      {
        q: "¿Cómo funciona el programa de referidos?",
        a: "Comparte tu enlace personal desde la sección 'Invitar'. Cuando alguien se registra con tu enlace, ambos recibís 10 créditos. Cuando esa persona contrata un plan de pago, ambos recibís 25 créditos adicionales.",
      },
      {
        q: "¿Cuándo se dan los créditos del referido?",
        a: "Los 10 créditos de registro se dan en el momento en que la persona se registra. Los 25 créditos de conversión llegan cuando esa persona compra un plan Pro o Enterprise.",
      },
      {
        q: "¿Cómo consigo el enlace para invitar?",
        a: "En la sección 'Invitar' del menú. Puedes copiarlo o compartirlo directamente en WhatsApp, X, Facebook, Telegram o Email.",
      },
      {
        q: "¿Qué insignias puedo ganar con referidos?",
        a: "Tres: 🤝 Primer Referido (1 registro), 💫 5 Referidos (5 registros) y 👑 10 Referidos (10 registros). Aparecen en tu página de Gamificación.",
      },
    ],
  },
  {
    title: "Gamificación",
    icon: "🏆",
    items: [
      {
        q: "¿Qué es el sistema de gamificación?",
        a: "Un sistema de puntos y niveles que premia el uso activo de ListWise. Subes de nivel al acumular puntos, desbloqueas insignias y apareces en el ranking global.",
      },
      {
        q: "¿Cómo gano puntos?",
        a: "Subir CSV (+1 pt), generar producto (+2 pts), completar producto (+3 pts), editar descripción (+1 pt), chatear con IA (+2 pts), compartir landing (+3 pts), convertir un referido (+15 pts) y mantener racha diaria (+3 pts).",
      },
      {
        q: "¿Cuántos niveles hay?",
        a: "6 niveles: Novato → Aprendiz → Experto → Maestro → Élite → Leyenda. Cada nivel requiere más puntos que el anterior.",
      },
      {
        q: "¿Las insignias son permanentes?",
        a: "Sí. Una vez ganada, una insignia no se pierde. Aparecen en la página de Gamificación y algunas también en la sección de Invitar.",
      },
    ],
  },
  {
    title: "Planes y Facturación",
    icon: "💰",
    items: [
      {
        q: "¿Qué diferencia hay entre los planes?",
        a: "Plan Free: créditos iniciales limitados, acceso a todas las funciones básicas. Plan Pro (1.500 créditos/mes): ideal para vendedores activos. Plan Enterprise (7.000 créditos/mes): para equipos y catálogos grandes con soporte prioritario.",
      },
      {
        q: "¿Puedo cancelar en cualquier momento?",
        a: "Sí. La cancelación es inmediata. Mantienes el acceso hasta el fin del período pagado y los créditos no usados se conservan.",
      },
      {
        q: "¿Cómo se renueva el plan?",
        a: "Los planes se renuevan automáticamente cada mes. Recibirás los créditos correspondientes al inicio de cada ciclo de facturación.",
      },
    ],
  },
];

function FAQAccordion({ items }: { items: FAQItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-medium text-gray-800 pr-4">{item.q}</span>
            <span className="text-gray-400 shrink-0 text-lg leading-none">
              {open === i ? "−" : "+"}
            </span>
          </button>
          {open === i && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HelpPage() {
  const [search, setSearch] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const filtered = search.trim()
    ? FAQ_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.q.toLowerCase().includes(search.toLowerCase()) ||
            item.a.toLowerCase().includes(search.toLowerCase())
        ),
      })).filter((section) => section.items.length > 0)
    : activeSection
    ? FAQ_SECTIONS.filter((s) => s.title === activeSection)
    : FAQ_SECTIONS;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">❓ Centro de Ayuda</h1>
        <p className="text-sm text-gray-500">Todo lo que necesitas saber sobre ListWise</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <input
          type="text"
          placeholder="Buscar en preguntas frecuentes..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveSection(null); }}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔎</span>
      </div>

      {/* Category chips */}
      {!search && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveSection(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              activeSection === null
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todas
          </button>
          {FAQ_SECTIONS.map((section) => (
            <button
              key={section.title}
              onClick={() => setActiveSection(activeSection === section.title ? null : section.title)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeSection === section.title
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {section.icon} {section.title}
            </button>
          ))}
        </div>
      )}

      {/* FAQ Sections */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No encontramos resultados para &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filtered.map((section) => (
            <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-800">
                  {section.icon} {section.title}
                </h2>
              </div>
              <div className="p-4">
                <FAQAccordion items={section.items} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contact footer */}
      <div className="mt-10 p-5 bg-purple-50 rounded-xl border border-purple-100 text-center">
        <p className="text-sm font-medium text-purple-800 mb-1">¿No encontraste lo que buscabas?</p>
        <p className="text-xs text-purple-600 mb-3">
          Escríbenos y te ayudamos en menos de 24h.
        </p>
        <a
          href="mailto:soporte@listwise.app"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors"
        >
          Contactar soporte
        </a>
      </div>

      <div className="mt-4 text-center">
        <Link href="/dashboard" className="text-xs text-gray-400 hover:text-gray-600">
          ← Volver al Dashboard
        </Link>
      </div>
    </div>
  );
}
