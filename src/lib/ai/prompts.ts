export type GenerationMode = "creative" | "professional" | "seo";
export type Marketplace = "amazon" | "etsy" | "shopify" | "general";
export type PriceSegment = "economy" | "mid" | "premium";

export interface VoiceProfileData {
  tone: string;
  vocabulary: string;
  sentenceStructure: string;
  keyWords: string[];
  brandPersonality: string;
  suggestions: string[];
  antiPatterns?: string[];
  brandPromise?: string;
}

export const MODE_CONFIG: Record<GenerationMode, { label: string; systemPrompt: string; temperature: number }> = {
  creative: {
    label: "Creativo",
    systemPrompt: `<MODO>CREATIVO: Prioriza la conexión emocional y el lenguaje sensorial. Activa el deseo describiendo la experiencia de uso: textura, sensación, transformación. Usa Future Pacing y Contrast Frame cuando el producto los justifique.</MODO>`,
    temperature: 0.75,
  },
  professional: {
    label: "Profesional",
    systemPrompt: `<MODO>PROFESIONAL: Tono directo y técnico. Datos concretos, especificaciones reales, durabilidad verificable. Sin hipérboles. El comprador racional que compara especificaciones antes de decidir es tu audiencia.</MODO>`,
    temperature: 0.45,
  },
  seo: {
    label: "SEO",
    systemPrompt: `<MODO>SEO: La primary_keyword va en los primeros 40 caracteres del título — primera prioridad absoluta. Incluye 1 sinónimo semántico de la keyword en el primer párrafo de la descripción. Incluye una frase long-tail de 3-5 palabras exactamente como la escribiría un comprador en el buscador antes de comprar.</MODO>`,
    temperature: 0.6,
  },
};

// Concise calibration example per category — injected dynamically to eliminate anchoring to one fixed example
const CATEGORY_CALIBRATION: Record<string, { title: string; hook: string; bullet: string }> = {
  "Ropa": {
    title: "Sudadera Oversized Algodón Orgánico 100% | Sin Costuras Laterales",
    hook: "Hay prendas que te pones y decides que el resto del armario sobra.",
    bullet: "ALGODÓN ORGÁNICO CERTIFICADO: sin químicos en contacto con tu piel desde el primer día",
  },
  "Electrónica": {
    title: "Auriculares Inalámbricos 40h Batería | Sonido Envolvente sin Cable",
    hook: "Cuarenta horas. La batería que no te da sustos en mitad de la semana.",
    bullet: "40H DE AUTONOMÍA REAL: carga completa el domingo, aguanta hasta el viernes sin enchufar",
  },
  "Cocina": {
    title: "Sartén Antiadherente 28cm Sin PFOA | Cocción Uniforme en Toda la Base",
    hook: "El problema no es cocinar. Es limpiar después.",
    bullet: "SIN PFOA NI PFAS: superficie libre de químicos tóxicos, segura a alta temperatura",
  },
  "Hogar": {
    title: "Organizador Escritorio Bambú Natural | 5 Compartimentos Ajustables",
    hook: "Tres minutos. El tiempo que tardas en transformar un escritorio caótico en uno que da ganas de trabajar.",
    bullet: "BAMBÚ NATURAL: resistente y ligero, no se dobla con el peso de carpetas o libros",
  },
  "Deportes": {
    title: "Zapatillas Trail Running Suela Vibram | Agarre Extremo en Cualquier Terreno",
    hook: "No todas las zapatillas de trail aguantan el barro, la roca y el asfalto. Estas sí.",
    bullet: "SUELA VIBRAM MULTITERRENO: grip profesional sin cambiar de calzado según el terreno",
  },
  "Belleza": {
    title: "Sérum Vitamina C 20% Estabilizada | Antimanchas con Resultados desde Semana 2",
    hook: "¿Cuántos productos llevas probando para las manchas sin ver resultado real?",
    bullet: "VITAMINA C 20% ESTABILIZADA: máxima concentración sin irritación, apta para piel sensible",
  },
  "Mascotas": {
    title: "Cama Ortopédica Perro Viscoelástica | Lavable a Máquina - Todas las Razas",
    hook: "Tu perro pasa 14 horas al día durmiendo. Merece algo mejor que el suelo.",
    bullet: "VISCOELÁSTICA ORTOPÉDICA: distribuye el peso uniformemente, alivia articulaciones y caderas",
  },
  "Bebé": {
    title: "Portabebés Ergonómico Algodón Orgánico | Posición Fisiológica desde 3,5kg",
    hook: "Dos manos libres. Bebé tranquilo. El equilibrio que buscabas desde el primer día.",
    bullet: "POSICIÓN FISIOLÓGICA CERTIFICADA: rodillas más altas que las caderas, columna en C natural",
  },
  "Accesorios": {
    title: "Mochila Impermeable 30L Unisex | Compartimento Laptop 15\" Acolchado",
    hook: "Llueve. Tu mochila dice que no importa.",
    bullet: "IMPERMEABLE TOTAL: costuras selladas y cremalleras con cubierta, interior seco garantizado",
  },
  "Oficina": {
    title: "Soporte Monitor Ergonómico Ajustable 360° | Libera 40cm de Escritorio",
    hook: "El cuello lleva aguantando horas de pantalla. Esto lo nota desde el primer día.",
    bullet: "AJUSTE TOTAL EN 3 EJES: altura, inclinación y rotación sin soltar herramientas",
  },
};

