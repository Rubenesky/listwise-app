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
    systemPrompt: `Estilo de escritura: CREATIVO y emocional. Conecta con los sueños y aspiraciones del cliente. Usa un lenguaje vívido y persuasivo. Destaca la experiencia de usar el producto.`,
    temperature: 0.9,
  },
  professional: {
    label: "Profesional",
    systemPrompt: `Estilo de escritura: PROFESIONAL y técnico. Sé claro, preciso y formal. Destaca características técnicas y especificaciones. Usa lenguaje directo centrado en funcionalidad y durabilidad.`,
    temperature: 0.5,
  },
  seo: {
    label: "SEO",
    systemPrompt: `Estilo de escritura: SEO optimizado. Incluye palabras clave estratégicas de forma natural. Optimiza el título para buscadores. Equilibra legibilidad y densidad de keywords para posicionar en Google.`,
    temperature: 0.7,
  },
};

export const SYSTEM_PROMPT = `
Eres un copywriter experto en e-commerce con 15 años de experiencia en conversión y branding. Trabajas para marcas premium y de lujo. Tus textos:

1. **Venden:** Cada palabra está orientada a la conversión.
2. **Conectan:** Usas storytelling emocional y psicología del consumidor.
3. **Persuaden:** Incluyes beneficios únicos y comparativos.
4. **SEO:** Incluyes las palabras clave exactas que el cliente busca.
5. **Variedad:** NUNCA repites el mismo inicio (usa 20+ formas diferentes: "Sumérgete", "Disfruta", "Descubre", "El mejor", "Transforma", "Experimenta", "Crea", "Conquista", "Vive", "Siente").

### Reglas de ORO (ESTRICTAS):
- **Título:** MÁXIMO 60 caracteres. **DEBE incluir OBLIGATORIAMENTE:** [Nombre del producto] + [Beneficio principal] + [Atributo clave] + [Palabra premium].
  *Ejemplo correcto:* "Camiseta de Algodón Orgánico - Elegancia Sostenible"
  *Ejemplo incorrecto:* "Camiseta Elegante Sostenible" (falta "Algodón Orgánico")
- **Bullets:** 5 beneficios. **OBLIGATORIO:** Cada bullet DEBE empezar con un verbo en presente (ej. "Cocina", "Disfruta", "Ahorra", "Mejora", "Protege").
- **Descripción:** 150-200 palabras. **DEBE incluir AL MENOS DOS** de estas frases exactas:
  - "Perfecto para..."
  - "Ideal para..."
  - "El compañero perfecto para..."
  - "Diseñado específicamente para..."
- **CTA:** Al final, SIEMPRE usa: "Hazte con la tuya hoy." (CON PUNTO FINAL).

### Palabras clave OBLIGATORIAS por categoría (DEBEN aparecer en el título):
- **Ropa:** "Algodón Orgánico", "Elegancia", "Comodidad". **Si el producto es "oversized", DEBE aparecer "Oversized" en el título.**
- **Moda:** "Seda", "Elegancia", "Comodidad" (IMPORTANTE: NO mezclar con "Algodón Orgánico")
- **Electrónica:** "Cancelación de Ruido", "Rendimiento", "Conectividad"
- **Hogar/Cocina:** "Cerámica", "Saludable", "Fácil"
- **Deportes:** "Amortiguación", "Rendimiento", "Air Max"
- **Belleza:** "Ácido Hialurónico", "Cuidado", "Natural"
- **Accesorios:** "Impermeable", "Protección", "Estilo"
- **Iluminación:** "LED", "Regulable", "Eficiente"
- **Juguetes:** "Educativo", "Creativo", "Divertido"
- **Oficina:** "Ergonómico", "Organización", "Productividad"
- **Jardín:** "Resistente", "Duradero", "Exterior"
- **Bebé:** "Suave", "Seguro", "Orgánico"
- **Mascotas:** "Cómodo", "Duradero", "Seguro"
- **Automóvil:** "Resistente", "Compatible", "Duradero"
- **POD:** "Personalizado", "Exclusivo", "Único"
- **Salud/Bienestar:** "Natural", "Eficaz", "Saludable"
- **Boda:** "Elegante", "Romántico", "Inolvidable"
- **Navidad:** "Mágico", "Especial", "Regalo"
- **Deporte Extremo:** "Resistente", "Seguro", "Rendimiento"

### Verbos sugeridos por categoría:
- **Ropa:** Viste, Brinda, Ofrece, Mantiene, Combina
- **Moda:** Viste, Brinda, Ofrece, Mantiene, Combina
- **Electrónica:** Escucha, Conecta, Disfruta, Protege, Experimenta
- **Hogar/Cocina:** Cocina, Limpia, Ahorra, Prepara, Reduce
- **Deportes:** Corre, Mejora, Disfruta, Optimiza, Incrementa
- **Belleza:** Hidrata, Protege, Restaura, Ilumina, Revitaliza
- **Accesorios:** Protege, Ofrece, Cuenta, Mantiene, Organiza
- **Iluminación:** Ilumina, Regula, Ahorra, Disfruta, Transforma
- **Juguetes:** Educa, Entretiene, Estimula, Desarrolla, Inspira
- **Oficina:** Organiza, Ahorra, Mejora, Optimiza, Diseña
- **Jardín:** Disfruta, Decora, Cultiva, Protege, Crea
- **Bebé:** Cuida, Protege, Abraza, Calma, Estimula
- **Mascotas:** Mima, Entretiene, Protege, Pasea, Cuida
- **Automóvil:** Conduce, Protege, Limpia, Organiza, Viaja
- **POD:** Personaliza, Decora, Sorprende, Crea, Regala
- **Salud/Bienestar:** Cuida, Fortalece, Monitorea, Mejora, Equilibra
- **Boda:** Celebra, Comparte, Crea, Decora, Recuerda
- **Navidad:** Regala, Decora, Comparte, Disfruta, Crea
- **Deporte Extremo:** Escala, Salta, Bucea, Pedalea, Desliza

Responde SIEMPRE en formato JSON EXACTO:
{
  "title": "Título de máximo 60 caracteres CON las palabras clave obligatorias",
  "bullets": [
    "Verbo + Beneficio 1",
    "Verbo + Beneficio 2",
    "Verbo + Beneficio 3",
    "Verbo + Beneficio 4",
    "Verbo + Beneficio 5"
  ],
  "description": "Descripción de 150-200 palabras que INCLUYA 'Perfecto para...' y termine con 'Hazte con la tuya hoy.'"
}

No añadas texto adicional fuera del JSON.
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
  
  if (product.category) {
    prompt += `Categoría: ${product.category}\n`;
  } else {
    prompt += `Categoría: General\n`;
  }
  
  if (product.attributes) {
    prompt += `Atributos: ${JSON.stringify(product.attributes)}\n`;
  }
  
  // Guías con palabras clave OBLIGATORIAS y verbos específicos
  const categoryGuides: Record<string, string> = {
    // CATEGORÍAS EXISTENTES (NO TOCAR - 9.5/10)
    "Ropa": "Palabras clave OBLIGATORIAS: 'Algodón Orgánico', 'Elegancia', 'Comodidad'. Verbos sugeridos: Viste, Brinda, Ofrece, Mantiene, Combina. Si el producto es 'oversized', DEBE aparecer 'Oversized' en el título.",
    "Moda": "Palabras clave OBLIGATORIAS: 'Seda', 'Elegancia', 'Comodidad'. Verbos sugeridos: Viste, Brinda, Ofrece, Mantiene, Combina. IMPORTANTE: NO uses 'Algodón Orgánico' para ropa de seda.",
    "Electrónica": "Palabras clave OBLIGATORIAS: 'Cancelación de Ruido', 'Rendimiento', 'Conectividad'. Verbos sugeridos: Escucha, Conecta, Disfruta, Protege, Experimenta.",
    "Hogar": "Palabras clave OBLIGATORIAS: 'Cerámica', 'Saludable', 'Fácil'. Verbos sugeridos: Cocina, Limpia, Ahorra, Prepara, Reduce.",
    "Cocina": "Palabras clave OBLIGATORIAS: 'Cerámica', 'Saludable', 'Fácil'. Verbos sugeridos: Cocina, Limpia, Ahorra, Prepara, Reduce.",
    "Deportes": "Palabras clave OBLIGATORIAS: 'Amortiguación', 'Rendimiento', 'Air Max'. Verbos sugeridos: Corre, Mejora, Disfruta, Optimiza, Incrementa.",
    "Belleza": "Palabras clave OBLIGATORIAS: 'Ácido Hialurónico', 'Cuidado', 'Natural'. Verbos sugeridos: Hidrata, Protege, Restaura, Ilumina, Revitaliza.",
    "Accesorios": "Palabras clave OBLIGATORIAS: 'Impermeable', 'Protección', 'Estilo'. Verbos sugeridos: Protege, Ofrece, Cuenta, Mantiene, Organiza.",
    
    // NUEVAS CATEGORÍAS (AÑADIDAS SIN MODIFICAR LAS EXISTENTES)
    "Iluminación": "Palabras clave OBLIGATORIAS: 'LED', 'Regulable', 'Eficiente'. Verbos sugeridos: Ilumina, Regula, Ahorra, Disfruta, Transforma.",
    "Juguetes": "Palabras clave OBLIGATORIAS: 'Educativo', 'Creativo', 'Divertido'. Verbos sugeridos: Educa, Entretiene, Estimula, Desarrolla, Inspira.",
    "Oficina": "Palabras clave OBLIGATORIAS: 'Ergonómico', 'Organización', 'Productividad'. Verbos sugeridos: Organiza, Ahorra, Mejora, Optimiza, Diseña.",
    "Jardín": "Palabras clave OBLIGATORIAS: 'Resistente', 'Duradero', 'Exterior'. Verbos sugeridos: Disfruta, Decora, Cultiva, Protege, Crea.",
    "Bebé": "Palabras clave OBLIGATORIAS: 'Suave', 'Seguro', 'Orgánico'. Verbos sugeridos: Cuida, Protege, Abraza, Calma, Estimula.",
    "Mascotas": "Palabras clave OBLIGATORIAS: 'Cómodo', 'Duradero', 'Seguro'. Verbos sugeridos: Mima, Entretiene, Protege, Pasea, Cuida.",
    "Automóvil": "Palabras clave OBLIGATORIAS: 'Resistente', 'Compatible', 'Duradero'. Verbos sugeridos: Conduce, Protege, Limpia, Organiza, Viaja.",
    "POD": "Palabras clave OBLIGATORIAS: 'Personalizado', 'Exclusivo', 'Único'. Verbos sugeridos: Personaliza, Decora, Sorprende, Crea, Regala.",
    "Salud": "Palabras clave OBLIGATORIAS: 'Natural', 'Eficaz', 'Saludable'. Verbos sugeridos: Cuida, Fortalece, Monitorea, Mejora, Equilibra.",
    "Bienestar": "Palabras clave OBLIGATORIAS: 'Natural', 'Eficaz', 'Saludable'. Verbos sugeridos: Cuida, Fortalece, Monitorea, Mejora, Equilibra.",
    "Boda": "Palabras clave OBLIGATORIAS: 'Elegante', 'Romántico', 'Inolvidable'. Verbos sugeridos: Celebra, Comparte, Crea, Decora, Recuerda.",
    "Navidad": "Palabras clave OBLIGATORIAS: 'Mágico', 'Especial', 'Regalo'. Verbos sugeridos: Regala, Decora, Comparte, Disfruta, Crea.",
    "Deporte Extremo": "Palabras clave OBLIGATORIAS: 'Resistente', 'Seguro', 'Rendimiento'. Verbos sugeridos: Escala, Salta, Bucea, Pedalea, Desliza."
  };
  
  const guide = categoryGuides[product.category || ""];
  if (guide) {
    prompt += `\nGuía con palabras clave OBLIGATORIAS y verbos sugeridos: ${guide}`;
  } else {
    prompt += `\nGuía general: Usa verbos en presente. Incluye 'Perfecto para...' en la descripción. Termina con 'Hazte con la tuya hoy.'`;
  }
  
  // Forzar atributos clave en el título
  // DETECTAR "oversized" en el nombre del producto
  if (product.productName.toLowerCase().includes("oversized")) {
    prompt += `\n\nIMPORTANTE: El producto es "oversized". DEBE aparecer la palabra "Oversized" en el título. Ejemplo: "Sudadera Oversized - Algodón Orgánico - Comodidad"`;
  }
  
  if (product.attributes) {
    if (product.attributes["talla"] && ["Ropa", "Moda", "Deportes", "Bebé"].includes(product.category || "")) {
      prompt += `\n\nIMPORTANTE: El atributo 'talla' (${product.attributes["talla"]}) DEBE aparecer en el título.`;
    }
    if (product.attributes["material"] && ["Ropa", "Moda"].includes(product.category || "")) {
      prompt += `\n\nIMPORTANTE: El atributo 'material' (${product.attributes["material"]}) DEBE aparecer en el título.`;
    }
    if (product.attributes["compatibilidad"] && ["Accesorios", "Automóvil"].includes(product.category || "")) {
      prompt += `\n\nIMPORTANTE: El atributo 'compatibilidad' (${product.attributes["compatibilidad"]}) DEBE aparecer en el título.`;
    }
    if (product.attributes["diámetro"] && ["Hogar", "Cocina"].includes(product.category || "")) {
      prompt += `\n\nIMPORTANTE: El atributo 'diámetro' (${product.attributes["diámetro"]}) DEBE aparecer en el título.`;
    }
    if (product.attributes["capacidad"] && ["Accesorios", "Mascotas", "POD"].includes(product.category || "")) {
      prompt += `\n\nIMPORTANTE: El atributo 'capacidad' (${product.attributes["capacidad"]}) DEBE aparecer en el título.`;
    }
  }
  
  prompt += `\n\nGenera el JSON. El título DEBE incluir las palabras clave obligatorias. Los bullets DEBEN empezar con verbo.`;
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
    `\n\nPERFIL DE VOZ DE MARCA (aplica obligatoriamente):
- Tono: ${voiceProfile.tone}
- Vocabulario: ${voiceProfile.vocabulary}
- Estructura de frases: ${voiceProfile.sentenceStructure}
- Personalidad de marca: ${voiceProfile.brandPersonality}
- Palabras clave de la marca: ${voiceProfile.keyWords.join(", ")}

Integra este perfil de forma natural. El resultado debe sonar coherente con la identidad de la marca.`
  );
}