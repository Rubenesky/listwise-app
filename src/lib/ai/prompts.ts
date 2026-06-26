export type GenerationMode = "creative" | "professional" | "seo";

export interface VoiceProfileData {
  tone: string;
  vocabulary: string;
  sentenceStructure: string;
  keyWords: string[];
  brandPersonality: string;
  suggestions: string[];
}

export const MODE_CONFIG: Record<GenerationMode, { label: string; systemPrompt: string; temperature: number }> = {
  creative: {
    label: "Creativo",
    systemPrompt: `<MODO>CREATIVO: Conecta emocionalmente con el comprador. Usa lenguaje vívido, sensorial y aspiracional. Activa el deseo describiendo la experiencia de uso: textura, sensación, transformación. El impacto emocional es prioritario sobre la descripción técnica.</MODO>`,
    temperature: 0.75,
  },
  professional: {
    label: "Profesional",
    systemPrompt: `<MODO>PROFESIONAL: Tono directo, claro y técnico. Destaca especificaciones, materiales y durabilidad con datos concretos. Lenguaje preciso para compradores racionales que comparan características antes de decidir. Sin hipérboles ni adjetivos vacíos.</MODO>`,
    temperature: 0.45,
  },
  seo: {
    label: "SEO",
    systemPrompt: `<MODO>SEO: Prioriza el posicionamiento en buscadores. La keyword principal va en los PRIMEROS 50 caracteres del título. Incluye variantes semánticas y sinónimos en la descripción de forma natural. Equilibra densidad de keywords con legibilidad real.</MODO>`,
    temperature: 0.6,
  },
};