// Emotional archetype by category — guides the emotional hook in paragraph 1
const EMOTIONAL_ARCHETYPE: Record<string, string> = {
  "Ropa":            "IDENTIDAD Y PERTENENCIA: el comprador decide quién ES cuando lleva esto",
  "Moda":            "IDENTIDAD Y ESTATUS: cómo se VE y cómo lo VEN los demás",
  "Deportes":        "LOGRO Y CONTROL: qué PUEDE HACER con esto que antes no podía",
  "Deporte Extremo": "DESAFÍO Y VALENTÍA: empujar los propios límites con el equipo adecuado",
  "Electrónica":     "EFICIENCIA Y MODERNIDAD: tiempo y esfuerzo que recupera cada día",
  "Cocina":          "ORGULLO DOMÉSTICO Y PLACER: el resultado que sorprende a los que comen contigo",
  "Hogar":           "CONFORT Y CONTROL: el espacio donde vives refleja quién eres",
  "Iluminación":     "ATMÓSFERA Y BIENESTAR: cómo cambia el ambiente y el estado de ánimo",
  "Belleza":         "AUTOCONFIANZA: cómo te VES y te SIENTES contigo mismo/a",
  "Bienestar":       "PAZ Y EQUILIBRIO: pausa real en un mundo que no para",
  "Salud":           "CUIDADO Y PREVENCIÓN: invertir hoy para estar mejor mañana",
  "Bebé":            "PROTECCIÓN Y AMOR: lo mejor para quien más quieres",
  "Mascotas":        "AMOR Y CULPA ALIVIADA: tu mascota lo merece, y tú lo sabes",
  "Accesorios":      "PRACTICIDAD Y ESTILO: funcional sin sacrificar la estética",
  "Oficina":         "PRODUCTIVIDAD Y ORDEN: el entorno que te permite rendir al máximo",
  "Jardín":          "ORGULLO Y DISFRUTE: el espacio exterior que da envidia a los vecinos",
  "Juguetes":        "DESARROLLO Y ALEGRÍA: ver crecer y sonreír a tu hijo",
  "Automóvil":       "CONTROL Y SEGURIDAD: tu coche bien cuidado, tú tranquilo",
  "POD":             "SINGULARIDAD Y CONEXIÓN EMOCIONAL: algo que solo existe porque tú lo creaste",
  "Boda":            "PERFECCIÓN Y MEMORIA: que ese día sea exactamente como lo imaginaste",
  "Navidad":         "ALEGRÍA Y GENEROSIDAD: el momento en que el regalo llega justo",
};

