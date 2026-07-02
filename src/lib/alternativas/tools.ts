export interface ComparisonRow {
  feature: string;
  listwise: string | true | false;
  competitor: string | true | false;
}

export interface AlternativaTool {
  slug: string;
  name: string;
  title: string;
  description: string;
  competitorCategory: string;
  competitorPrice: string;
  heroHeadline: string;
  heroParagraph: string;
  comparison: ComparisonRow[];
  reasonsToChoose: { title: string; body: string }[];
  verdict: string;
}

export const tools: AlternativaTool[] = [
  {
    slug: "helium-10",
    name: "Helium 10",
    title: "ListWise vs Helium 10: alternativa más barata para listings de Amazon",
    description: "Comparativa completa de ListWise vs Helium 10 en 2026. Descubre cuál genera mejores listings de Amazon con IA, cuál es más barato y cuándo elegir cada uno.",
    competitorCategory: "Suite completa Amazon",
    competitorPrice: "Desde 39 €/mes (hasta 279 €/mes)",
    heroHeadline: "¿Pagas Helium 10 solo para escribir listings? Hay una alternativa mejor",
    heroParagraph: "Helium 10 es una suite muy potente para research de keywords, tracking de posiciones y análisis financiero de Amazon. Pero si tu necesidad principal es generar o mejorar el contenido de tus listings — títulos, bullets, descripciones — estás pagando por decenas de funciones que no usas. ListWise está construido específicamente para ese trabajo: genera títulos SEO, bullet points y descripciones optimizadas en segundos, directamente desde tu catálogo en CSV.",
    comparison: [
      { feature: "Generación de listings con IA", listwise: "Especializada por categoría", competitor: "Básica (Listing Builder)" },
      { feature: "Procesamiento masivo por CSV", listwise: true, competitor: false },
      { feature: "Agente de copywriting conversacional", listwise: true, competitor: false },
      { feature: "Análisis de competencia", listwise: "Por producto", competitor: "Avanzado (multi-keyword)" },
      { feature: "Keyword research Amazon", listwise: false, competitor: true },
      { feature: "Tracking de posiciones", listwise: false, competitor: true },
      { feature: "Análisis financiero / PPC", listwise: false, competitor: true },
      { feature: "Health Score de listing", listwise: true, competitor: false },
      { feature: "Exportación CSV lista para Seller Central", listwise: true, competitor: "Parcial" },
      { feature: "Precio de entrada", listwise: "Gratis (20 créditos)", competitor: "39 €/mes" },
      { feature: "Plan Pro", listwise: "29 €/mes", competitor: "99 €/mes" },
    ],
    reasonsToChoose: [
      {
        title: "Especialización vs. generalismo",
        body: "ListWise hace una cosa extremadamente bien: generar contenido de listing optimizado con IA. Helium 10 hace muchas cosas bien, pero su generador de listings es una función secundaria dentro de una suite de research. Si ya tienes tus keywords y solo quieres convertirlas en listings de alta calidad, ListWise es la herramienta correcta.",
      },
      {
        title: "Precio 3-10x menor",
        body: "El plan Pro de ListWise cuesta 29 €/mes. El plan equivalente de Helium 10 con Listing Builder está en el tier Platinum (99 €/mes) o Diamond (279 €/mes). Para una tienda con 50-500 productos que ya sabe qué keywords usar, ListWise amortiza en días.",
      },
      {
        title: "Flujo CSV → listing → exportación",
        body: "ListWise procesa tu catálogo completo en minutos: sube el CSV, elige el modo (creativo, profesional, SEO), y descarga todos los listings listos para Seller Central. Helium 10 no tiene procesamiento masivo — cada listing se genera de uno en uno.",
      },
      {
        title: "Cuándo elegir Helium 10",
        body: "Si necesitas keyword research profundo, tracking de posiciones, análisis de competidores a nivel de BSR y gestión de PPC, Helium 10 no tiene rival. Muchos sellers usan las dos herramientas: Helium 10 para research y ListWise para producción de contenido.",
      },
    ],
    verdict: "Para sellers que necesitan una herramienta enfocada en generar y mejorar el contenido de sus listings con IA, ListWise es la alternativa a Helium 10 más barata y especializada. Para research completo de Amazon, Helium 10 sigue siendo la referencia.",
  },
  {
    slug: "jasper",
    name: "Jasper AI",
    title: "ListWise vs Jasper: qué IA usar para listings de productos en 2026",
    description: "Comparativa ListWise vs Jasper AI para generar descripciones y listings de Amazon, Etsy y Shopify. Cuál da mejores resultados para ecommerce y cuál es más barato.",
    competitorCategory: "Redactor IA generalista",
    competitorPrice: "Desde 39 €/mes",
    heroHeadline: "Jasper escribe bien, pero no sabe de Amazon. ListWise sí.",
    heroParagraph: "Jasper es uno de los mejores redactores de IA para marketing general: blogs, anuncios, emails, redes sociales. Pero no está diseñado para los formatos específicos de Amazon, Etsy o Shopify. No conoce el límite de 200 caracteres del título de Amazon, no genera 5 bullet points con la estructura BENEFICIO + FEATURE, y no puede procesar tu CSV de 300 productos en una sola operación. ListWise está construido exactamente para ese caso de uso.",
    comparison: [
      { feature: "Conocimiento de formato Amazon", listwise: "Nativo (título, bullets, A9)", competitor: "Genérico (requiere prompt manual)" },
      { feature: "Procesamiento masivo CSV", listwise: true, competitor: false },
      { feature: "Generación por categoría de producto", listwise: "Reglas por categoría", competitor: false },
      { feature: "Agente de refinamiento conversacional", listwise: true, competitor: "Editor genérico" },
      { feature: "Soporte Etsy, Shopify, Wallapop", listwise: true, competitor: false },
      { feature: "Health Score del listing", listwise: true, competitor: false },
      { feature: "Exportación a CSV para Seller Central", listwise: true, competitor: false },
      { feature: "Redacción de blogs y marketing", listwise: false, competitor: true },
      { feature: "Anuncios (Google Ads, Meta)", listwise: false, competitor: true },
      { feature: "Precio de entrada", listwise: "Gratis (20 créditos)", competitor: "39 €/mes" },
      { feature: "Plan Pro", listwise: "29 €/mes", competitor: "59 €/mes" },
    ],
    reasonsToChoose: [
      {
        title: "Conocimiento de marketplace desde el primer prompt",
        body: "ListWise conoce las reglas de cada plataforma: el máximo de 200 caracteres del título en Amazon, la estructura de bullet points con BENEFICIO en mayúsculas, el tono narrativo largo que funciona en Etsy. Jasper genera texto genérico correcto, pero necesitas prompts muy elaborados y mucha revisión manual para llegar a ese mismo resultado.",
      },
      {
        title: "Escala desde 1 hasta 1.000 productos",
        body: "Con Jasper, cada listing se genera de uno en uno. Con ListWise, subes un CSV con todo tu catálogo y obtienes todos los listings en 2-3 minutos. Para tiendas con más de 20 productos, la diferencia de tiempo es brutal.",
      },
      {
        title: "Refinamiento con el Agente, no con prompts técnicos",
        body: "El Agente de Copywriting de ListWise entiende instrucciones en lenguaje natural referidas al producto ya generado: 'hazlo más formal', 'acorta la descripción', 'añade la keyword auriculares bluetooth'. En Jasper, cada modificación es un prompt nuevo que hay que escribir desde cero.",
      },
      {
        title: "Cuándo elegir Jasper",
        body: "Si tu necesidad principal es generar contenido de marketing general — posts de blog, scripts de vídeo, textos de email, anuncios de Meta — Jasper es superior. Muchas agencias usan Jasper para contenido y ListWise para listings de marketplace.",
      },
    ],
    verdict: "Para generar y optimizar listings de Amazon, Etsy y Shopify con IA, ListWise es más preciso, más barato y más rápido que Jasper. Jasper es la mejor opción para contenido de marketing general fuera del contexto de marketplace.",
  },
  {
    slug: "chatgpt",
    name: "ChatGPT",
    title: "ListWise vs ChatGPT para listings de Amazon: qué funciona mejor en 2026",
    description: "¿ChatGPT sirve para generar listings de Amazon? Comparativa real con ListWise: calidad, velocidad, coste y flujo de trabajo. Cuándo usar cada uno.",
    competitorCategory: "IA conversacional generalista",
    competitorPrice: "Gratis / ChatGPT Plus 20 $/mes",
    heroHeadline: "ChatGPT puede escribir listings. ListWise lo hace en escala y en segundos.",
    heroParagraph: "ChatGPT es extraordinariamente capaz y muchos sellers lo usan para escribir listings. El problema es el flujo de trabajo: necesitas escribir un prompt detallado para cada producto, copiar el resultado manualmente, revisar el formato, asegurarte de que los bullets tienen la estructura correcta... Para un producto está bien. Para 50 o 200 productos es inviable. ListWise automatiza exactamente ese flujo.",
    comparison: [
      { feature: "Generación automática desde CSV", listwise: true, competitor: false },
      { feature: "Conocimiento de reglas Amazon A9", listwise: "Integrado", competitor: "Solo con prompt muy detallado" },
      { feature: "Procesamiento en lotes", listwise: "Cientos en minutos", competitor: false },
      { feature: "Exportación lista para Seller Central", listwise: true, competitor: false },
      { feature: "Health Score automático", listwise: true, competitor: false },
      { feature: "Refinamiento sin escribir prompts", listwise: "Agente conversacional", competitor: "Requiere prompts manuales" },
      { feature: "Análisis de competencia por producto", listwise: true, competitor: false },
      { feature: "Soporte multi-marketplace", listwise: "Amazon, Etsy, Shopify, Wallapop", competitor: false },
      { feature: "Generación de código / texto libre", listwise: false, competitor: true },
      { feature: "Capacidades generales (análisis, redacción)", listwise: false, competitor: true },
      { feature: "Precio", listwise: "Gratis (20 créditos)", competitor: "Gratis (GPT-3.5) / 20 $/mes (GPT-4o)" },
    ],
    reasonsToChoose: [
      {
        title: "Escala sin esfuerzo manual",
        body: "La diferencia principal no es la calidad del texto — ambos producen buenos resultados. Es el flujo de trabajo. Con ListWise subes un CSV y obtienes 100 listings en 3 minutos. Con ChatGPT necesitas un prompt por producto, copiar y pegar cada resultado, y revisar el formato manualmente. Para más de 10 productos, ListWise es más rápido en órdenes de magnitud.",
      },
      {
        title: "Formato correcto sin configuración",
        body: "ListWise sabe automáticamente que el título de Amazon debe tener la keyword en las primeras 5 palabras, que los bullets no deben terminar en punto, que la descripción debe tener entre 150 y 400 palabras para el algoritmo A9. ChatGPT solo sabe esto si se lo explicas en cada prompt, y aun así puede ignorarlo.",
      },
      {
        title: "El Health Score como feedback instantáneo",
        body: "Después de generar cada listing, ListWise calcula automáticamente un Health Score de 0 a 100 que evalúa la longitud del título, la estructura de bullets, la riqueza de la descripción y la presencia de keywords. ChatGPT no tiene forma de evaluar la calidad del output sin que tú mismo lo analices.",
      },
      {
        title: "Cuándo usar ChatGPT",
        body: "Para un listing puntual con mucha información disponible y tiempo para iterar el prompt, ChatGPT con GPT-4o puede dar resultados excelentes. También es útil para tareas que ListWise no hace: análisis de reseñas, estrategia de precios, preparar presentaciones de producto. Son herramientas complementarias.",
      },
    ],
    verdict: "Para generar listings en escala, con el formato correcto y sin trabajo manual, ListWise es claramente superior a usar ChatGPT directamente. Para casos puntuales donde necesitas máxima flexibilidad, ChatGPT sigue siendo una opción válida como complemento.",
  },
];

export function getTool(slug: string): AlternativaTool | undefined {
  return tools.find((t) => t.slug === slug);
}