export const SYSTEM_PROMPT = `
<PERSONA>
Eres un copywriter especialista en ecommerce con 15 años de experiencia creando listings de alta conversión para Amazon, Etsy, Shopify y tiendas online. Tu copy vende porque es específico, honesto y orientado al beneficio real del comprador. Evitas los clichés del sector ("alta calidad", "producto excepcional", "increíble") y usas detalles concretos que generan confianza y deseo.
</PERSONA>

<PRINCIPIOS>
1. BENEFICIO PRIMERO: Cada frase responde "¿qué gana el comprador?" antes que "¿qué hace el producto?".
2. ESPECÍFICO Y HONESTO: Solo menciona atributos que el producto realmente tiene. No inventes materiales, medidas ni características.
3. APERTURA VARIADA: Alterna entre cuatro tipos de inicio — pregunta retórica, declaración audaz, escena inmersiva, beneficio directo. Nunca empieces igual dos productos.
4. SENSORIAL: Para productos físicos (ropa, hogar, belleza), usa al menos un detalle sensorial (textura, peso, tacto, olor, sensación).
</PRINCIPIOS>

<REGLAS>
TÍTULO (60-80 caracteres, máximo 100):
- Estructura: [Nombre del producto] + [Atributo diferencial real] + [Beneficio principal]
- Modo SEO: keyword principal en los primeros 50 caracteres
- Incluye un atributo diferencial SOLO si el producto lo tiene (color, material, funcionalidad clave)
- Prohibido: adjetivos vacíos ("premium", "exclusivo", "increíble") sin respaldo de atributo concreto

BULLETS (4 a 6, según complejidad del producto):
- Formato A (benefit-first): "BENEFICIO EN MAYÚSCULAS: detalle específico que lo explica" — máximo 15 palabras
- Formato B (acción): "Verbo de beneficio + beneficio concreto + contexto de uso" — máximo 15 palabras
- Cada bullet = un beneficio distinto. Sin repeticiones. Sin relleno.
- Prioridad: el bullet más diferencial va primero.

DESCRIPCIÓN (2-3 párrafos cortos):
- Párrafo 1 — GANCHO: ¿Qué problema resuelve o qué deseo satisface? Respóndelo en 2-3 frases. Empieza con fuerza.
- Párrafo 2 — CONTEXTO DE USO: Quién lo usa, cuándo, por qué es la mejor opción. Menciona el uso más específico.
- Párrafo 3 — CIERRE: 1-2 frases que conecten con el CTA.
- Longitud: 90-130 palabras para productos simples; 140-200 para complejos (electrónica, textil técnico, herramientas).

CTA (elige el más apropiado para el producto — adapta el género gramatical):
- "Hazte con el tuyo hoy." (producto gramaticalmente masculino)
- "Hazte con la tuya hoy." (producto gramaticalmente femenino)
- "Pídelo hoy y recíbelo en casa." (conveniencia, compra impulsiva)
- "Dale a tu [mascota/bebé/familia] lo mejor hoy." (productos de cuidado)
- "Transforma tu [cocina/hogar/rutina] hoy." (hogar, belleza)
- "Llévalo a casa hoy." (electrónica, accesorios, herramientas)
- "El regalo perfecto. Pídelo hoy." (regalos, temporadas especiales)
</REGLAS>

<EJEMPLO>
Input: Producto: Sudadera con capucha oversized gris, Categoría: Ropa, Atributos: {material: "Algodón orgánico 100%", estilo: "oversized"}

Output:
{
  "title": "Sudadera Oversized de Algodón Orgánico | Comodidad Real",
  "title_b": "Sudadera Capucha Oversize 100% Algodón Orgánico - Suave y Holgada",
  "bullets": [
    "ALGODÓN ORGÁNICO 100%: sin químicos agresivos, suave desde el primer contacto con la piel",
    "CORTE OVERSIZED: libertad de movimiento total, estética relaxed que combina con cualquier look",
    "CAPUCHA AJUSTABLE: protección ante el frío sin sacrificar el estilo del día a día",
    "RESISTENTE AL LAVADO: mantiene forma y suavidad lavado tras lavado sin encogerse"
  ],
  "description": "Hay prendas que te pones y no quieres quitarte. Esta sudadera de algodón orgánico 100% es exactamente eso: suave al tacto, holgada sin perder la forma y cómoda desde el primer día.\n\nEl corte oversized la hace perfecta para el trabajo desde casa, una mañana tranquila o un día de compras. El tejido 100% orgánico garantiza que no hay tintes ni químicos agresivos contra tu piel. Ideal para quienes valoran la comodidad sin renunciar a un estilo limpio.\n\nHazte con la tuya hoy.",
  "primary_keyword": "sudadera oversized algodón orgánico"
}
</EJEMPLO>

Responde SIEMPRE con JSON válido exactamente en ese formato: title, title_b, bullets (array), description, primary_keyword. No añadas texto fuera del JSON. No uses markdown dentro del JSON.
`;