const PRICE_SEGMENT_GUIDE: Record<PriceSegment, string> = {
  economy: "Tono: práctico y directo. El comprador busca la mejor relación calidad-precio. Énfasis en durabilidad, funcionalidad y valor. Evita lenguaje aspiracional excesivo — sería incongruente con el precio.",
  mid:     "Tono: cálido y seguro. El comprador quiere calidad real sin pagar de más. Equilibra beneficio emocional y especificaciones técnicas. Lenguaje accesible pero con criterio.",
  premium: "Tono: experiencial y aspiracional. El comprador sabe lo que quiere y el precio no es el primer filtro. Énfasis en materialidad, craftsmanship y experiencia total. Lenguaje sensorial rico.",
};

const MARKETPLACE_GUIDE: Record<Marketplace, string> = {
  amazon:  "Amazon — título hasta 150 chars con keyword principal en los primeros 40 chars. Bullets con especificaciones técnicas primero. El comprador compara fichas técnicas.",
  etsy:    "Etsy — título ≤70 chars, natural y descriptivo (el algoritmo favorece títulos que suenan como búsquedas reales). Bullets narrativos. El comprador valora historia y autenticidad.",
  shopify: "Shopify — título ≤80 chars orientado a lifestyle y marca. Bullets de beneficio puro, menos técnicos. El comprador viene de un anuncio o referencia de marca.",
  general: "Marketplace general — título 60-80 chars equilibrando keyword y beneficio.",
};

export const SYSTEM_PROMPT = `
<PERSONA>
Eres un copywriter especialista en ecommerce con 15 años de experiencia creando listings de alta conversión para Amazon, Etsy y Shopify. Tu voz es directa y cercana — como el mejor dependiente de una tienda especializada: conoces el producto a fondo, eres entusiasta pero nunca exagerado, y siempre dices la verdad aunque eso signifique reconocer para quién es ideal y para quién no.
</PERSONA>

<PROCESO_ANTES_DE_ESCRIBIR>
Razona internamente estas 4 preguntas ANTES de escribir el JSON. NO las incluyas en la respuesta:
1. ¿Cuál es el ÚNICO beneficio más diferencial de este producto que sus alternativas no tienen? Todo el copy girará en torno a ese beneficio — es el hilo conductor de todo.
2. ¿Qué emoción concreta guía la decisión de compra? (identidad / logro / protección / comodidad / eficiencia / estatus)
3. ¿Cuál es la primera frase perfecta — máximo 12 palabras — que detiene el scroll de alguien que ya vio 5 productos similares de esta categoría?
4. ¿Hay algún trademark de tercero o atributo no confirmado en los inputs? → Eliminarlo antes de escribir.
</PROCESO_ANTES_DE_ESCRIBIR>

<REGLAS>
TÍTULO — entre 50 y 80 caracteres, máximo 100. Nunca menos de 50:
- Estructura: [Nombre del producto] + [Atributo diferencial real] + [Beneficio principal]
- Solo adjetivos con respaldo concreto: "de lana merina 100%" no "suave"; "40h de batería" no "batería duradera"
- El título diferencia, no solo describe. El comprador está comparando opciones.
- Si los atributos son escasos, añade el público objetivo o el contexto de uso para llegar a 50 chars: "para Perro Grande | Descanso Ortopédico".

BULLETS — SIEMPRE entre 4 y 6. Nunca menos de 4:
- Formato A: "BENEFICIO EN MAYÚSCULAS: detalle específico que lo explica" — máximo 15 palabras
- Formato B: "Verbo de beneficio + beneficio concreto + contexto de uso" — máximo 15 palabras
- El bullet más diferencial va PRIMERO. Cada bullet pasa el so-what test: si la respuesta obvia es "¿y qué?", reescríbelo con más especificidad.
- Sin relleno. Sin repetir el mismo beneficio con otras palabras entre bullets.
- Si los atributos no alcanzan para 4 bullets distintos, añade: (a) el contexto de uso ideal, (b) para quién es ideal y para quién no, o (c) la consecuencia emocional del beneficio principal.

DESCRIPCIÓN (2 a 3 párrafos):
PÁRRAFO 1 — GANCHO:
  Primera frase: máximo 12 palabras.
  PROHIBIDO empezar con: "Este", "Presentamos", "Descubre", "El/La [nombre del producto]" o el nombre repetido.
  Elige el tipo de apertura según la emoción de compra:
  - Escena inmersiva:  "Son las 7 de la mañana y [situación vivida por el comprador]."
  - Pregunta retórica: "¿Cuántas veces has buscado [X] sin encontrar exactamente eso?"
  - Declaración audaz: "Esto no es otra [cliché de la categoría]. Y lo notas desde el primer uso."
  - Beneficio directo: "[Dato o número concreto] que cambia [rutina específica del comprador]."
  La primera PALABRA activa el estado mental: "Imagina"→fantasía; "¿Cuántas"→problema; verbo imperativo suave→identidad.
  IMPORTANTE: NO uses siempre "Imagina" como primera palabra. Elige el tipo de apertura según la emoción de compra del producto — varía entre los 4 tipos. "Imagina" es solo uno de ellos.

PÁRRAFO 2 — CONTEXTO DE USO:
  UN caso de uso específico y vivido — no tres contextos genéricos. Quién lo usa, cuándo, qué experimenta. Incluye al menos un detalle sensorial (textura, peso, sonido, olor, sensación). Si el producto tiene un contexto de uso óptimo relevante, menciónalo de forma positiva ("funciona mejor cuando...", "ideal si buscas...") — previene devoluciones y genera confianza.

PÁRRAFO 3 — CIERRE:
  Una frase que activa la consecuencia emocional: "el resultado es...", "lo que notas desde el primer día...", "sin tener que...". Seguida del CTA.

CTA: Genera uno personalizado para ESTE producto (5-10 palabras). Inspírate en estas estructuras pero crea uno propio si el producto lo justifica:
  "Hazte con el/la tuyo/a hoy." | "Pídelo hoy y recíbelo en casa." | "Dale a tu [X] lo mejor hoy." | "Transforma tu [X] hoy."
  El CTA perfecto solo funciona para ESTE producto, no para cualquier otro de la categoría.

TÉCNICAS DE ALTO IMPACTO (úsalas cuando el producto las justifica):
  FUTURE PACING: "El próximo [lunes/verano/viaje]..." — lleva al comprador a un momento futuro donde ya tiene el producto.
  CONTRAST FRAME: "No es [cliché de la categoría]. Es [beneficio único concreto]."
  RITMO: alterna frase corta (5-8 palabras) con frase media (12-16 palabras). La última frase de cada párrafo debe ser la más corta.

REGISTRO: Conversacional pero competente. Como hablarle de tú a tú a alguien comparando opciones — sin venderle la moto, señalando lo que necesita saber y sentir para decidir.
COMPRADOR: En fase de comparación. El copy responde implícitamente a "¿por qué este y no otro?". Asume que ha visto 5 descripciones genéricas de esta categoría antes de llegar a esta.
</REGLAS>

<AUTOVERIFICACION>
ANTES DE ESCRIBIR EL JSON, verifica internamente — NO lo incluyas en la respuesta:
1. ¿Hay trademark de tercero (Nike, Apple, IKEA, Zara, Samsung, etc.)? → Elimínalo.
2. ¿El título tiene más de 100 chars? → Acórtalo.
3. ¿Algún bullet tiene más de 15 palabras? → Acórtalo.
4. ¿Has mencionado algún atributo no confirmado en los inputs? → Elimínalo.
5. ¿El gancho detiene el scroll de alguien que ya vio 5 productos similares? Si no → Reescríbelo.
6. ¿Cada bullet añade algo único que los otros no dicen? Si no → Elimina el redundante.
7. ¿El CTA funcionaría para cualquier producto de esta categoría? Si sí → Personalízalo.
</AUTOVERIFICACION>

Responde SIEMPRE con JSON válido exactamente con estos campos. Nada de texto fuera del JSON:
{"title":"...","title_b":"Estrategia OPUESTA a title: si title es benefit-lead entonces title_b es keyword-lead; si title es emocional entonces title_b es técnico y específico","bullets":["..."],"description":"párrafo1\\n\\npárrafo2\\n\\npárrafo3","primary_keyword":"2-4 palabras como las escribiría el comprador en el buscador","target_audience":"2-3 palabras describiendo el comprador ideal","hook_type":"scene|question|bold|benefit","quality_flags":{"no_trademarks":true,"title_in_range":true,"bullets_concise":true,"attrs_real":true,"hook_differentiated":true}}
`;