export function buildUserPrompt(product: {
  productName: string;
  category?: string | null;
  attributes?: Record<string, string> | null;
  mode?: GenerationMode;
}): string {
  const mode = product.mode && product.mode in MODE_CONFIG ? product.mode : "creative";
  const modeConfig = MODE_CONFIG[mode as GenerationMode];

  let prompt = `${modeConfig.systemPrompt}\n\n`;
  prompt += `Producto: ${product.productName}\n`;
  prompt += `Categoría: ${product.category || "General"}\n`;

  if (product.attributes && Object.keys(product.attributes).length > 0) {
    prompt += `Atributos conocidos del producto: ${JSON.stringify(product.attributes)}\n`;
  }

  // Category guides — keywords are SUGGESTIONS, not mandatory.
  // Only use a keyword if it genuinely describes this specific product.
  const categoryGuides: Record<string, string> = {
    "Ropa": "Keywords SUGERIDAS (solo si aplican al producto real): 'Algodón', 'Orgánico', 'Sostenible', 'Comodidad', 'Fit'. Si es oversized, incluye 'Oversized'. Si el material no es orgánico, NO uses 'orgánico'. Verbos: Viste, Brinda, Mantiene, Combina, Abraza.",
    "Moda": "Keywords SUGERIDAS (solo si aplican): 'Elegante', 'Versátil', 'Tendencia', 'Temporada'. No menciones materiales que el producto no tiene. Verbos: Viste, Eleva, Realza, Combina, Define.",
    "Electrónica": "Keywords SUGERIDAS (solo si aplican): 'Inalámbrico', 'Bluetooth', 'Batería larga duración', 'Compatible'. NO uses 'Cancelación de ruido' si el producto no tiene esa función. Verbos: Conecta, Disfruta, Escucha, Optimiza, Experimenta.",
    "Hogar": "Keywords SUGERIDAS (solo si aplican): 'Resistente', 'Fácil limpieza', 'Ahorro energético', 'Durable'. NO uses 'Cerámica' si el producto no es de cerámica. Verbos: Transforma, Organiza, Decora, Simplifica, Mejora.",
    "Cocina": "Keywords SUGERIDAS (solo si aplican): 'Antiadherente', 'Apto lavavajillas', 'Sin BPA', 'Cocción uniforme'. No menciones materiales que el producto no tiene. Verbos: Cocina, Prepara, Ahorra, Disfruta, Simplifica.",
    "Deportes": "Keywords SUGERIDAS (solo si aplican): 'Transpirable', 'Amortiguación', 'Soporte', 'Rendimiento', 'Ligero'. Verbos: Corre, Entrena, Mejora, Optimiza, Supera. IMPORTANTE: nunca uses marcas registradas de terceros (Nike, Adidas, Puma, etc.).",
    "Belleza": "Keywords SUGERIDAS (solo si aplican): 'Hidratación', 'Vegano', 'Sin parabenos', 'Dermatológicamente testado', 'Natural'. Solo menciona ingredientes que el producto contiene realmente. Verbos: Hidrata, Ilumina, Revitaliza, Nutre, Protege.",
    "Accesorios": "Keywords SUGERIDAS (solo si aplican): 'Resistente al agua', 'Compartimentos', 'Ajustable', 'Ligero'. Verbos: Organiza, Protege, Complementa, Lleva, Guarda.",
    "Iluminación": "Keywords SUGERIDAS (solo si aplican): 'LED', 'Bajo consumo', 'Regulable', 'Luz cálida', 'Luz fría'. Solo usa especificaciones reales. Verbos: Ilumina, Crea, Transforma, Ahorra, Ambienta.",
    "Juguetes": "Keywords SUGERIDAS (solo si aplican): 'Educativo', 'Sin BPA', 'Estimula la creatividad'. Verbos: Estimula, Educa, Entretiene, Desarrolla, Inspira.",
    "Oficina": "Keywords SUGERIDAS (solo si aplican): 'Ergonómico', 'Ajustable', 'Compacto', 'Antideslizante'. Verbos: Organiza, Mejora, Optimiza, Facilita, Reduce.",
    "Jardín": "Keywords SUGERIDAS (solo si aplican): 'Resistente a la intemperie', 'UV', 'Durable', 'Fácil montaje'. Verbos: Transforma, Decora, Cultiva, Disfruta, Embellece.",
    "Bebé": "Keywords SUGERIDAS (solo si aplican): 'Suave', 'Sin alérgenos', 'Certificado', 'Hipoalergénico'. SOLO usa 'orgánico' si está certificado. Verbos: Protege, Cuida, Calma, Estimula, Abraza.",
    "Mascotas": "Keywords SUGERIDAS (solo si aplican): 'Resistente', 'Seguro', 'Lavable', 'Duradero'. Verbos: Mima, Protege, Entretiene, Cuida, Mantiene.",
    "Automóvil": "Keywords SUGERIDAS (solo si aplican): 'Universal', 'Compatible', 'Fácil instalación', 'Resistente'. Verbos: Protege, Mejora, Organiza, Instala, Mantiene.",
    "POD": "Keywords SUGERIDAS: 'Personalizable', 'Único', 'Regalo original', 'Hecho a medida'. Verbos: Personaliza, Sorprende, Crea, Regala, Dedica.",
    "Salud": "Keywords SUGERIDAS (solo si aplican y están avaladas): 'Natural', 'Sin azúcar', 'Apto celíacos'. Evita afirmaciones de salud no respaldadas. Verbos: Cuida, Fortalece, Mejora, Equilibra, Apoya.",
    "Bienestar": "Keywords SUGERIDAS (solo si aplican): 'Relajante', 'Natural', 'Sin químicos', 'Aromaterapia'. Verbos: Relaja, Equilibra, Renueva, Calma, Restaura.",
    "Boda": "Keywords SUGERIDAS: 'Elegante', 'Memorable', 'Personalizable', 'Artesanal'. Verbos: Celebra, Decora, Sorprende, Crea, Recuerda.",
    "Navidad": "Keywords SUGERIDAS: 'Regalo', 'Edición especial', 'Navideño', 'Para toda la familia'. Verbos: Regala, Decora, Sorprende, Disfruta, Comparte.",
    "Deporte Extremo": "Keywords SUGERIDAS (solo si aplican): 'Alta resistencia', 'Ultraligero', 'Seguridad', 'Certificado CE'. Verbos: Escala, Desafía, Conquista, Protege, Rinde.",
  };

  const guide = categoryGuides[product.category || ""];
  if (guide) {
    prompt += `\nGuía de categoría (keywords SUGERIDAS — úsalas SOLO si describen este producto específico):\n${guide}`;
  } else {
    prompt += `\nGuía general: Usa verbos de beneficio en presente. Incluye el uso más específico del producto. Elige el CTA más apropiado del system prompt.`;
  }

  // Attribute-driven overrides — only when we have confirmed product data
  if (product.productName.toLowerCase().includes("oversized")) {
    prompt += `\n\nATENCIÓN: El producto es "oversized" — incluye esta palabra en el título y en al menos un bullet.`;
  }

  if (product.attributes) {
    const attrs = product.attributes;
    if (attrs["material"]) {
      prompt += `\n\nATENCIÓN: Material confirmado: "${attrs["material"]}" — menciónalo en título y úsalo como base para keywords. No uses keywords de materiales distintos.`;
    }
    if (attrs["talla"] && ["Ropa", "Moda", "Deportes", "Bebé"].includes(product.category || "")) {
      prompt += `\n\nATENCIÓN: Talla confirmada: "${attrs["talla"]}" — inclúyela en el título.`;
    }
    if (attrs["compatibilidad"] && ["Accesorios", "Automóvil", "Electrónica"].includes(product.category || "")) {
      prompt += `\n\nATENCIÓN: Compatibilidad confirmada: "${attrs["compatibilidad"]}" — inclúyela en el título.`;
    }
    if (attrs["diámetro"] && ["Hogar", "Cocina"].includes(product.category || "")) {
      prompt += `\n\nATENCIÓN: Diámetro confirmado: "${attrs["diámetro"]}" — inclúyelo en título o primer bullet.`;
    }
    if (attrs["capacidad"]) {
      prompt += `\n\nATENCIÓN: Capacidad confirmada: "${attrs["capacidad"]}" — inclúyela si es un diferencial relevante.`;
    }
  }

  prompt += `\n\nGenera el JSON con: title, title_b, bullets (array de 4-6), description (2-3 párrafos separados por \\n\\n), primary_keyword. Solo incluye atributos reales de este producto.`;
  return prompt;
}

export function buildUserPromptWithVoice(
  product: Parameters<typeof buildUserPrompt>[0],
  voiceProfile: VoiceProfileData | null
): string {
  const base = buildUserPrompt(product);
  if (!voiceProfile) return base;

  return (
    base +
    `\n\n<VOZ_DE_MARCA>
Adapta el copy a esta identidad de marca:
- Tono: ${voiceProfile.tone}
- Vocabulario: ${voiceProfile.vocabulary}
- Estructura de frases: ${voiceProfile.sentenceStructure}
- Personalidad de marca: ${voiceProfile.brandPersonality}
- Palabras clave de la marca: ${voiceProfile.keyWords.join(", ")}

Integra el vocabulario de marca de forma natural, sin que suene forzado.
</VOZ_DE_MARCA>`
  );
}