export function buildUserPrompt(product: {
  productName: string;
  category?: string | null;
  attributes?: Record<string, string> | null;
  mode?: GenerationMode;
  marketplace?: Marketplace;
  priceSegment?: PriceSegment;
}): string {
  const mode = product.mode && product.mode in MODE_CONFIG ? product.mode : "creative";
  const modeConfig = MODE_CONFIG[mode as GenerationMode];
  const category = product.category || "General";

  let prompt = `${modeConfig.systemPrompt}\n\n`;
  prompt += `Producto: ${product.productName}\n`;
  prompt += `Categoría: ${category}\n`;

  if (product.attributes && Object.keys(product.attributes).length > 0) {
    prompt += `Atributos confirmados: ${JSON.stringify(product.attributes)}\n`;
    prompt += `IMPORTANTE: usa SOLO estos atributos. No inventes materiales, medidas ni características adicionales.\n`;
  } else {
    prompt += `Sin atributos específicos — genera copy honesto basado solo en el nombre y categoría. No inventes especificaciones.\n`;
  }

  // Marketplace guidance
  prompt += `\nMarketplace destino: ${MARKETPLACE_GUIDE[product.marketplace ?? "general"]}\n`;

  // Price segment
  if (product.priceSegment) {
    prompt += `Segmento de precio: ${PRICE_SEGMENT_GUIDE[product.priceSegment]}\n`;
  }

  // Emotional archetype
  const archetype = EMOTIONAL_ARCHETYPE[category];
  if (archetype) {
    prompt += `Emoción de compra dominante: ${archetype}\n`;
  }

  // Dynamic calibration example for this category
  const cal = CATEGORY_CALIBRATION[category];
  if (cal) {
    prompt += `
Calibración de tono para ${category} (referencia — NO copies, adapta al producto real):
  Título modelo:  "${cal.title}"
  Gancho modelo:  "${cal.hook}"
  Bullet modelo:  "${cal.bullet}"
`;
  }

  // Category keyword suggestions — conditional, not mandatory
  const categoryGuides: Record<string, string> = {
    "Ropa":            "Keywords SUGERIDAS (solo si aplican): Algodón, Oversized, Orgánico, Sostenible. Si el material no es orgánico, NO uses orgánico. Nunca trademarks de marca.",
    "Moda":            "Keywords SUGERIDAS (solo si aplican): Versátil, Tendencia, Elegante. No mezcles materiales que el producto no tiene.",
    "Electrónica":     "Keywords SUGERIDAS (solo si aplican): Inalámbrico, Bluetooth, Batería, Compatible. NO uses Cancelación de ruido si el producto no tiene esa función.",
    "Hogar":           "Keywords SUGERIDAS (solo si aplican): Resistente, Fácil limpieza, Durable. NO uses Cerámica si el producto no es de cerámica.",
    "Cocina":          "Keywords SUGERIDAS (solo si aplican): Antiadherente, Sin BPA, Apto lavavajillas. No menciones materiales que el producto no tiene.",
    "Deportes":        "Keywords SUGERIDAS (solo si aplican): Transpirable, Amortiguación, Soporte. NUNCA marcas de terceros (Nike, Adidas, Asics, etc.).",
    "Belleza":         "Keywords SUGERIDAS (solo si aplican): Hidratación, Vegano, Sin parabenos, Natural. Solo ingredientes que el producto contiene realmente.",
    "Accesorios":      "Keywords SUGERIDAS (solo si aplican): Resistente al agua, Ajustable, Ligero.",
    "Bebé":            "Keywords SUGERIDAS (solo si aplican): Suave, Hipoalergénico, Certificado. SOLO orgánico si está certificado.",
    "Mascotas":        "Keywords SUGERIDAS (solo si aplican): Resistente, Seguro, Lavable, Duradero.",
    "Oficina":         "Keywords SUGERIDAS (solo si aplican): Ergonómico, Ajustable, Compacto.",
    "Iluminación":     "Keywords SUGERIDAS (solo si aplican): LED, Bajo consumo, Regulable.",
    "Juguetes":        "Keywords SUGERIDAS (solo si aplican): Educativo, Sin BPA, Estimula creatividad.",
    "Jardín":          "Keywords SUGERIDAS (solo si aplican): Resistente intemperie, UV, Durable.",
    "Automóvil":       "Keywords SUGERIDAS (solo si aplican): Universal, Compatible, Fácil instalación.",
    "POD":             "Keywords: Personalizable, Único, Regalo original. El título describe el DISEÑO, no el material.",
    "Salud":           "Keywords SUGERIDAS (solo si aplican y avaladas): Natural, Sin azúcar. Evita afirmaciones de salud no respaldadas.",
    "Bienestar":       "Keywords SUGERIDAS (solo si aplican): Relajante, Natural, Sin químicos, Aromaterapia.",
    "Boda":            "Keywords: Elegante, Memorable, Personalizable, Artesanal.",
    "Navidad":         "Keywords: Regalo, Edición especial, Navideño. No uses urgencia estacional fuera de temporada.",
    "Deporte Extremo": "Keywords SUGERIDAS (solo si aplican): Alta resistencia, Ultraligero, Certificado CE. NUNCA marcas de terceros.",
  };

  const guide = categoryGuides[category];
  if (guide) {
    prompt += `Keywords para ${category} (SUGERIDAS — úsalas SOLO si describen este producto específico):\n${guide}\n`;
  }

  // Confirmed attribute overrides
  if (product.attributes) {
    const a = product.attributes;
    if (a["material"]) prompt += `\nMaterial CONFIRMADO: "${a["material"]}" — menciónalo en título. No uses keywords de otros materiales.\n`;
    if (a["talla"] && ["Ropa", "Moda", "Deportes", "Bebé"].includes(category)) prompt += `Talla CONFIRMADA: "${a["talla"]}" — en el título.\n`;
    if (a["compatibilidad"] && ["Accesorios", "Automóvil", "Electrónica"].includes(category)) prompt += `Compatibilidad CONFIRMADA: "${a["compatibilidad"]}" — en el título.\n`;
    if (a["capacidad"]) prompt += `Capacidad CONFIRMADA: "${a["capacidad"]}" — inclúyela si es diferencial relevante.\n`;
    if (a["diámetro"] && ["Hogar", "Cocina"].includes(category)) prompt += `Diámetro CONFIRMADO: "${a["diámetro"]}" — en título o primer bullet.\n`;
  }

  if (product.productName.toLowerCase().includes("oversized")) {
    prompt += `\nEl producto es "oversized" — incluye esta palabra en el título y en al menos un bullet.\n`;
  }

  prompt += `\nEscribe el JSON completo. El hilo conductor: el ÚNICO beneficio diferencial que ninguna alternativa tiene — específico y real.`;
  return prompt;
}

export function buildUserPromptWithVoice(
  product: Parameters<typeof buildUserPrompt>[0],
  voiceProfile: VoiceProfileData | null
): string {
  const base = buildUserPrompt(product);
  if (!voiceProfile) return base;

  let voice = `\n\n<VOZ_DE_MARCA>
Adapta TODO el copy a esta identidad — tono, estructura y vocabulario:
- Tono: ${voiceProfile.tone}
- Vocabulario: ${voiceProfile.vocabulary}
- Estructura de frases: ${voiceProfile.sentenceStructure}
- Personalidad: ${voiceProfile.brandPersonality}
- Palabras clave de marca: ${voiceProfile.keyWords.join(", ")}`;

  if (voiceProfile.brandPromise) {
    voice += `\n- Promesa de marca (cada pieza debe reflejarla): ${voiceProfile.brandPromise}`;
  }
  if (voiceProfile.antiPatterns?.length) {
    voice += `\n- NUNCA en este copy: ${voiceProfile.antiPatterns.join(", ")}`;
  }

  voice += `
Adapta también la ESTRUCTURA según la personalidad: marcas técnicas → más bullets, menos narrativa; marcas emocionales → párrafo narrativo expandido, bullets cortos; marcas jóvenes/irreverentes → gancho más audaz, CTA con personalidad propia.
</VOZ_DE_MARCA>`;

  return base + voice;
}
